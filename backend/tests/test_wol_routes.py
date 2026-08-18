"""WOL 设备管理路由行为测试 — F17 防腐层迁移前基线 + 迁移后回归。

覆盖 wol_routes 的 3 个 DB 写端点（POST/PUT/DELETE /devices），捕获真实契约：
- POST /devices：name 必填(400) / MAC 格式(400) / MAC 唯一(409) / 成功(201，
  device_id 派生为 "wol-<MAC>"，device_type="wol")
- PUT /devices/<id>：404（不存在/非 wol/已软删）/ MAC 唯一(409) / 成功(200，落库)
- DELETE /devices/<id>：404（不存在/非 wol/已软删）/ 成功(200，软删 is_active=False)

注意：wol_device_model 的 marshal 输出键为 id/name/mac_address/broadcast_ip/port/
description/is_active/created_at/updated_at（description 映射 wol_description，port 映射 wol_port），
不暴露内部 device_id 列，故 device_id 派生仅通过 DB 查询校验。
网络类端点（/wake、/wake/batch、/validate、/status/<mac>）无 DB 写，不在本文件范围。
"""

from models import Device, get_by_id


class TestWOLRoutes:

    # ---------- POST /devices ----------

    def test_create_wol_device_success(self, client, app, auth_headers, db_session):
        with app.app_context():
            payload = {
                "name": "测试WOL设备",
                "mac_address": "AA:BB:CC:DD:EE:FF",
                "broadcast_ip": "192.168.1.255",
                "port": 9,
                "description": "教室电脑",
            }
            response = client.post('/api/wol/devices', json=payload, headers=auth_headers)
            assert response.status_code == 201
            data = response.get_json()
            assert data['name'] == '测试WOL设备'
            assert data['mac_address'] == 'AA:BB:CC:DD:EE:FF'
            assert data['broadcast_ip'] == '192.168.1.255'
            assert data['port'] == 9
            assert data['description'] == '教室电脑'
            assert data['is_active'] is True
            assert data['id'] > 0
            # 落库校验：device_id 派生 + device_type
            dev = Device.query.filter_by(device_id='wol-AA:BB:CC:DD:EE:FF').first()
            assert dev is not None
            assert dev.device_type == 'wol'

    def test_create_wol_device_missing_name(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                '/api/wol/devices', json={'mac_address': 'AA:BB:CC:DD:EE:01'}, headers=auth_headers
            )
            assert response.status_code == 400

    def test_create_wol_device_invalid_mac(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                '/api/wol/devices', json={'name': 'x', 'mac_address': 'ZZ:ZZ'}, headers=auth_headers
            )
            assert response.status_code == 400

    def test_create_wol_device_duplicate_mac(self, client, app, auth_headers, db_session):
        with app.app_context():
            dev = Device(
                device_id='wol-AA:BB:CC:DD:EE:02', name='已有', device_type='wol',
                mac_address='AA:BB:CC:DD:EE:02', is_active=True,
            )
            db_session.add(dev)
            db_session.commit()
            # 小写 MAC 应被归一化后命中唯一约束 → 409
            response = client.post(
                '/api/wol/devices', json={'name': '新', 'mac_address': 'aa:bb:cc:dd:ee:02'}, headers=auth_headers
            )
            assert response.status_code == 409

    # ---------- PUT /devices/<id> ----------

    def test_update_wol_device_success(self, client, app, auth_headers, db_session):
        with app.app_context():
            dev = Device(
                device_id='wol-AA:BB:CC:DD:EE:03', name='旧名', device_type='wol',
                mac_address='AA:BB:CC:DD:EE:03', is_active=True,
            )
            db_session.add(dev)
            db_session.commit()
            dev_id = dev.id
            response = client.put(
                f'/api/wol/devices/{dev_id}',
                json={'name': '新名', 'description': '更新描述'},
                headers=auth_headers,
            )
            assert response.status_code == 200
            data = response.get_json()
            assert data['name'] == '新名'
            assert data['description'] == '更新描述'
            db_dev = get_by_id(Device, dev_id)
            assert db_dev.name == '新名'
            assert db_dev.wol_description == '更新描述'

    def test_update_wol_device_not_found(self, client, app, auth_headers):
        with app.app_context():
            response = client.put('/api/wol/devices/99999', json={'name': 'x'}, headers=auth_headers)
            assert response.status_code == 404

    def test_update_wol_device_duplicate_mac(self, client, app, auth_headers, db_session):
        with app.app_context():
            d1 = Device(
                device_id='wol-AA:BB:CC:DD:EE:10', name='d1', device_type='wol',
                mac_address='AA:BB:CC:DD:EE:10', is_active=True,
            )
            d2 = Device(
                device_id='wol-AA:BB:CC:DD:EE:11', name='d2', device_type='wol',
                mac_address='AA:BB:CC:DD:EE:11', is_active=True,
            )
            db_session.add_all([d1, d2])
            db_session.commit()
            response = client.put(
                f'/api/wol/devices/{d2.id}', json={'mac_address': 'aa:bb:cc:dd:ee:10'}, headers=auth_headers
            )
            assert response.status_code == 409

    # ---------- DELETE /devices/<id> ----------

    def test_delete_wol_device_success(self, client, app, auth_headers, db_session):
        with app.app_context():
            dev = Device(
                device_id='wol-AA:BB:CC:DD:EE:20', name='待删', device_type='wol',
                mac_address='AA:BB:CC:DD:EE:20', is_active=True,
            )
            db_session.add(dev)
            db_session.commit()
            dev_id = dev.id
            response = client.delete(f'/api/wol/devices/{dev_id}', headers=auth_headers)
            assert response.status_code == 200
            data = response.get_json()
            assert data['data']['success'] is True
            db_dev = get_by_id(Device, dev_id)
            assert db_dev.is_active is False

    def test_delete_wol_device_not_found(self, client, app, auth_headers):
        with app.app_context():
            response = client.delete('/api/wol/devices/99999', headers=auth_headers)
            assert response.status_code == 404

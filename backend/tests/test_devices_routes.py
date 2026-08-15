from unittest.mock import patch
try:
    from models import Device
except ImportError:
    pass


class TestDevicesRoutes:

    def test_get_devices_list(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/devices/', headers=auth_headers)
            assert response.status_code == 200
            data = response.get_json()
            assert data['success'] is True
            assert 'devices' in data['data']
            assert 'total' in data['data']
            assert 'page' in data['data']
            assert 'per_page' in data['data']

    def test_get_devices_list_with_pagination(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/devices/?page=1&per_page=10', headers=auth_headers)
            assert response.status_code == 200
            data = response.get_json()
            assert data['data']['page'] == 1
            assert data['data']['per_page'] == 10

    def test_get_devices_list_with_filter(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/devices/?status=online', headers=auth_headers)
            assert response.status_code == 200

    def test_get_device_not_found(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/devices/99999', headers=auth_headers)
            assert response.status_code == 404

    def test_update_device_not_found(self, client, app, auth_headers):
        with app.app_context():
            response = client.put(
                '/api/devices/99999',
                json={'name': '新名称'},
                headers=auth_headers
            )
            assert response.status_code == 404

    def test_delete_device_not_found(self, client, app, auth_headers):
        with app.app_context():
            response = client.delete('/api/devices/99999', headers=auth_headers)
            assert response.status_code == 404

    def test_get_device_stats(self, client, app, auth_headers):
        with app.app_context():
            response = client.get('/api/devices/stats', headers=auth_headers)
            assert response.status_code == 200
            data = response.get_json()
            assert data['success'] is True
            assert 'total_devices' in data['data']
            assert 'online_devices' in data['data']
            assert 'offline_devices' in data['data']

    def test_ota_upgrade_all_success(self, client, app, auth_headers, db_session):
        with app.app_context():
            from models import Device

            device = Device(
                device_id='test_device_001',
                name='测试设备',
                status='online'
            )
            db_session.add(device)
            db_session.commit()

            with patch('api.devices.devices_routes.publish_mqtt', return_value=True):
                response = client.post(
                    '/api/devices/ota-upgrade-all',
                    json={'firmware_url': 'http://test.com/firmware.bin'},
                    headers=auth_headers
                )
                assert response.status_code == 200
                data = response.get_json()
                assert data['success'] is True

    def test_ota_upgrade_all_missing_url(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                '/api/devices/ota-upgrade-all',
                json={},
                headers=auth_headers
            )
            assert response.status_code == 400

    def test_ota_upgrade_all_no_online_devices(self, client, app, auth_headers):
        with app.app_context():
            with patch('api.devices.devices_routes.Device') as mock_device:
                mock_device.query.filter_by.return_value.all.return_value = []

                response = client.post(
                    '/api/devices/ota-upgrade-all',
                    json={'firmware_url': 'http://test.com/firmware.bin'},
                    headers=auth_headers
                )
                assert response.status_code == 400

    def test_bulk_ota_upgrade_alias(self, client, app, auth_headers, db_session):
        with app.app_context():

            device = Device(
                device_id='test_device_002',
                name='测试设备2',
                status='online'
            )
            db_session.add(device)
            db_session.commit()

            with patch('api.devices.devices_routes.publish_mqtt', return_value=True):
                response = client.post(
                    '/api/devices/bulk-ota-upgrade',
                    json={'firmware_url': 'http://test.com/firmware.bin'},
                    headers=auth_headers
                )
                assert response.status_code == 200
                data = response.get_json()
                assert data['success'] is True


class TestFirmwareOTAReport:
    """OTA 上报状态必须真正落库（回归 #381 的 query 未 .first() 导致状态永远卡 in_progress）。"""

    def _seed_device(self, db_session):
        from models import Device

        device = Device(device_id='ota_report_dev_001', name='OTA上报设备', status='online')
        db_session.add(device)
        db_session.commit()
        return device

    def test_ota_report_completed_persists_status(self, client, app, auth_headers, db_session):
        from models import DeviceFirmwareUpdate

        with app.app_context():
            self._seed_device(db_session)

            start = client.post(
                '/api/firmware/ota/report',
                json={
                    'device_id': 'ota_report_dev_001',
                    'device_name': 'OTA上报设备',
                    'from_version': '1.0.0',
                    'to_version': '1.1.0',
                    'status': 'started',
                },
                headers=auth_headers,
            )
            assert start.status_code == 200

            done = client.post(
                '/api/firmware/ota/report',
                json={
                    'device_id': 'ota_report_dev_001',
                    'device_name': 'OTA上报设备',
                    'from_version': '1.0.0',
                    'to_version': '1.1.0',
                    'status': 'completed',
                },
                headers=auth_headers,
            )
            assert done.status_code == 200

            record = (
                DeviceFirmwareUpdate.query.filter_by(
                    device_id='ota_report_dev_001', to_version='1.1.0'
                )
                .order_by(DeviceFirmwareUpdate.started_at.desc())
                .first()
            )
            assert record is not None, '应当存在对应的升级记录'
            assert record.status == 'completed', 'completed 状态必须落库'
            assert record.completed_at is not None, 'completed_at 必须被写入'

    def test_ota_report_failed_persists_status_and_error(self, client, app, auth_headers, db_session):
        from models import DeviceFirmwareUpdate

        with app.app_context():
            self._seed_device(db_session)

            client.post(
                '/api/firmware/ota/report',
                json={
                    'device_id': 'ota_report_dev_001',
                    'device_name': 'OTA上报设备',
                    'from_version': '1.0.0',
                    'to_version': '1.2.0',
                    'status': 'started',
                },
                headers=auth_headers,
            )
            failed = client.post(
                '/api/firmware/ota/report',
                json={
                    'device_id': 'ota_report_dev_001',
                    'device_name': 'OTA上报设备',
                    'from_version': '1.0.0',
                    'to_version': '1.2.0',
                    'status': 'failed',
                    'error_message': 'checksum mismatch',
                },
                headers=auth_headers,
            )
            assert failed.status_code == 200

            record = (
                DeviceFirmwareUpdate.query.filter_by(
                    device_id='ota_report_dev_001', to_version='1.2.0'
                )
                .order_by(DeviceFirmwareUpdate.started_at.desc())
                .first()
            )
            assert record is not None
            assert record.status == 'failed', 'failed 状态必须落库'
            assert record.error_message == 'checksum mismatch', '错误信息必须被写入'

    def test_ota_report_missing_required_fields_bad_request(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                '/api/firmware/ota/report',
                json={'device_id': 'ota_report_dev_001'},
                headers=auth_headers,
            )
            assert response.status_code == 400

from flask import request
from flask_restx import Namespace, Resource, fields
from models import db, Device, DeviceHeartbeat
from utils.permission import requires_admin
from datetime import datetime

ns_devices = Namespace('devices', description='设备管理相关操作')

device_model = ns_devices.model('Device', {
    'id': fields.Integer(readOnly=True, description='设备ID'),
    'device_id': fields.String(required=True, description='设备标识'),
    'name': fields.String(description='设备名称'),
    'status': fields.String(readOnly=True, description='状态'),
    'wifi_signal': fields.Integer(description='WiFi信号强度'),
    'uptime': fields.Integer(description='运行时间')
})

@ns_devices.route('/')
class DeviceList(Resource):
    @ns_devices.doc('list_devices')
    def get(self):
        devices = Device.query.all()
        return [{
            'id': d.id,
            'device_id': d.device_id,
            'name': d.name,
            'status': d.status,
            'is_online': d.status == 'online',
            'last_heartbeat': d.last_heartbeat.isoformat() if d.last_heartbeat else None,
            'wifi_signal': d.wifi_signal,
            'uptime': d.uptime,
            'box_a_status': d.box_a_status,
            'box_b_status': d.box_b_status,
            'system_state': d.system_state,
            'created_at': d.created_at.isoformat() if d.created_at else None,
            'updated_at': d.updated_at.isoformat() if d.updated_at else None
        } for d in devices]

    @ns_devices.doc('create_device')
    @ns_devices.expect(device_model)
    @requires_admin
    def post(self):
        data = ns_devices.payload
        device = Device(
            device_id=data.get('device_id'),
            name=data.get('name', f'设备 {data.get("device_id")}')
        )
        db.session.add(device)
        db.session.commit()
        return {'success': True, 'message': '设备创建成功', 'device_id': device.id}, 201

@ns_devices.route('/<int:id>')
@ns_devices.param('id', '设备ID')
class DeviceResource(Resource):
    @ns_devices.doc('get_device')
    def get(self, id):
        device = Device.query.get_or_404(id)
        return {
            'id': device.id,
            'device_id': device.device_id,
            'name': device.name,
            'status': device.status,
            'is_online': device.status == 'online',
            'last_heartbeat': device.last_heartbeat.isoformat() if device.last_heartbeat else None,
            'wifi_signal': device.wifi_signal,
            'uptime': device.uptime,
            'box_a_status': device.box_a_status,
            'box_b_status': device.box_b_status,
            'system_state': device.system_state,
            'created_at': device.created_at.isoformat() if device.created_at else None,
            'updated_at': device.updated_at.isoformat() if device.updated_at else None
        }

    @ns_devices.doc('update_device')
    @ns_devices.expect(device_model)
    @requires_admin
    def put(self, id):
        device = Device.query.get_or_404(id)
        data = ns_devices.payload
        device.name = data.get('name', device.name)
        device.updated_at = datetime.now()
        db.session.commit()
        return {'success': True, 'message': '设备更新成功'}

    @ns_devices.doc('delete_device')
    @requires_admin
    def delete(self, id):
        device = Device.query.get_or_404(id)
        db.session.delete(device)
        db.session.commit()
        return {'success': True, 'message': '设备删除成功'}

@ns_devices.route('/<int:id>/heartbeats')
@ns_devices.param('id', '设备ID')
class DeviceHeartbeats(Resource):
    @ns_devices.doc('get_device_heartbeats')
    def get(self, id):
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)

        device = Device.query.get_or_404(id)
        pagination = DeviceHeartbeat.query.filter_by(
            device_id=device.device_id
        ).order_by(DeviceHeartbeat.received_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        return {
            'heartbeats': [{
                'id': h.id,
                'timestamp': h.timestamp,
                'status': h.status,
                'wifi_signal': h.wifi_signal,
                'uptime': h.uptime,
                'box_a_status': h.box_a_status,
                'box_b_status': h.box_b_status,
                'system_state': h.system_state,
                'received_at': h.received_at.isoformat() if h.received_at else None
            } for h in pagination.items],
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'pages': pagination.pages
        }

@ns_devices.route('/stats')
class DeviceStats(Resource):
    @ns_devices.doc('get_device_stats')
    def get(self):
        total = Device.query.count()
        online = Device.query.filter_by(status='online').count()
        offline = Device.query.filter_by(status='offline').count()
        error = Device.query.filter_by(status='error').count()

        today = datetime.now().date()
        today_heartbeats = DeviceHeartbeat.query.filter(
            DeviceHeartbeat.received_at >= datetime.combine(today, datetime.min.time())
        ).count()

        recent_heartbeats = DeviceHeartbeat.query.order_by(
            DeviceHeartbeat.received_at.desc()
        ).limit(100).all()

        return {
            'total_devices': total,
            'online_devices': online,
            'offline_devices': offline,
            'error_devices': error,
            'today_heartbeats': today_heartbeats,
            'recent_activity': [{
                'device_id': h.device_id,
                'status': h.status,
                'received_at': h.received_at.isoformat() if h.received_at else None
            } for h in recent_heartbeats[:10]]
        }

@ns_devices.route('/online')
class OnlineDevices(Resource):
    @ns_devices.doc('get_online_devices')
    def get(self):
        devices = Device.query.filter_by(status='online').all()
        return [{
            'id': d.id,
            'device_id': d.device_id,
            'name': d.name,
            'status': d.status,
            'is_online': True,
            'last_heartbeat': d.last_heartbeat.isoformat() if d.last_heartbeat else None,
            'wifi_signal': d.wifi_signal
        } for d in devices]
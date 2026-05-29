from flask import request
from flask_restx import Namespace, Resource, fields
from models import db, Device, DeviceHeartbeat, ClassInfo, Admin, AdminClass
from utils.permission import requires_admin, get_current_admin, get_admin_class_ids
from datetime import datetime

ns_devices = Namespace('devices', description='设备管理相关操作')

device_model = ns_devices.model('Device', {
    'id': fields.Integer(readOnly=True, description='设备ID'),
    'device_id': fields.String(required=True, description='设备标识'),
    'name': fields.String(description='设备名称'),
    'status': fields.String(readOnly=True, description='状态（online/offline/error）'),
    'wifi_signal': fields.Integer(description='WiFi信号强度'),
    'uptime': fields.Integer(description='运行时间（秒）')
})

device_list_response = ns_devices.model('DeviceListResponse', {
    'id': fields.Integer(description='设备ID'),
    'device_id': fields.String(description='设备标识'),
    'name': fields.String(description='设备名称'),
    'status': fields.String(description='状态'),
    'is_online': fields.Boolean(description='是否在线'),
    'last_heartbeat': fields.String(description='最后心跳时间'),
    'wifi_signal': fields.Integer(description='WiFi信号强度'),
    'uptime': fields.Integer(description='运行时间'),
    'box_a_status': fields.String(description='Box A状态'),
    'box_b_status': fields.String(description='Box B状态'),
    'system_state': fields.String(description='系统状态'),
    'class_info_id': fields.Integer(description='班级ID'),
    'class_name': fields.String(description='班级名称'),
    'admin_id': fields.Integer(description='管理员ID'),
    'admin_name': fields.String(description='管理员姓名'),
    'admin_username': fields.String(description='管理员用户名'),
    'created_at': fields.String(description='创建时间'),
    'updated_at': fields.String(description='更新时间')
})

device_stats_response = ns_devices.model('DeviceStatsResponse', {
    'total_devices': fields.Integer(description='设备总数'),
    'online_devices': fields.Integer(description='在线设备数'),
    'offline_devices': fields.Integer(description='离线设备数'),
    'error_devices': fields.Integer(description='故障设备数'),
    'today_heartbeats': fields.Integer(description='今日心跳数'),
    'recent_activity': fields.List(fields.Raw, description='最近活动')
})

def get_devices_for_admin(admin):
    """根据管理员权限获取设备列表"""
    if not admin:
        return Device.query.filter_by(status='online').all()
    
    if admin.role == 'admin':
        return Device.query.all()
    
    class_ids = get_admin_class_ids(admin.id)
    if class_ids:
        return Device.query.filter(
            (Device.class_info_id.in_(class_ids)) | 
            (Device.admin_id == admin.id)
        ).all()
    
    return Device.query.filter(Device.admin_id == admin.id).all()

@ns_devices.route('/')
class DeviceList(Resource):
    @ns_devices.doc('list_devices', description='获取设备列表', security='Bearer')
    @ns_devices.response(200, '成功', device_list_response)
    @requires_admin
    def get(self):
        """
        获取设备列表
        
        获取当前管理员有权访问的所有设备列表。
        超级管理员可以看到所有设备，普通管理员只能看到自己班级或绑定到自己的设备。
        """
        admin = get_current_admin()
        devices = get_devices_for_admin(admin)
        
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
            'class_info_id': d.class_info_id,
            'class_name': d.class_info.name if d.class_info else None,
            'admin_id': d.admin_id,
            'admin_name': d.admin.real_name if d.admin else None,
            'admin_username': d.admin.username if d.admin else None,
            'created_at': d.created_at.isoformat() if d.created_at else None,
            'updated_at': d.updated_at.isoformat() if d.updated_at else None
        } for d in devices]

    @ns_devices.doc('create_device', description='创建设备', security='Bearer')
    @ns_devices.expect(device_model)
    @ns_devices.response(201, '创建成功')
    @requires_admin
    def post(self):
        """
        创建设备
        
        创建新的设备，需要管理员权限。
        
        请求体：
        - device_id: 设备标识（必填）
        - name: 设备名称（可选，默认"设备 {device_id}"）
        """
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
    @ns_devices.doc('get_device', description='获取单个设备详情')
    @ns_devices.response(200, '成功')
    @ns_devices.response(404, '设备不存在')
    def get(self, id):
        """
        获取单个设备详情
        
        根据设备ID获取设备的详细信息。
        """
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
            'class_info_id': device.class_info_id,
            'class_name': device.class_info.name if device.class_info else None,
            'admin_id': device.admin_id,
            'admin_name': device.admin.real_name if device.admin else None,
            'admin_username': device.admin.username if device.admin else None,
            'created_at': device.created_at.isoformat() if device.created_at else None,
            'updated_at': device.updated_at.isoformat() if device.updated_at else None
        }

    @ns_devices.doc('update_device', description='更新设备', security='Bearer')
    @ns_devices.expect(device_model)
    @ns_devices.response(200, '更新成功')
    @ns_devices.response(404, '设备不存在')
    @requires_admin
    def put(self, id):
        """
        更新设备
        
        更新指定设备的信息，需要管理员权限。
        """
        device = Device.query.get_or_404(id)
        data = ns_devices.payload
        device.name = data.get('name', device.name)
        device.updated_at = datetime.now()
        db.session.commit()
        return {'success': True, 'message': '设备更新成功'}

    @ns_devices.doc('delete_device', description='删除设备', security='Bearer')
    @ns_devices.response(200, '删除成功')
    @ns_devices.response(404, '设备不存在')
    @requires_admin
    def delete(self, id):
        """
        删除设备
        
        删除指定的设备，需要管理员权限。
        """
        device = Device.query.get_or_404(id)
        db.session.delete(device)
        db.session.commit()
        return {'success': True, 'message': '设备删除成功'}

@ns_devices.route('/<int:id>/heartbeats')
@ns_devices.param('id', '设备ID')
class DeviceHeartbeats(Resource):
    @ns_devices.doc('get_device_heartbeats', description='获取设备心跳记录', params={
        'page': '页码（默认1）',
        'per_page': '每页数量（默认50）'
    })
    @ns_devices.response(200, '成功')
    @ns_devices.response(404, '设备不存在')
    def get(self, id):
        """
        获取设备心跳记录
        
        获取指定设备的所有心跳历史记录，支持分页。
        """
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
    @ns_devices.doc('get_device_stats', description='获取设备统计信息')
    @ns_devices.response(200, '成功', device_stats_response)
    def get(self):
        """
        获取设备统计信息
        
        获取所有设备的统计数据，包括在线/离线数量、今日心跳数等。
        """
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
    @ns_devices.doc('get_online_devices', description='获取在线设备列表')
    @ns_devices.response(200, '成功')
    def get(self):
        """
        获取在线设备列表
        
        获取所有当前在线的设备列表。
        """
        devices = Device.query.filter_by(status='online').all()
        return [{
            'id': d.id,
            'device_id': d.device_id,
            'name': d.name,
            'status': d.status,
            'is_online': True,
            'last_heartbeat': d.last_heartbeat.isoformat() if d.last_heartbeat else None,
            'wifi_signal': d.wifi_signal,
            'class_info_id': d.class_info_id,
            'class_name': d.class_info.name if d.class_info else None,
            'admin_id': d.admin_id,
            'admin_name': d.admin.real_name if d.admin else None
        } for d in devices]

bind_class_model = ns_devices.model('BindClassRequest', {
    'class_id': fields.Integer(description='班级ID（设为null可解绑）')
})

@ns_devices.route('/<int:id>/bind-class')
@ns_devices.param('id', '设备ID')
class BindDeviceClass(Resource):
    @ns_devices.doc('bind_device_class', description='绑定设备到班级', security='Bearer')
    @ns_devices.expect(bind_class_model)
    @ns_devices.response(200, '绑定成功')
    @ns_devices.response(403, '无权绑定到该班级')
    @ns_devices.response(404, '班级不存在')
    @requires_admin
    def post(self, id):
        """
        绑定设备到班级
        
        将设备绑定到指定的班级，需要管理员权限。
        非超级管理员只能绑定到自己管理的班级。
        
        请求体：
        - class_id: 班级ID（设为null可解绑设备与班级的关联）
        """
        admin = get_current_admin()
        device = Device.query.get_or_404(id)
        data = request.get_json()
        class_id = data.get('class_id')
        
        if admin.role != 'admin':
            class_ids = get_admin_class_ids(admin.id)
            if class_id and class_id not in class_ids:
                return {'success': False, 'message': '无权绑定到该班级'}, 403
        
        if class_id:
            class_info = ClassInfo.query.get(class_id)
            if not class_info:
                return {'success': False, 'message': '班级不存在'}, 404
            device.class_info_id = class_id
        else:
            device.class_info_id = None
        
        device.updated_at = datetime.now()
        db.session.commit()
        
        return {
            'success': True, 
            'message': '设备绑定班级成功',
            'class_info_id': device.class_info_id,
            'class_name': device.class_info.name if device.class_info else None
        }

bind_admin_model = ns_devices.model('BindAdminRequest', {
    'admin_id': fields.Integer(description='管理员ID（设为null可解绑）')
})

@ns_devices.route('/<int:id>/bind-admin')
@ns_devices.param('id', '设备ID')
class BindDeviceAdmin(Resource):
    @ns_devices.doc('bind_device_admin', description='绑定设备到管理员', security='Bearer')
    @ns_devices.expect(bind_admin_model)
    @ns_devices.response(200, '绑定成功')
    @ns_devices.response(403, '只有超级管理员可以绑定管理员')
    @ns_devices.response(404, '管理员不存在')
    @requires_admin
    def post(self, id):
        """
        绑定设备到管理员
        
        将设备绑定到指定的管理员，只有超级管理员可以执行此操作。
        
        请求体：
        - admin_id: 管理员ID（设为null可解绑设备与管理员的关联）
        """
        admin = get_current_admin()
        
        if admin.role != 'admin':
            return {'success': False, 'message': '只有超级管理员可以绑定管理员'}, 403
        
        device = Device.query.get_or_404(id)
        data = request.get_json()
        admin_id = data.get('admin_id')
        
        if admin_id:
            target_admin = Admin.query.get(admin_id)
            if not target_admin:
                return {'success': False, 'message': '管理员不存在'}, 404
            device.admin_id = admin_id
        else:
            device.admin_id = None
        
        device.updated_at = datetime.now()
        db.session.commit()
        
        return {
            'success': True, 
            'message': '设备绑定管理员成功',
            'admin_id': device.admin_id,
            'admin_name': device.admin.real_name if device.admin else None,
            'admin_username': device.admin.username if device.admin else None
        }

@ns_devices.route('/class/<int:class_id>')
@ns_devices.param('class_id', '班级ID')
class DevicesByClass(Resource):
    @ns_devices.doc('get_devices_by_class', description='获取班级的设备列表')
    @ns_devices.response(200, '成功')
    def get(self, class_id):
        """
        获取班级的设备列表
        
        获取绑定到指定班级的所有设备。
        """
        devices = Device.query.filter_by(class_info_id=class_id).all()
        return [{
            'id': d.id,
            'device_id': d.device_id,
            'name': d.name,
            'status': d.status,
            'is_online': d.status == 'online',
            'last_heartbeat': d.last_heartbeat.isoformat() if d.last_heartbeat else None,
            'wifi_signal': d.wifi_signal,
            'admin_name': d.admin.real_name if d.admin else None,
            'updated_at': d.updated_at.isoformat() if d.updated_at else None
        } for d in devices]

@ns_devices.route('/admin/<int:admin_id>')
@ns_devices.param('admin_id', '管理员ID')
class DevicesByAdmin(Resource):
    @ns_devices.doc('get_devices_by_admin', description='获取管理员的设备列表')
    @ns_devices.response(200, '成功')
    def get(self, admin_id):
        """
        获取管理员的设备列表
        
        获取绑定到指定管理员的所有设备。
        """
        devices = Device.query.filter_by(admin_id=admin_id).all()
        return [{
            'id': d.id,
            'device_id': d.device_id,
            'name': d.name,
            'status': d.status,
            'is_online': d.status == 'online',
            'last_heartbeat': d.last_heartbeat.isoformat() if d.last_heartbeat else None,
            'wifi_signal': d.wifi_signal,
            'class_name': d.class_info.name if d.class_info else None,
            'updated_at': d.updated_at.isoformat() if d.updated_at else None
        } for d in devices]
from flask import request
from flask_restx import Namespace, Resource, fields
from utils.permission import requires_admin
from flask import current_app

ns_notification_config = Namespace('notification-config', description='通知配置管理')

notification_config_model = ns_notification_config.model('NotificationConfig', {
    'wechat_appid': fields.String(description='微信AppID'),
    'wechat_secret': fields.String(description='微信AppSecret'),
    'template_unlock_success': fields.String(description='开锁成功模板ID'),
    'template_unlock_failure': fields.String(description='开锁失败模板ID'),
    'template_score_change': fields.String(description='积分变动模板ID'),
    'sms_provider': fields.String(description='短信服务商(aliyun/tencent)'),
    'sms_access_key_id': fields.String(description='短信AccessKeyId'),
    'sms_access_key_secret': fields.String(description='短信AccessKeySecret'),
    'sms_sign_name': fields.String(description='短信签名'),
    'sms_template_code': fields.String(description='短信模板CODE'),
    'enable_wechat_notification': fields.Boolean(description='是否启用微信通知'),
    'enable_sms_notification': fields.Boolean(description='是否启用短信通知')
})


@ns_notification_config.route('/')
class NotificationConfig(Resource):
    @ns_notification_config.doc('get_notification_config', description='获取通知配置')
    @ns_notification_config.response(200, '成功')
    @requires_admin
    def get(self):
        """
        获取通知配置

        返回当前的微信和短信通知配置。
        """
        config = {
            'wechat_appid': current_app.config.get('WECHAT_APPID', ''),
            'wechat_secret': '***' if current_app.config.get('WECHAT_SECRET') else '',
            'template_unlock_success': current_app.config.get('WECHAT_TEMPLATE_UNLOCK_SUCCESS', ''),
            'template_unlock_failure': current_app.config.get('WECHAT_TEMPLATE_UNLOCK_FAILURE', ''),
            'template_score_change': current_app.config.get('WECHAT_TEMPLATE_SCORE_CHANGE', ''),
            'sms_provider': current_app.config.get('SMS_CONFIG', {}).get('provider', ''),
            'sms_access_key_id': current_app.config.get('SMS_CONFIG', {}).get('access_key_id', ''),
            'sms_sign_name': current_app.config.get('SMS_CONFIG', {}).get('sign_name', ''),
            'sms_template_code': current_app.config.get('SMS_CONFIG', {}).get('template_code', ''),
            'enable_wechat_notification': current_app.config.get('ENABLE_WECHAT_NOTIFICATION', True),
            'enable_sms_notification': current_app.config.get('ENABLE_SMS_NOTIFICATION', False)
        }

        return {
            'success': True,
            'config': config
        }

    @ns_notification_config.doc('update_notification_config', description='更新通知配置')
    @ns_notification_config.expect(notification_config_model)
    @ns_notification_config.response(200, '成功')
    @requires_admin
    def put(self):
        """
        更新通知配置

        更新微信和短信通知的配置。
        """
        data = request.get_json()

        if 'wechat_appid' in data:
            current_app.config['WECHAT_APPID'] = data['wechat_appid']
        if 'wechat_secret' in data and data['wechat_secret'] != '***':
            current_app.config['WECHAT_SECRET'] = data['wechat_secret']
        if 'template_unlock_success' in data:
            current_app.config['WECHAT_TEMPLATE_UNLOCK_SUCCESS'] = data['template_unlock_success']
        if 'template_unlock_failure' in data:
            current_app.config['WECHAT_TEMPLATE_UNLOCK_FAILURE'] = data['template_unlock_failure']
        if 'template_score_change' in data:
            current_app.config['WECHAT_TEMPLATE_SCORE_CHANGE'] = data['template_score_change']

        sms_config = current_app.config.get('SMS_CONFIG', {})
        if 'sms_provider' in data:
            sms_config['provider'] = data['sms_provider']
        if 'sms_access_key_id' in data:
            sms_config['access_key_id'] = data['sms_access_key_id']
        if 'sms_access_key_secret' in data and data['sms_access_key_secret'] != '***':
            sms_config['access_key_secret'] = data['sms_access_key_secret']
        if 'sms_sign_name' in data:
            sms_config['sign_name'] = data['sms_sign_name']
        if 'sms_template_code' in data:
            sms_config['template_code'] = data['sms_template_code']
        current_app.config['SMS_CONFIG'] = sms_config

        if 'enable_wechat_notification' in data:
            current_app.config['ENABLE_WECHAT_NOTIFICATION'] = data['enable_wechat_notification']
        if 'enable_sms_notification' in data:
            current_app.config['ENABLE_SMS_NOTIFICATION'] = data['enable_sms_notification']

        return {
            'success': True,
            'message': '通知配置已更新'
        }


@ns_notification_config.route('/test-wechat')
class TestWechatNotification(Resource):
    @ns_notification_config.doc('test_wechat_notification', description='测试微信通知')
    @ns_notification_config.param('openid', '用户OpenID')
    @ns_notification_config.response(200, '成功')
    @requires_admin
    def post(self):
        """
        测试微信通知

        发送一条测试模板消息。
        """
        from services.notification_service import NotificationService

        openid = request.args.get('openid')
        if not openid:
            return {'success': False, 'message': '请提供openid'}, 400

        template_id = current_app.config.get('WECHAT_TEMPLATE_UNLOCK_SUCCESS')
        if not template_id:
            return {'success': False, 'message': '模板ID未配置'}, 400

        data = {
            'first': {'value': '这是一条测试消息', 'color': '#173177'},
            'keyword1': {'value': '测试设备', 'color': '#173177'},
            'keyword2': {'value': 'A箱', 'color': '#173177'},
            'keyword3': {'value': datetime.now().strftime('%Y-%m-%d %H:%M'), 'color': '#173177'},
            'remark': {'value': '如果您收到这条消息，说明微信通知配置正确', 'color': '#999999'}
        }

        result = NotificationService.send_wechat_notification(
            user_id=0,
            template_id=template_id,
            data=data
        )

        return result


@ns_notification_config.route('/test-sms')
class TestSmsNotification(Resource):
    @ns_notification_config.doc('test_sms_notification', description='测试短信通知')
    @ns_notification_config.param('phone', '手机号')
    @ns_notification_config.response(200, '成功')
    @requires_admin
    def post(self):
        """
        测试短信通知

        发送一条测试短信。
        """
        from services.notification_service import NotificationService

        phone = request.args.get('phone')
        if not phone:
            return {'success': False, 'message': '请提供手机号'}, 400

        result = NotificationService.send_sms_notification(
            phone=phone,
            message=f'【测试消息】这是一条测试短信，发送时间：{datetime.now().strftime("%Y-%m-%d %H:%M")}'
        )

        return result


from datetime import datetime
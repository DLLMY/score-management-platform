from flask import request
from flask_restx import Namespace, Resource, fields
from models import db, User, ScoreRecord, ScoreRule, Device
from datetime import datetime

ns_box = Namespace('box', description='积分盒子相关操作')

@ns_box.route('/verify')
class BoxVerify(Resource):
    @ns_box.doc('box_verify')
    def post(self):
        data = request.get_json()
        card_id = data.get('card_id')
        device_id = data.get('device_id')
        rule_id = data.get('rule_id')
        
        if not card_id or not device_id:
            return {'success': False, 'message': '缺少必要参数'}, 400
        
        user = User.query.filter_by(card_id=card_id).first()
        if not user:
            return {'success': False, 'message': '未找到用户'}, 404
        
        device = Device.query.get(device_id)
        if not device or device.status != 'online':
            return {'success': False, 'message': '设备离线或不存在'}, 400
        
        if rule_id:
            rule = ScoreRule.query.get(rule_id)
            if not rule or not rule.is_active:
                return {'success': False, 'message': '规则不存在或未启用'}, 400
            
            user.current_score += rule.score
            
            record = ScoreRecord(
                user_id=user.id,
                rule_id=rule.id,
                score_change=rule.score,
                description=rule.description,
                source='box',
                source_info=f'device_id={device_id}'
            )
            db.session.add(record)
            db.session.commit()
            
            return {
                'success': True,
                'message': f'积分添加成功 +{rule.score}',
                'user': {
                    'id': user.id,
                    'name': user.name,
                    'card_id': user.card_id,
                    'current_score': user.current_score
                }
            }
        
        return {
            'success': True,
            'message': '用户验证成功',
            'user': {
                'id': user.id,
                'name': user.name,
                'card_id': user.card_id,
                'current_score': user.current_score,
                'class_name': user.class_name
            }
        }

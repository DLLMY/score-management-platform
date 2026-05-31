#!/usr/bin/env python3
"""
成绩管理模块API路由
"""

from flask_restx import Namespace, Resource, fields
from flask import request, jsonify
from models import db, Exam, Score, User, ClassInfo, Admin
from datetime import datetime
import json

ns_exam = Namespace('exams', description='考试管理接口')
ns_scores = Namespace('scores', description='成绩管理接口')
ns_score_analysis = Namespace('score-analysis', description='成绩分析接口')

# 考试模型
exam_model = ns_exam.model('Exam', {
    'id': fields.Integer(readOnly=True, description='考试ID'),
    'name': fields.String(required=True, description='考试名称'),
    'description': fields.String(description='考试说明'),
    'subjects': fields.List(fields.String, required=True, description='考试科目列表'),
    'start_time': fields.DateTime(required=True, description='考试开始时间'),
    'end_time': fields.DateTime(required=True, description='考试结束时间'),
    'importance': fields.String(description='重要性等级', enum=['low', 'medium', 'high']),
    'class_id': fields.Integer(description='班级ID'),
    'status': fields.String(readOnly=True, description='状态'),
    'created_by': fields.Integer(readOnly=True, description='创建人ID'),
    'created_at': fields.DateTime(readOnly=True, description='创建时间'),
    'updated_at': fields.DateTime(readOnly=True, description='更新时间')
})

# 成绩模型
score_model = ns_scores.model('Score', {
    'id': fields.Integer(readOnly=True, description='成绩ID'),
    'exam_id': fields.Integer(required=True, description='考试ID'),
    'student_id': fields.Integer(required=True, description='学生ID'),
    'subject': fields.String(required=True, description='科目'),
    'score': fields.Float(description='分数'),
    'full_score': fields.Float(description='满分'),
    'rank': fields.Integer(readOnly=True, description='排名'),
    'status': fields.String(readOnly=True, description='状态'),
    'entered_by': fields.Integer(readOnly=True, description='录入人'),
    'entered_at': fields.DateTime(readOnly=True, description='录入时间')
})

@ns_exam.route('/')
class ExamList(Resource):
    @ns_exam.doc('list_exams')
    def get(self):
        """获取考试列表"""
        try:
            class_id = request.args.get('class_id', type=int)
            status = request.args.get('status')
            
            query = Exam.query
            
            if class_id:
                query = query.filter_by(class_id=class_id)
            if status:
                query = query.filter_by(status=status)
            
            exams = query.order_by(Exam.start_time.desc()).all()
            
            result = []
            for exam in exams:
                exam_dict = {
                    'id': exam.id,
                    'name': exam.name,
                    'description': exam.description,
                    'subjects': exam.subjects,
                    'start_time': exam.start_time.isoformat(),
                    'end_time': exam.end_time.isoformat(),
                    'importance': exam.importance,
                    'class_id': exam.class_id,
                    'status': exam.status,
                    'created_by': exam.created_by,
                    'created_at': exam.created_at.isoformat(),
                    'updated_at': exam.updated_at.isoformat()
                }
                if exam.class_info:
                    exam_dict['class_name'] = exam.class_info.name
                result.append(exam_dict)
            
            return jsonify({'code': 0, 'data': result, 'message': 'success'})
        except Exception as e:
            return jsonify({'code': -1, 'message': str(e)})

    @ns_exam.doc('create_exam')
    @ns_exam.expect(exam_model)
    def post(self):
        """创建考试"""
        try:
            data = request.get_json()
            
            exam = Exam(
                name=data['name'],
                description=data.get('description'),
                subjects=data['subjects'],
                start_time=datetime.fromisoformat(data['start_time'].replace('Z', '+00:00')),
                end_time=datetime.fromisoformat(data['end_time'].replace('Z', '+00:00')),
                importance=data.get('importance', 'medium'),
                class_id=data.get('class_id'),
                status='draft',
                created_by=data.get('created_by', 1)
            )
            
            db.session.add(exam)
            db.session.commit()
            
            return jsonify({'code': 0, 'data': {'id': exam.id}, 'message': '创建成功'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'code': -1, 'message': str(e)})

@ns_exam.route('/<int:id>')
class ExamDetail(Resource):
    @ns_exam.doc('get_exam')
    def get(self, id):
        """获取考试详情"""
        try:
            exam = Exam.query.get_or_404(id)
            
            result = {
                'id': exam.id,
                'name': exam.name,
                'description': exam.description,
                'subjects': exam.subjects,
                'start_time': exam.start_time.isoformat(),
                'end_time': exam.end_time.isoformat(),
                'importance': exam.importance,
                'class_id': exam.class_id,
                'status': exam.status,
                'created_by': exam.created_by,
                'created_at': exam.created_at.isoformat(),
                'updated_at': exam.updated_at.isoformat()
            }
            if exam.class_info:
                result['class_name'] = exam.class_info.name
            
            return jsonify({'code': 0, 'data': result, 'message': 'success'})
        except Exception as e:
            return jsonify({'code': -1, 'message': str(e)})

    @ns_exam.doc('update_exam')
    def put(self, id):
        """更新考试"""
        try:
            exam = Exam.query.get_or_404(id)
            
            if exam.status != 'draft':
                return jsonify({'code': -1, 'message': '已发布的考试不能修改'})
            
            data = request.get_json()
            
            if 'name' in data:
                exam.name = data['name']
            if 'description' in data:
                exam.description = data['description']
            if 'subjects' in data:
                exam.subjects = data['subjects']
            if 'start_time' in data:
                exam.start_time = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
            if 'end_time' in data:
                exam.end_time = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))
            if 'importance' in data:
                exam.importance = data['importance']
            if 'class_id' in data:
                exam.class_id = data['class_id']
            
            exam.updated_at = datetime.now()
            db.session.commit()
            
            return jsonify({'code': 0, 'message': '更新成功'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'code': -1, 'message': str(e)})

    @ns_exam.doc('delete_exam')
    def delete(self, id):
        """删除考试"""
        try:
            exam = Exam.query.get_or_404(id)
            
            if exam.status != 'draft':
                return jsonify({'code': -1, 'message': '已发布的考试不能删除'})
            
            db.session.delete(exam)
            db.session.commit()
            
            return jsonify({'code': 0, 'message': '删除成功'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'code': -1, 'message': str(e)})

@ns_exam.route('/<int:id>/publish')
class ExamPublish(Resource):
    @ns_exam.doc('publish_exam')
    def post(self, id):
        """发布考试"""
        try:
            exam = Exam.query.get_or_404(id)
            
            if exam.status != 'draft':
                return jsonify({'code': -1, 'message': '只能发布草稿状态的考试'})
            
            exam.status = 'published'
            exam.updated_at = datetime.now()
            db.session.commit()
            
            return jsonify({'code': 0, 'message': '发布成功'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'code': -1, 'message': str(e)})

@ns_exam.route('/<int:id>/close')
class ExamClose(Resource):
    @ns_exam.doc('close_exam')
    def post(self, id):
        """关闭考试"""
        try:
            exam = Exam.query.get_or_404(id)
            
            if exam.status != 'published':
                return jsonify({'code': -1, 'message': '只能关闭已发布的考试'})
            
            exam.status = 'closed'
            exam.updated_at = datetime.now()
            db.session.commit()
            
            return jsonify({'code': 0, 'message': '关闭成功'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'code': -1, 'message': str(e)})

@ns_scores.route('/')
class ScoreList(Resource):
    @ns_scores.doc('list_scores')
    def get(self):
        """获取成绩列表"""
        try:
            exam_id = request.args.get('exam_id', type=int)
            student_id = request.args.get('student_id', type=int)
            subject = request.args.get('subject')
            
            query = Score.query
            
            if exam_id:
                query = query.filter_by(exam_id=exam_id)
            if student_id:
                query = query.filter_by(student_id=student_id)
            if subject:
                query = query.filter_by(subject=subject)
            
            scores = query.all()
            
            result = []
            for score in scores:
                score_dict = {
                    'id': score.id,
                    'exam_id': score.exam_id,
                    'student_id': score.student_id,
                    'subject': score.subject,
                    'score': score.score,
                    'full_score': score.full_score,
                    'rank': score.rank,
                    'status': score.status,
                    'entered_by': score.entered_by,
                    'entered_at': score.entered_at.isoformat()
                }
                if score.student:
                    score_dict['student_name'] = score.student.name
                    score_dict['student_card_id'] = score.student.card_id
                if score.exam:
                    score_dict['exam_name'] = score.exam.name
                result.append(score_dict)
            
            return jsonify({'code': 0, 'data': result, 'message': 'success'})
        except Exception as e:
            return jsonify({'code': -1, 'message': str(e)})

    @ns_scores.doc('create_score')
    def post(self):
        """录入成绩"""
        try:
            data = request.get_json()
            
            exam = Exam.query.get_or_404(data['exam_id'])
            
            if exam.status != 'published':
                return jsonify({'code': -1, 'message': '考试未发布，无法录入成绩'})
            
            if datetime.now() > exam.end_time:
                return jsonify({'code': -1, 'message': '考试已结束，无法录入成绩'})
            
            existing_score = Score.query.filter_by(
                exam_id=data['exam_id'],
                student_id=data['student_id'],
                subject=data['subject']
            ).first()
            
            if existing_score:
                return jsonify({'code': -1, 'message': '该学生该科目成绩已存在'})
            
            score = Score(
                exam_id=data['exam_id'],
                student_id=data['student_id'],
                subject=data['subject'],
                score=data.get('score'),
                full_score=data.get('full_score', 100),
                status='pending',
                entered_by=data.get('entered_by', 1)
            )
            
            db.session.add(score)
            db.session.commit()
            
            return jsonify({'code': 0, 'data': {'id': score.id}, 'message': '录入成功'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'code': -1, 'message': str(e)})

@ns_scores.route('/batch')
class ScoreBatch(Resource):
    @ns_scores.doc('batch_create_scores')
    def post(self):
        """批量录入成绩"""
        try:
            data = request.get_json()
            scores_data = data.get('scores', [])
            entered_by = data.get('entered_by', 1)
            
            if not scores_data:
                return jsonify({'code': -1, 'message': '没有成绩数据'})
            
            exam_id = scores_data[0].get('exam_id')
            exam = Exam.query.get_or_404(exam_id)
            
            if exam.status != 'published':
                return jsonify({'code': -1, 'message': '考试未发布，无法录入成绩'})
            
            if datetime.now() > exam.end_time:
                return jsonify({'code': -1, 'message': '考试已结束，无法录入成绩'})
            
            success_count = 0
            failed_count = 0
            failed_messages = []
            
            for score_data in scores_data:
                try:
                    existing_score = Score.query.filter_by(
                        exam_id=score_data['exam_id'],
                        student_id=score_data['student_id'],
                        subject=score_data['subject']
                    ).first()
                    
                    if existing_score:
                        failed_count += 1
                        failed_messages.append(f"学生{score_data['student_id']}的{score_data['subject']}成绩已存在")
                        continue
                    
                    score = Score(
                        exam_id=score_data['exam_id'],
                        student_id=score_data['student_id'],
                        subject=score_data['subject'],
                        score=score_data.get('score'),
                        full_score=score_data.get('full_score', 100),
                        status='pending',
                        entered_by=entered_by
                    )
                    db.session.add(score)
                    success_count += 1
                except Exception as e:
                    failed_count += 1
                    failed_messages.append(str(e))
            
            db.session.commit()
            
            return jsonify({
                'code': 0,
                'data': {
                    'success_count': success_count,
                    'failed_count': failed_count,
                    'failed_messages': failed_messages
                },
                'message': f'批量录入完成，成功{success_count}条，失败{failed_count}条'
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({'code': -1, 'message': str(e)})

@ns_scores.route('/<int:id>')
class ScoreDetail(Resource):
    @ns_scores.doc('get_score')
    def get(self, id):
        """获取成绩详情"""
        try:
            score = Score.query.get_or_404(id)
            
            result = {
                'id': score.id,
                'exam_id': score.exam_id,
                'student_id': score.student_id,
                'subject': score.subject,
                'score': score.score,
                'full_score': score.full_score,
                'rank': score.rank,
                'status': score.status,
                'entered_by': score.entered_by,
                'entered_at': score.entered_at.isoformat()
            }
            
            if score.student:
                result['student_name'] = score.student.name
            if score.exam:
                result['exam_name'] = score.exam.name
            
            return jsonify({'code': 0, 'data': result, 'message': 'success'})
        except Exception as e:
            return jsonify({'code': -1, 'message': str(e)})

    @ns_scores.doc('update_score')
    def put(self, id):
        """修改成绩"""
        try:
            score = Score.query.get_or_404(id)
            
            if score.status == 'locked':
                return jsonify({'code': -1, 'message': '成绩已锁定，无法修改'})
            
            exam = Exam.query.get(score.exam_id)
            if exam and datetime.now() > exam.end_time:
                return jsonify({'code': -1, 'message': '考试已结束，无法修改成绩'})
            
            data = request.get_json()
            
            if 'score' in data:
                score.score = data['score']
            if 'full_score' in data:
                score.full_score = data['full_score']
            
            score.updated_at = datetime.now()
            db.session.commit()
            
            return jsonify({'code': 0, 'message': '修改成功'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'code': -1, 'message': str(e)})

    @ns_scores.doc('delete_score')
    def delete(self, id):
        """删除成绩"""
        try:
            score = Score.query.get_or_404(id)
            
            if score.status == 'locked':
                return jsonify({'code': -1, 'message': '成绩已锁定，无法删除'})
            
            db.session.delete(score)
            db.session.commit()
            
            return jsonify({'code': 0, 'message': '删除成功'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'code': -1, 'message': str(e)})

@ns_scores.route('/<int:id>/confirm')
class ScoreConfirm(Resource):
    @ns_scores.doc('confirm_score')
    def post(self, id):
        """确认成绩"""
        try:
            score = Score.query.get_or_404(id)
            
            score.status = 'confirmed'
            score.updated_at = datetime.now()
            db.session.commit()
            
            return jsonify({'code': 0, 'message': '确认成功'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'code': -1, 'message': str(e)})

@ns_scores.route('/<int:exam_id>/confirm-all')
class ScoreConfirmAll(Resource):
    @ns_scores.doc('confirm_all_scores')
    def post(self, exam_id):
        """确认所有成绩"""
        try:
            Score.query.filter_by(exam_id=exam_id).update({
                'status': 'confirmed',
                'updated_at': datetime.now()
            })
            db.session.commit()
            
            return jsonify({'code': 0, 'message': '全部确认成功'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'code': -1, 'message': str(e)})

@ns_scores.route('/import')
class ScoreImport(Resource):
    @ns_scores.doc('import_scores')
    def post(self):
        """Excel导入成绩"""
        try:
            if 'file' not in request.files:
                return jsonify({'code': -1, 'message': '没有上传文件'})
            
            file = request.files['file']
            exam_id = request.form.get('exam_id', type=int)
            entered_by = request.form.get('entered_by', type=int, default=1)
            
            if not exam_id:
                return jsonify({'code': -1, 'message': '缺少考试ID'})
            
            exam = Exam.query.get_or_404(exam_id)
            
            if exam.status != 'published':
                return jsonify({'code': -1, 'message': '考试未发布，无法导入成绩'})
            
            import openpyxl
            wb = openpyxl.load_workbook(file)
            sheet = wb.active
            
            success_count = 0
            failed_count = 0
            failed_messages = []
            
            for row in sheet.iter_rows(min_row=2, values_only=True):
                try:
                    card_id = row[0]
                    subject = row[1]
                    score_val = row[2]
                    
                    if not card_id or not subject:
                        continue
                    
                    student = User.query.filter_by(card_id=card_id).first()
                    if not student:
                        failed_count += 1
                        failed_messages.append(f'学号{card_id}不存在')
                        continue
                    
                    existing_score = Score.query.filter_by(
                        exam_id=exam_id,
                        student_id=student.id,
                        subject=subject
                    ).first()
                    
                    if existing_score:
                        existing_score.score = score_val
                        existing_score.status = 'pending'
                    else:
                        score = Score(
                            exam_id=exam_id,
                            student_id=student.id,
                            subject=subject,
                            score=score_val,
                            full_score=100,
                            status='pending',
                            entered_by=entered_by
                        )
                        db.session.add(score)
                    
                    success_count += 1
                except Exception as e:
                    failed_count += 1
                    failed_messages.append(str(e))
            
            db.session.commit()
            
            return jsonify({
                'code': 0,
                'data': {
                    'success_count': success_count,
                    'failed_count': failed_count,
                    'failed_messages': failed_messages
                },
                'message': f'导入完成，成功{success_count}条，失败{failed_count}条'
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({'code': -1, 'message': str(e)})

@ns_score_analysis.route('/class/<int:class_id>')
class ClassAnalysis(Resource):
    @ns_score_analysis.doc('class_analysis')
    def get(self, class_id):
        """班级成绩分析"""
        try:
            exam_id = request.args.get('exam_id', type=int)
            
            query = Score.query.join(Exam).join(User)
            query = query.filter(User.class_name == ClassInfo.query.get(class_id).name)
            
            if exam_id:
                query = query.filter(Score.exam_id == exam_id)
            
            scores = query.all()
            
            if not scores:
                return jsonify({'code': 0, 'data': {}, 'message': '没有成绩数据'})
            
            # 按科目分组统计
            subject_stats = {}
            for score in scores:
                if score.subject not in subject_stats:
                    subject_stats[score.subject] = []
                if score.score is not None:
                    subject_stats[score.subject].append(score.score)
            
            result = {}
            for subject, score_list in subject_stats.items():
                if not score_list:
                    continue
                avg_score = sum(score_list) / len(score_list)
                max_score = max(score_list)
                min_score = min(score_list)
                pass_count = sum(1 for s in score_list if s >= 60)
                excellent_count = sum(1 for s in score_list if s >= 90)
                
                result[subject] = {
                    'count': len(score_list),
                    'average': round(avg_score, 2),
                    'max': max_score,
                    'min': min_score,
                    'pass_rate': round(pass_count / len(score_list) * 100, 2),
                    'excellent_rate': round(excellent_count / len(score_list) * 100, 2),
                    'scores': score_list
                }
            
            return jsonify({'code': 0, 'data': result, 'message': 'success'})
        except Exception as e:
            return jsonify({'code': -1, 'message': str(e)})

@ns_score_analysis.route('/student/<int:student_id>')
class StudentAnalysis(Resource):
    @ns_score_analysis.doc('student_analysis')
    def get(self, student_id):
        """学生成绩分析"""
        try:
            scores = Score.query.filter_by(student_id=student_id).all()
            
            if not scores:
                return jsonify({'code': 0, 'data': {}, 'message': '没有成绩数据'})
            
            # 按考试分组
            exam_scores = {}
            for score in scores:
                if score.exam_id not in exam_scores:
                    exam_scores[score.exam_id] = {
                        'exam_name': score.exam.name if score.exam else '',
                        'exam_date': score.exam.start_time.isoformat() if score.exam else '',
                        'scores': {}
                    }
                if score.score is not None:
                    exam_scores[score.exam_id]['scores'][score.subject] = {
                        'score': score.score,
                        'full_score': score.full_score,
                        'rank': score.rank
                    }
            
            result = {
                'student_id': student_id,
                'student_name': scores[0].student.name if scores[0].student else '',
                'exam_scores': exam_scores
            }
            
            return jsonify({'code': 0, 'data': result, 'message': 'success'})
        except Exception as e:
            return jsonify({'code': -1, 'message': str(e)})

@ns_score_analysis.route('/exam/<int:exam_id>')
class ExamAnalysis(Resource):
    @ns_score_analysis.doc('exam_analysis')
    def get(self, exam_id):
        """考试成绩分析"""
        try:
            scores = Score.query.filter_by(exam_id=exam_id).all()
            
            if not scores:
                return jsonify({'code': 0, 'data': {}, 'message': '没有成绩数据'})
            
            # 按科目统计
            subject_stats = {}
            for score in scores:
                if score.subject not in subject_stats:
                    subject_stats[score.subject] = []
                if score.score is not None:
                    subject_stats[score.subject].append(score.score)
            
            exam = Exam.query.get(exam_id)
            
            result = {
                'exam_id': exam_id,
                'exam_name': exam.name if exam else '',
                'subject_stats': {},
                'overall': {}
            }
            
            all_scores = []
            for subject, score_list in subject_stats.items():
                if not score_list:
                    continue
                avg_score = sum(score_list) / len(score_list)
                pass_count = sum(1 for s in score_list if s >= 60)
                
                result['subject_stats'][subject] = {
                    'count': len(score_list),
                    'average': round(avg_score, 2),
                    'max': max(score_list),
                    'min': min(score_list),
                    'pass_rate': round(pass_count / len(score_list) * 100, 2)
                }
                all_scores.extend(score_list)
            
            if all_scores:
                result['overall'] = {
                    'total_students': len(set(s.student_id for s in scores)),
                    'total_scores': len(all_scores),
                    'overall_average': round(sum(all_scores) / len(all_scores), 2),
                    'pass_rate': round(sum(1 for s in all_scores if s >= 60) / len(all_scores) * 100, 2),
                    'excellent_rate': round(sum(1 for s in all_scores if s >= 90) / len(all_scores) * 100, 2)
                }
            
            return jsonify({'code': 0, 'data': result, 'message': 'success'})
        except Exception as e:
            return jsonify({'code': -1, 'message': str(e)})

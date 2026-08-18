"""学生自助端接口

提供学生凭卡号(card_id) + 姓名双因子登录，并查询自己的积分与流水。
与 Admin 体系完全隔离：
- 登录签发 type=student 的 JWT（utils.security.generate_student_token）
- 受保护端点使用 utils.permission.requires_student 校验
- 即使学生令牌误发到 Admin 端点，也会被 requires_permission 的 type=access 校验拒绝
"""
from flask_restx import Namespace, Resource, fields
from flask import request, g
from datetime import datetime
from models import User, ScoreRecord, Notification, Approval
from utils.security import generate_student_token, validate_card_id
from utils.permission import requires_student
from utils.response import APIResponse
from utils.logger import log_login_attempt
from utils.datetime_utils import parse_date
from api.system.security_routes import check_login_rate_limit, record_failed_login, clear_login_attempts
from services.attendance_service import attendance_service
from services.engagement_service import calculate_engagement, EngagementService
from services.risk_predict_service import RiskPredictService
from services import phonebox_policy
from services.mqtt_service import publish_mqtt
from services.analysis_service import analysis_service

ns_student = Namespace("student", description="学生自助端接口")

login_model = ns_student.model(
    "StudentLoginRequest",
    {
        "card_id": fields.String(required=True, description="学号/卡号"),
        "name": fields.String(required=True, description="姓名"),
    },
)


def _serialize_student(user: User) -> dict:
    """将学生对象规整为可 JSON 序列化的字典（班级名优先取关联 ClassInfo）。"""
    class_info = getattr(user, "class_info", None)
    class_name = class_info.name if class_info else getattr(user, "class_name", None)
    return {
        "id": user.id,
        "name": user.name,
        "card_id": user.card_id,
        "gender": getattr(user, "gender", None),
        "class_info_id": user.class_info_id,
        "class_name": class_name,
        "current_score": user.current_score,
        "is_active": user.is_active,
    }


@ns_student.route("/login")
class StudentLogin(Resource):
    @ns_student.doc("student_login", description="学生登录（卡号+姓名双因子）")
    @ns_student.expect(login_model)
    def post(self):
        """学生登录接口。

        请求体：
        - card_id: 学号/卡号（必填）
        - name: 姓名（必填，作为第二因子防止误用他人卡号）

        返回：
        - data.access_token: 学生 JWT
        - data.expires_in: 过期秒数
        - data.student: 学生基本信息
        """
        data = request.get_json() or {}
        card_id = (data.get("card_id") or "").strip()
        name = (data.get("name") or "").strip()
        ip_address = request.remote_addr

        if not card_id or not name:
            return APIResponse.bad_request(message="请提供学号与姓名")
        if not validate_card_id(card_id):
            return APIResponse.bad_request(message="学号格式不正确，需为 4-20 位字母或数字")

        is_allowed, message, retry_after = check_login_rate_limit(card_id, ip_address)
        if not is_allowed:
            return APIResponse.rate_limit(message=message, retry_after=retry_after)

        user = User.query.filter_by(card_id=card_id, is_active=True).first()
        if not user or user.name != name:
            record_failed_login(card_id, ip_address)
            log_login_attempt(card_id, success=False, reason="学号或姓名不匹配")
            return APIResponse.unauthorized(message="学号或姓名不匹配")

        clear_login_attempts(card_id)
        token_data = generate_student_token(user.id, user.name, user.card_id)
        log_login_attempt(card_id, success=True)

        return APIResponse.success(
            data={
                "access_token": token_data["token"],
                "expires_in": token_data["expires_in"],
                "student": _serialize_student(user),
            },
            message="登录成功",
        )


@ns_student.route("/me")
class StudentMe(Resource):
    @ns_student.doc("student_me", description="获取当前登录学生信息")
    @requires_student
    def get(self):
        """获取当前登录学生基本信息。"""
        return APIResponse.success(data=_serialize_student(g.current_student))


@ns_student.route("/score")
class StudentScore(Resource):
    @ns_student.doc("student_score", description="获取当前学生积分")
    @requires_student
    def get(self):
        """获取当前学生的当前积分。"""
        student = g.current_student
        return APIResponse.success(
            data={
                "current_score": student.current_score,
                "name": student.name,
                "card_id": student.card_id,
            }
        )


@ns_student.route("/records")
class StudentRecords(Resource):
    @ns_student.doc("student_records", description="获取当前学生积分流水（分页）")
    @requires_student
    def get(self):
        """获取当前学生的积分流水，按时间倒序分页返回。"""
        student = g.current_student
        page = request.args.get("page", 1, type=int)
        if page is None or page < 1:
            page = 1
        # F10 修复: 原嵌套 get(type=int) 在 per_page/page_size 非数字时返回 None → min() 抛 TypeError
        raw_per = request.args.get("per_page") or request.args.get("page_size") or 20
        try:
            page_size = max(1, min(int(raw_per), 100))
        except (TypeError, ValueError):
            page_size = 20

        query = ScoreRecord.query.filter_by(student_id=student.id)
        total = query.count()
        items = (
            query.order_by(ScoreRecord.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )

        data = [
            {
                "id": r.id,
                "score_change": r.score_change,
                "description": r.description,
                "operator": r.operator,
                "rule_id": r.rule_id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in items
        ]

        return APIResponse.success(APIResponse.pagination(data, page, page_size, total))


def _serialize_notification(n: Notification) -> dict:
    return {
        "id": n.id,
        "user_id": n.student_id,
        "student_id": n.student_id,
        "title": n.title,
        "content": n.content,
        "type": n.type,
        "status": n.status,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


def _serialize_leave(leave: Approval) -> dict:
    return {
        "id": leave.id,
        "student_id": leave.student_id,
        "leave_type": leave.leave_type,
        "start_date": leave.start_date.isoformat() if leave.start_date else None,
        "end_date": leave.end_date.isoformat() if leave.end_date else None,
        "reason": leave.description,
        "status": leave.status,
        "approved_at": leave.approve_time.isoformat() if leave.approve_time else None,
        "created_at": leave.created_at.isoformat() if leave.created_at else None,
    }


leave_apply_model = ns_student.model(
    "StudentLeaveApply",
    {
        "leave_type": fields.String(required=False, description="请假类型（如 sick/personal）"),
        "start_date": fields.String(required=True, description="开始日期 YYYY-MM-DD"),
        "end_date": fields.String(required=True, description="结束日期 YYYY-MM-DD"),
        "reason": fields.String(required=False, description="请假事由"),
    },
)


@ns_student.route("/notifications")
class StudentNotifications(Resource):
    @ns_student.doc("student_notifications", description="获取当前学生的通知（分页）")
    @requires_student
    def get(self):
        """获取当前学生收到的通知，按时间倒序分页返回。"""
        student = g.current_student
        page = request.args.get("page", 1, type=int)
        if page is None or page < 1:
            page = 1
        # F10 修复: 原嵌套 get(type=int) 在 per_page/page_size 非数字时返回 None → min() 抛 TypeError
        raw_per = request.args.get("per_page") or request.args.get("page_size") or 20
        try:
            page_size = max(1, min(int(raw_per), 100))
        except (TypeError, ValueError):
            page_size = 20

        query = Notification.query.filter_by(student_id=student.id)
        total = query.count()
        items = (
            query.order_by(Notification.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        data = [_serialize_notification(n) for n in items]
        return APIResponse.success(APIResponse.pagination(data, page, page_size, total))


@ns_student.route("/leaves")
class StudentLeaves(Resource):
    @ns_student.doc("student_list_leaves", description="获取当前学生的请假申请")
    @requires_student
    def get(self):
        """列出当前学生提交的全部请假申请，按开始日期倒序。"""
        student = g.current_student
        leaves = (
            Approval.query.filter_by(student_id=student.id, type="leave")
            .order_by(Approval.start_date.desc())
            .all()
        )
        return APIResponse.success(data=[_serialize_leave(lv) for lv in leaves])

    @ns_student.expect(leave_apply_model)
    @requires_student
    def post(self):
        """提交一条请假申请（student_id 自动绑定当前登录学生）。"""
        student = g.current_student
        data = request.get_json() or {}
        start_raw = (data.get("start_date") or "").strip()
        end_raw = (data.get("end_date") or "").strip()

        if not start_raw or not end_raw:
            return APIResponse.bad_request(message="请填写开始日期与结束日期")
        try:
            start_date = parse_date(start_raw)
            end_date = parse_date(end_raw)
        except (ValueError, TypeError):
            return APIResponse.bad_request(message="日期格式应为 YYYY-MM-DD")
        # parse_date 对无法解析的输入返回 None（而非抛异常），需显式拦截
        if start_date is None or end_date is None:
            return APIResponse.bad_request(message="日期格式应为 YYYY-MM-DD")

        if start_date > end_date:
            return APIResponse.bad_request(message="结束日期不能早于开始日期")

        payload = {
            "student_id": student.id,
            "leave_type": data.get("leave_type") or "personal",
            "start_date": start_raw,
            "end_date": end_raw,
            "reason": data.get("reason"),
        }
        try:
            result, _ = attendance_service.apply_leave(payload)
        except Exception as e:  # 防御：服务层意外异常不泄露内部信息
            return APIResponse.error(message="提交失败，请稍后重试", status_code=400)
        leave = Approval.query.get(result["data"]["id"])
        return APIResponse.success(
            data=_serialize_leave(leave) if leave else result["data"],
            message="请假申请已提交，等待审批",
            status_code=201,
        )


_UNLOCK_REASON_TEXT = {
    "card_not_found": "未找到该学生",
    "user_inactive": "账号已停用",
    "user_blacklisted": "当前处于禁用期",
    "user_permanently_blacklisted": "已被永久禁用",
    "score_low": "积分不足",
    "weekly_limit_exceeded": "本周开箱次数已达上限",
    "daily_limit_exceeded": "今日开箱次数已达上限",
    "not_in_time_window": "当前不在允许开箱时段",
}


def _unlock_reason_text(reason):
    """UnlockValidator 原因码 → 用户可读中文（未知码原样返回）。"""
    if not reason:
        return "未知原因"
    return _UNLOCK_REASON_TEXT.get(reason, reason)


@ns_student.route("/phonebox/unlock")
class StudentPhoneboxUnlock(Resource):
    @ns_student.doc("student_phonebox_unlock", description="学生自助申请手机箱开箱")
    def post(self):
        """依据本班手机箱策略判定是否允许开箱；允许则下发 MQTT 开箱指令（最佳努力）。

        判定来源：services.phonebox_policy.evaluate（班主任按班级配置）。
        - allow_override / allow_window -> 允许，下发 phonebox/unlock/A 与 /B
        - block   -> 班主任已关闭本班自助开箱
        - defer   -> 本班未配置策略，需由老师远程开箱
        """
        student = g.current_student
        class_info_id = getattr(student, "class_info_id", None)
        evaluation = phonebox_policy.evaluate(class_info_id)
        decision = evaluation.get("decision")

        allowed = decision in (
            phonebox_policy.POLICY_ALLOW_OVERRIDE,
            phonebox_policy.POLICY_ALLOW_WINDOW,
        )
        dispatched = False
        unlock_block_reason = None
        if allowed:
            # R2 修复: 门户开箱与刷卡走同一校验/记账（原实现只发空载荷——不扣分/不记账/不累计，
            # 与刷卡扣分激励不一致；且限额/黑名单从未执行）
            from services.unlock_validator import UnlockValidator

            v_allowed, v_reason, v_info = UnlockValidator.validate_unlock(
                student.card_id, skip_time_window=True
            )
            if not v_allowed:
                # 班主任策略放行但学生资格不满足（黑名单/分数不足/日/周限额）→ 拒绝并如实返回原因
                allowed = False
                unlock_block_reason = v_reason
            else:
                # 扣分 + 日/周计数 + 流水"开锁扣分"（record_unlock 内部 commit）
                UnlockValidator.record_unlock(student)
                for box in ("A", "B"):
                    try:
                        # F11 修复: 校验 publish_mqtt 返回值——返回 False（连接不可用但不抛异常）时不得置 dispatched
                        if publish_mqtt(f"phonebox/unlock/{box}", ""):
                            dispatched = True
                    except Exception:
                        # MQTT 不可用时不阻断请求，仅标记未下发
                        pass

        return APIResponse.success(
            data={
                "allowed": allowed,
                "decision": decision,
                "reason": unlock_block_reason or evaluation.get("reason"),
                "override_until": evaluation.get("override_until"),
                "dispatched": dispatched,
            },
            message=(
                "开箱指令已下发" if allowed
                else (
                    "开箱请求被拒绝：" + _unlock_reason_text(unlock_block_reason)
                    if unlock_block_reason
                    else ("班主任已关闭本班自助开箱" if decision == phonebox_policy.POLICY_BLOCK
                          else "本班暂未开放自助开箱，请联系老师")
                )
            ),
            status_code=200 if allowed else 403,
        )


@ns_student.route("/rank")
class StudentRank(Resource):
    @ns_student.doc("student_rank", description="获取当前学生所在班级的积分排名（含本人名次）")
    @requires_student
    def get(self):
        """返回当前学生所在班级的积分排行榜，并标出本人名次。

        复用 analysis_service.get_student_ranking 按班级聚合；名次由列表下标+1 计。
        """
        student = g.current_student
        class_info = getattr(student, "class_info", None)
        class_name = class_info.name if class_info else getattr(student, "class_name", None)
        if not class_name:
            return APIResponse.success(
                data={
                    "class_name": None,
                    "my_rank": None,
                    "my_score": student.current_score,
                    "total_students": 1,
                    "ranking": [],
                }
            )
        result = analysis_service.get_student_ranking(
            class_name=class_name, sort_by="score", order="desc", limit=50
        )
        ranking = result.get("ranking", [])
        my_rank = None
        for idx, item in enumerate(ranking, 1):
            if item.get("user_id") == student.id:
                my_rank = idx
                break
        return APIResponse.success(
            data={
                "class_name": class_name,
                "my_rank": my_rank,
                "my_score": student.current_score,
                "total_students": result.get("total_students"),
                "ranking": ranking,
            }
        )


def _build_score_trend(user_id, weeks):
    """近 weeks 周该生积分变动按周分组（内存聚合，规避 SQL 日期边界）。

    直接拉取该生全部 ScoreRecord 后在内存按「今天」为锚点分桶，
    避免 SQLite 下 DateTime 列与 date 边界比较的不一致。
    """
    from datetime import date as _date
    from collections import defaultdict

    today = datetime.now().date()
    recs = ScoreRecord.query.filter_by(student_id=user_id).all()
    week_map = defaultdict(float)
    for r in recs:
        ca = r.created_at
        if ca is None:
            continue
        if isinstance(ca, datetime):
            d = ca.date()
        elif isinstance(ca, _date):
            d = ca
        else:
            try:
                d = datetime.strptime(str(ca)[:10], "%Y-%m-%d").date()
            except Exception:
                continue
        diff = (today - d).days
        if diff < 0 or diff >= weeks * 7:
            continue
        wk = weeks - 1 - (diff // 7)
        try:
            week_map[wk] += float(r.score_change or 0)
        except (TypeError, ValueError):
            continue
    return [
        {
            "week_index": int(i + 1),
            "score_change": round(float(week_map.get(i, 0.0)), 2),
        }
        for i in range(weeks)
    ]


@ns_student.route("/insights")
class StudentInsights(Resource):
    @ns_student.doc("student_insights", description="获取当前学生的算法洞察聚合（参与度+风险+积分趋势）")
    @ns_student.param("days", "参与度/风险统计天数，默认30")
    @ns_student.param("weeks", "积分趋势周数，默认8")
    @requires_student
    def get(self):
        """将算法洞察反推到学生自助端：聚合「参与度指数 + 风险预测 + 近周积分趋势」。

        全部复用既有服务（engagement_service / risk_predict_service），单维异常隔离，
        不影响其余维度返回；所有数值均为原生类型，避免 numpy 类型 JSON 序列化失败。
        """
        student = g.current_student
        try:
            days = int(request.args.get("days", 30))
        except (TypeError, ValueError):
            days = 30
        try:
            weeks = max(int(request.args.get("weeks", 8)), 1)
        except (TypeError, ValueError):
            weeks = 8
        uid = student.id

        # 参与度
        try:
            engagement = calculate_engagement(uid, days)
        except Exception as e:  # noqa: BLE001
            # 诚实失败：error 标记 + 数值置 None（前端即使忽略 error，也不会误读为"低参与度 0 分"）
            engagement = {"has_data": False, "engagement_score": None, "level": None, "error": "参与度计算失败: %s" % e}

        # 风险
        try:
            risk = RiskPredictService.predict_risk(uid, days)
        except Exception as e:  # noqa: BLE001
            risk = {"overall_risk_level": None, "overall_risk_score": None, "error": "风险评估失败: %s" % e}

        # 积分趋势
        try:
            score_trend = _build_score_trend(uid, weeks)
        except Exception:  # noqa: BLE001
            score_trend = []

        # 参与度周趋势（复用 weekly_trend，与算法 Tab 同口径）
        try:
            participation_trend = EngagementService.weekly_trend(uid, weeks)
        except Exception as e:  # noqa: BLE001
            participation_trend = {"user_id": uid, "weeks": weeks, "trend": None, "series": [], "error": "参与度周趋势计算失败: %s" % e}

        return APIResponse.success(
            data={
                "student": _serialize_student(student),
                "engagement": engagement,
                "risk": risk,
                "score_trend": score_trend,
                "participation_trend": participation_trend,
                "days": days,
                "weeks": weeks,
            }
        )

from flask import Blueprint, jsonify
from flask_restx import Api

import logging

logger = logging.getLogger(__name__)


class APIVersionManager:

    def __init__(self):
        self.versions = {}
        self._default_version = "v1"

    def register_version(self, version, routes_func):
        self.versions[version] = routes_func

    def reset(self):
        self.versions = {}
        self.register_version("v1", register_v1_routes)

    def init_app(self, app, register_default=True):
        for version, routes_func in self.versions.items():
            bp = Blueprint(f"api_{version}", __name__, url_prefix=f"/api/{version}")
            api = Api(
                bp,
                version=version,
                title=f"积分管理平台 API v{version}",
                description=f"积分管理平台 RESTful API v{version}",
                doc=f"/api/{version}/docs/",
                default_mediatype="application/json",
            )
            routes_func(api, app)
            app.register_blueprint(bp)

            if register_default and version == self._default_version:
                bp_default = Blueprint("api_default", __name__, url_prefix="/api")
                api_default = Api(
                    bp_default,
                    version=version,
                    title="积分管理平台 API",
                    description="积分管理平台 RESTful API",
                    doc="/api/docs/",
                    default_mediatype="application/json",
                )
                routes_func(api_default, app)
                app.register_blueprint(bp_default)

        @app.route("/api/versions")
        def list_versions():
            return jsonify(
                {"versions": list(self.versions.keys()), "current": "v1", "latest": "v1"}
            )

        @app.route("/api")
        def api_root():
            return jsonify(
                {
                    "message": "积分管理平台 API",
                    "versions": [f"/api/{v}" for v in self.versions.keys()],
                    "docs": [f"/api/{v}/docs/" for v in self.versions.keys()],
                }
            )


api_version_manager = APIVersionManager()


def register_v1_routes(api, app):
    from api.auth.auth_routes import ns_auth

    api.add_namespace(ns_auth)

    from api.users.users_routes import ns_users
    from api.users.user_management_routes import ns_user_management
    from api.users.rbac_routes import ns_rbac
    from api.users.permission_logs_routes import ns_permission_logs

    api.add_namespace(ns_users)
    api.add_namespace(ns_user_management)
    api.add_namespace(ns_rbac)
    api.add_namespace(ns_permission_logs)

    from api.scores.records_routes import ns_records
    from api.scores.rules_routes import ns_rules
    from api.scores.categories_routes import ns_score_categories
    from api.scores.approvals_routes import ns_approvals
    from api.scores.rank_routes import ns_rank
    from api.scores.remote_notify_routes import ns_remote_notify
    from api.scores.time_rules_routes import ns_time_rules
    from api.scores.class_periods_routes import ns_class_periods
    from api.scores.notify_template_routes import ns_notify_template
    from api.scores.scheduled_notify_routes import ns_scheduled_notify
    from api.scores.notify_history_routes import ns_notify_history

    api.add_namespace(ns_records)
    api.add_namespace(ns_rules)
    api.add_namespace(ns_score_categories)
    api.add_namespace(ns_approvals)
    api.add_namespace(ns_rank)
    api.add_namespace(ns_remote_notify)
    api.add_namespace(ns_time_rules)
    api.add_namespace(ns_class_periods)
    api.add_namespace(ns_notify_template)
    api.add_namespace(ns_scheduled_notify)
    api.add_namespace(ns_notify_history)

    from api.devices.devices_routes import ns_devices
    from api.devices.device_group_routes import ns_device_group
    from api.devices.box_routes import ns_box
    from api.devices.wol_routes import ns_wol
    from api.devices.firmware_routes import ns_firmware

    api.add_namespace(ns_devices)
    api.add_namespace(ns_device_group)
    api.add_namespace(ns_box)
    api.add_namespace(ns_wol)
    api.add_namespace(ns_firmware)

    from api.data.export_routes import ns_export
    from api.data.import_export_routes import ns_import_export

    api.add_namespace(ns_export)
    api.add_namespace(ns_import_export)

    # 文件下载蓝图（普通 Blueprint，需独立注册）
    try:
        from api.data.download_routes import download_bp

        # 开发模式 debug reloader 会执行两次 create_app → 第二次注册名冲突。
        # 幂等注册：已注册则跳过（此前 except: pass 吞掉冲突，路由实际已在首次注册成功）
        if "download" not in app.blueprints:
            app.register_blueprint(download_bp)
    except Exception as e:
        # 注册失败静默 = 路由静默 404（此前 FTS except:pass 吞 NameError 的教训）
        logger.warning(f"download_bp 注册失败: {e}")

    from api.monitoring.notifications_routes import ns_notifications
    from api.monitoring.alerts_routes import ns_alerts
    from api.monitoring.operation_logs_routes import ns_operation_logs
    from api.monitoring.mqtt_routes import ns_mqtt

    api.add_namespace(ns_notifications)
    api.add_namespace(ns_alerts)
    api.add_namespace(ns_operation_logs)
    api.add_namespace(ns_mqtt)

    from api.academics.classes_routes import ns_classes
    from api.academics.admin_classes_routes import ns_admin_classes
    from api.academics.subject_routes import ns_subjects
    from api.academics.exam_routes import ns_exam, ns_scores, ns_score_analysis
    from api.academics.exam_import_routes import ns_exam_import
    from api.academics.course_schedule_routes import ns_course_schedule
    from api.academics.import_routes import ns_import

    api.add_namespace(ns_classes)
    api.add_namespace(ns_admin_classes)
    api.add_namespace(ns_subjects)
    api.add_namespace(ns_exam)
    api.add_namespace(ns_scores)
    api.add_namespace(ns_score_analysis)
    api.add_namespace(ns_exam_import)
    api.add_namespace(ns_course_schedule)
    api.add_namespace(ns_import)

    from api.system.system_routes import ns_system
    from api.system.admins_routes import ns_admins
    from api.system.security_routes import ns_security
    from api.system.notification_config_routes import ns_notification_config
    from api.system.admin_notifications_routes import ns_admin_notifications
    from api.system.consistency_routes import ns_consistency

    api.add_namespace(ns_system)
    api.add_namespace(ns_admins)
    api.add_namespace(ns_security)
    api.add_namespace(ns_notification_config)
    api.add_namespace(ns_admin_notifications)
    api.add_namespace(ns_consistency)

    from api.analytics.dashboard_routes import ns_dashboard
    from api.algorithm.algorithm_routes import ns_algorithm
    from api.analytics.analysis_routes import ns_analysis
    from api.nlp.nlp_routes import ns_nlp

    api.add_namespace(ns_dashboard)
    api.add_namespace(ns_algorithm)
    api.add_namespace(ns_analysis)
    api.add_namespace(ns_nlp)

    # 班主任工作台路由
    from api.class_management.seating_routes import ns_seating
    from api.class_management.duty_routes import ns_duty
    from api.class_management.committee_routes import ns_committee
    from api.class_management.parent_routes import ns_parent
    from api.class_management.homework_routes import ns_homework
    from api.class_management.attendance_routes import ns_attendance
    from api.class_management.study_group_routes import ns_study_group
    from api.class_management.mental_health_routes import ns_mental_health
    from api.class_management.activity_routes import ns_activity
    from api.class_management.culture_routes import ns_culture
    from api.class_management.study_guide_routes import ns_study_guide

    api.add_namespace(ns_seating, path="/seating")
    api.add_namespace(ns_duty, path="/duty")
    api.add_namespace(ns_committee, path="/committee")
    api.add_namespace(ns_parent, path="/parent")
    api.add_namespace(ns_homework, path="/homework")
    api.add_namespace(ns_attendance, path="/attendance")
    api.add_namespace(ns_study_group, path="/study-group")
    api.add_namespace(ns_mental_health, path="/mental-health")
    api.add_namespace(ns_activity, path="/activity")
    api.add_namespace(ns_culture, path="/culture")
    api.add_namespace(ns_study_guide, path="/study-guide")

    # 班主任手机箱开箱策略（按班级，由班主任自由决定）
    from api.phonebox.phonebox_policy_routes import ns_phonebox_policy

    api.add_namespace(ns_phonebox_policy, path="/phonebox-policy")

    try:
        from api.system.diagnostics_routes import ns_diagnostics

        api.add_namespace(ns_diagnostics)
    except Exception as e:
        logger.warning(f"diagnostics 命名空间注册失败: {e}")

    # 角色与权限相关命名空间（已迁移至 api.users 包）
    try:
        from api.users.sub_accounts_routes import ns_sub_accounts

        api.add_namespace(ns_sub_accounts)
    except Exception as e:
        logger.warning(f"sub_accounts 命名空间注册失败: {e}")
    try:
        from api.users.role_permissions_routes import ns_role_permissions

        api.add_namespace(ns_role_permissions)
    except Exception as e:
        logger.warning(f"role_permissions 命名空间注册失败: {e}")

    # 学生自助端 / 学期报告导出 / 积分排行榜：补齐生产环境路由（route_init.py 已删除，本函数是唯一注册源）
    from api.student.student_routes import ns_student
    from api.reports.report_routes import ns_reports
    from api.rank.rank_routes import ns_rank as ns_rank_board

    api.add_namespace(ns_student)
    api.add_namespace(ns_reports)
    api.add_namespace(ns_rank_board)

    # 系统运维蓝图（migration / version）：补注册，修复此前生产环境 404
    try:
        from api.system.migration_routes import migration_bp
        from api.system.version_routes import version_bp

        # 幂等注册（开发模式 reloader 两次 create_app 会重复注册）
        if "migration" not in app.blueprints:
            app.register_blueprint(migration_bp)
        if "version" not in app.blueprints:
            app.register_blueprint(version_bp)
    except Exception as e:
        logger.warning(f"migration/version 蓝图注册失败: {e}")


api_version_manager.register_version("v1", register_v1_routes)

# ============================================================
# DEPRECATED: 此文件注册的命名空间为 legacy 版本。
# 当前运行时（run.py → app/__init__.py → api_versioning.py）
# 使用的是 api/ 目录下的现代命名空间，此处的 register_routes()
# 仅在 app.py（已不再使用）中被调用。
#
# 请勿在此添加新路由！新路由应添加到 api/ 目录并通过
# app/api_versioning.py::register_v1_routes() 注册。
#
# 保留此文件仅用于向后兼容的独立引用。
# ============================================================
from flask_restx import Api


def register_routes(app):
    api = Api(
        app,
        version="1.0",
        title="积分管理平台 API",
        description="积分管理平台的 RESTful API 文档。",
        doc="/api/docs/",
        prefix="/api",
    )

    from routes.users_routes import ns_users
    from routes.rules_routes import ns_rules
    from routes.records_routes import ns_records
    from routes.categories_routes import ns_categories
    from routes.rank_routes import ns_rank
    from routes.mqtt_routes import ns_mqtt
    from routes.export_routes import ns_export
    from routes.import_export_routes import ns_import_export
    from routes.admins_routes import ns_admins
    from routes.auth_routes import ns_auth
    from routes.notifications_routes import ns_notifications
    from routes.approvals_routes import ns_approvals
    from routes.time_rules_routes import ns_time_rules
    from routes.devices_routes import ns_devices
    from routes.system_routes import ns_system
    from routes.roles_routes import ns_roles
    from routes.classes_routes import ns_classes
    from routes.sub_accounts_routes import ns_sub_accounts
    from routes.dashboard_routes import ns_dashboard
    from routes.operation_logs_routes import ns_operation_logs
    from routes.role_permissions_routes import ns_role_permissions
    from routes.permission_logs_routes import ns_permission_logs
    from routes.admin_classes_routes import ns_admin_classes
    from routes.analysis_routes import ns_analysis
    from routes.box_routes import ns_box
    from routes.alerts_routes import ns_alerts
    from routes.user_management_routes import ns_user_management
    from routes.notification_config_routes import ns_notification_config
    from routes.firmware_routes import ns_firmware
    from routes.security_routes import ns_security
    from routes.exam_routes import ns_exam, ns_scores, ns_score_analysis
    from routes.exam_import_routes import ns_exam_import
    from routes.subject_routes import ns_subjects

    # 从 api/ 目录添加缺失的路由模块
    try:
        from api.scores.class_periods_routes import ns_class_periods
        api.add_namespace(ns_class_periods)
    except Exception as e:
        print(f"Warning: Failed to import ns_class_periods: {e}")

    try:
        from api.scores.categories_routes import ns_score_categories
        api.add_namespace(ns_score_categories)
    except Exception as e:
        print(f"Warning: Failed to import ns_score_categories: {e}")

    try:
        from api.academics.course_schedule_routes import ns_course_schedule
        api.add_namespace(ns_course_schedule)
    except Exception as e:
        print(f"Warning: Failed to import ns_course_schedule: {e}")

    try:
        from api.scores.notify_template_routes import ns_notify_template
        api.add_namespace(ns_notify_template)
    except Exception as e:
        print(f"Warning: Failed to import ns_notify_template: {e}")

    try:
        from api.class_management.seating_routes import ns_seating
        api.add_namespace(ns_seating)
    except Exception as e:
        print(f"Warning: Failed to import ns_seating: {e}")

    try:
        from api.class_management.activity_routes import ns_activity
        api.add_namespace(ns_activity)
    except Exception as e:
        print(f"Warning: Failed to import ns_activity: {e}")

    try:
        from api.class_management.duty_routes import ns_duty
        api.add_namespace(ns_duty)
    except Exception as e:
        print(f"Warning: Failed to import ns_duty: {e}")

    try:
        from api.class_management.committee_routes import ns_committee
        api.add_namespace(ns_committee)
    except Exception as e:
        print(f"Warning: Failed to import ns_committee: {e}")

    try:
        from api.class_management.parent_routes import ns_parent
        api.add_namespace(ns_parent)
    except Exception as e:
        print(f"Warning: Failed to import ns_parent: {e}")

    try:
        from api.class_management.homework_routes import ns_homework
        api.add_namespace(ns_homework)
    except Exception as e:
        print(f"Warning: Failed to import ns_homework: {e}")

    try:
        from api.class_management.attendance_routes import ns_attendance
        api.add_namespace(ns_attendance)
    except Exception as e:
        print(f"Warning: Failed to import ns_attendance: {e}")

    try:
        from api.class_management.study_group_routes import ns_study_group
        api.add_namespace(ns_study_group, path="/study-group")
    except Exception as e:
        print(f"Warning: Failed to import ns_study_group: {e}")

    try:
        from api.class_management.mental_health_routes import ns_mental_health
        api.add_namespace(ns_mental_health, path="/mental-health")
    except Exception as e:
        print(f"Warning: Failed to import ns_mental_health: {e}")

    try:
        from api.class_management.culture_routes import ns_culture
        api.add_namespace(ns_culture)
    except Exception as e:
        print(f"Warning: Failed to import ns_culture: {e}")

    try:
        from api.class_management.study_guide_routes import ns_study_guide
        api.add_namespace(ns_study_guide, path="/study-guide")
    except Exception as e:
        print(f"Warning: Failed to import ns_study_guide: {e}")

    try:
        from api.phonebox.phonebox_policy_routes import ns_phonebox_policy
        api.add_namespace(ns_phonebox_policy, path="/phonebox-policy")
    except Exception as e:
        print(f"Warning: Failed to import ns_phonebox_policy: {e}")

    try:
        from api.devices.device_group_routes import ns_device_group
        api.add_namespace(ns_device_group, path="/device-group")
    except Exception as e:
        print(f"Warning: Failed to import ns_device_group: {e}")

    # 添加管理员通知路由
    try:
        from api.system.admin_notifications_routes import ns_admin_notifications
        api.add_namespace(ns_admin_notifications, path="/admin-notifications")
    except Exception as e:
        print(f"Warning: Failed to import ns_admin_notifications: {e}")

    api.add_namespace(ns_users)
    api.add_namespace(ns_rules)
    api.add_namespace(ns_records)
    api.add_namespace(ns_categories)
    api.add_namespace(ns_rank)
    api.add_namespace(ns_mqtt)
    api.add_namespace(ns_export)
    api.add_namespace(ns_import_export)
    api.add_namespace(ns_admins)
    api.add_namespace(ns_auth)
    api.add_namespace(ns_notifications)
    api.add_namespace(ns_approvals)
    api.add_namespace(ns_time_rules)
    api.add_namespace(ns_devices)
    api.add_namespace(ns_system)
    api.add_namespace(ns_roles)
    api.add_namespace(ns_classes)
    api.add_namespace(ns_sub_accounts)
    api.add_namespace(ns_dashboard)
    api.add_namespace(ns_operation_logs)
    api.add_namespace(ns_role_permissions)
    api.add_namespace(ns_permission_logs)
    api.add_namespace(ns_admin_classes)
    api.add_namespace(ns_analysis)
    api.add_namespace(ns_box)
    api.add_namespace(ns_alerts)
    api.add_namespace(ns_user_management)
    api.add_namespace(ns_notification_config)
    api.add_namespace(ns_firmware)
    api.add_namespace(ns_security)
    api.add_namespace(ns_exam)
    api.add_namespace(ns_scores)
    api.add_namespace(ns_score_analysis)
    api.add_namespace(ns_exam_import)
    api.add_namespace(ns_subjects)

    return api

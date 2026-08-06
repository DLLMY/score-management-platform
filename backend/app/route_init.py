from flask_restx import Api
from flask import Blueprint, jsonify
from datetime import datetime


def init_routes(app):
    api = Api(
        app,
        version="1.0",
        title="积分管理平台 API",
        description="积分管理平台的 RESTful API 文档",
        doc="/api/docs/",
        prefix="/api",
        default_mediatype="application/json",
    )

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
    from api.data.download_routes import download_bp

    api.add_namespace(ns_export)
    api.add_namespace(ns_import_export)
    app.register_blueprint(download_bp)

    from api.monitoring.notifications_routes import ns_notifications
    from api.monitoring.alerts_routes import ns_alerts
    from api.monitoring.logs_routes import logs_bp
    from api.monitoring.operation_logs_routes import ns_operation_logs
    from api.monitoring.mqtt_routes import ns_mqtt
    from api.monitoring.mqtt_monitor_routes import mqtt_monitor_bp

    try:
        from api.monitoring.websocket_routes import ws_bp
    except (ImportError, AttributeError):
        ws_bp = Blueprint("websocket", __name__)
        ws_bp.register_error_handler(500, lambda e: None)
    api.add_namespace(ns_notifications)
    api.add_namespace(ns_alerts)
    app.register_blueprint(logs_bp)
    api.add_namespace(ns_operation_logs)
    api.add_namespace(ns_mqtt)
    app.register_blueprint(mqtt_monitor_bp)
    app.register_blueprint(ws_bp)

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
    from api.system.version_routes import version_bp
    from api.system.migration_routes import migration_bp
    from api.system.notification_config_routes import ns_notification_config
    from api.system.admin_notifications_routes import ns_admin_notifications
    from api.system.consistency_routes import ns_consistency
    from api.system.diagnostics_routes import ns_diagnostics

    api.add_namespace(ns_system)
    api.add_namespace(ns_admins)
    api.add_namespace(ns_security)
    app.register_blueprint(version_bp)
    app.register_blueprint(migration_bp)
    api.add_namespace(ns_notification_config)
    api.add_namespace(ns_admin_notifications)
    api.add_namespace(ns_consistency)
    api.add_namespace(ns_diagnostics)

    from api.dashboard_routes import ns_dashboard
    from api.prediction_routes import ns_prediction
    from api.anomaly_routes import ns_anomaly
    from api.risk_routes import ns_risk
    from api.rule_routes import ns_rule
    from api.composite_routes import ns_composite
    from api.analysis_routes import ns_analysis
    from api.nlp_routes import ns_nlp
    from api.algorithm_routes import ns_algorithm

    api.add_namespace(ns_dashboard)
    api.add_namespace(ns_prediction)
    api.add_namespace(ns_anomaly)
    api.add_namespace(ns_risk)
    api.add_namespace(ns_rule)
    api.add_namespace(ns_composite)
    api.add_namespace(ns_analysis)
    api.add_namespace(ns_nlp)
    api.add_namespace(ns_algorithm)

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

    app.api = api

    @app.route("/")
    def index():
        from flask import jsonify

        return jsonify({"message": "积分管理平台 API", "version": "1.0"})

    @app.route("/health")
    def health():

        return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

    @app.route("/test-auth")
    def test_auth():
        from flask import request

        auth_header = request.headers.get("Authorization")
        admin_id = request.headers.get("X-Admin-Id")
        return jsonify({"Authorization": auth_header, "X-Admin-Id": admin_id, "all_headers": dict(request.headers)})

    return api

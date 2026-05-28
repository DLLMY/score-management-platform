from flask_restx import Api

def register_routes(app):
    api = Api(app, version='1.0', title='积分管理平台 API',
              description='积分管理平台的 RESTful API 文档。',
              doc='/api/docs/',
              prefix='/api')
    
    from routes.users_routes import ns_users
    from routes.rules_routes import ns_rules
    from routes.records_routes import ns_records
    from routes.categories_routes import ns_categories
    from routes.rank_routes import ns_rank
    from routes.mqtt_routes import ns_mqtt
    from routes.export_routes import ns_export
    from routes.admins_routes import ns_admins
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
    
    api.add_namespace(ns_users)
    api.add_namespace(ns_rules)
    api.add_namespace(ns_records)
    api.add_namespace(ns_categories)
    api.add_namespace(ns_rank)
    api.add_namespace(ns_mqtt)
    api.add_namespace(ns_export)
    api.add_namespace(ns_admins)
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
    
    return api
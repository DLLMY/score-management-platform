from dependency_injector import containers, providers


class DIContainer(containers.DeclarativeContainer):
    config = providers.Configuration()

    notification_service = providers.Singleton("services.notification_service.NotificationService")

    redis_cache_service = providers.Singleton("services.redis_cache_service.RedisCacheService")

    alert_service = providers.Singleton("services.alert_service.AlertService")

    export_service = providers.Singleton("services.export_service.ExportService")

    class_service = providers.Singleton("services.class_service.ClassService")

    dashboard_service = providers.Singleton("services.dashboard_service.DashboardService")

    analysis_service = providers.Singleton("services.analysis_service.AnalysisService")

    unlock_validator = providers.Singleton("services.unlock_validator.UnlockValidator")

    mqtt_manager = providers.Singleton("services.mqtt_manager.MQTTManager")

    mqtt_message_service = providers.Singleton("services.mqtt_message_service.MQTTMessageService")

    mqtt_management_service = providers.Singleton("services.mqtt_management_service.MQTTManagementService")

    nlp_service = providers.Factory("services.nlp_service.get_nlp_service")

    nlp_algorithm_analyzer = providers.Singleton("services.nlp_analyzer_service.NLPAlgorithmAnalyzer")

    nlp_parser_service = providers.Singleton("services.nlp_parser_service.NLPParserService")

    nlp_rule_service = providers.Singleton("services.nlp_rule_service.NLPRuleManagementService")

    algorithm_service = providers.Singleton("services.algorithm_service.AlgorithmService")

    anomaly_service = providers.Singleton("services.anomaly_service.AnomalyService")

    prediction_service = providers.Singleton("services.prediction_service.PredictionService")

    reward_system = providers.Singleton("services.reward_service.RewardSystem")

    warning_service = providers.Singleton("services.warning_service.WarningService")

    score_predict_service = providers.Singleton("services.score_predict_service.ScorePredictService")

    risk_predict_service = providers.Singleton("services.risk_predict_service.RiskPredictService")

    composite_score_service = providers.Singleton("services.composite_score_service.CompositeScoreService")

    score_distribution_controller = providers.Singleton(
        "services.score_distribution_service.ScoreDistributionController"
    )

    rule_execution_engine = providers.Singleton("services.rule_engine_service.RuleExecutionEngine")

    rule_recommendation_service = providers.Singleton("services.rule_recommendation_service.RuleRecommendationService")

    data_sync_service = providers.Singleton("services.data_sync_service.DataSyncService")

    data_consistency_checker = providers.Singleton("services.data_consistency_checker.DataConsistencyChecker")

    system_config_service = providers.Singleton("services.system_config_service.SystemConfigService")


def init_container(app):
    container = DIContainer()
    container.init_resources()
    app.container = container
    return container


def get_container():
    from flask import current_app

    return current_app.container


def get_service(service_name):
    container = get_container()
    return getattr(container, service_name)()

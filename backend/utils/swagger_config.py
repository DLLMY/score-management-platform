from flasgger import Swagger, LazyString, LazyJSONEncoder
from flask import request

"""
Flasgger Swagger API文档增强配置
提供详细的API分类、模型定义和示例
"""


def get_swagger_config(app):
    """获取增强的Swagger配置"""
    app.json_encoder = LazyJSONEncoder
    swagger_template = {
        "swagger": "2.0",
        "info": {
            "title": "学生积分管理平台 API",
            "description": """
学生积分管理平台提供完整的RESTful API，支持以下功能模块：
- 用户登录/登出
- JWT令牌刷新
- CSRF保护
- 用户CRUD操作
- 用户搜索和筛选
- 批量操作
- 积分录入（自然语言/手动）
- 积分记录查询
- 积分统计分析
- 积分规则配置
- NLP规则匹配
- 规则推荐
- 设备状态监控
- MQTT通信
- 固件升级
- 统计分析
- 学生分群
- 风险预警
- 综合评分
- 系统配置
- 操作日志
- 权限管理
""",
            "version": "2.0.0",
            "contact": {"name": "开发团队", "email": "support@example.com"},
            "license": {"name": "MIT", "url": "https://opensource.org/licenses/MIT"},
        },
        "host": LazyString(lambda: request.host),
        "basePath": "/api",
        "schemes": LazyString(lambda: ["https"] if request.is_secure else ["http"]),
        "securityDefinitions": {
            "Bearer": {
                "type": "apiKey",
                "name": "Authorization",
                "in": "header",
                "description": "JWT令牌认证，格式: Bearer {token}",
            },
            "CookieAuth": {
                "type": "apiKey",
                "name": "access_token",
                "in": "cookie",
                "description": "Cookie中的JWT令牌",
            },
        },
        "security": [{"Bearer": []}, {"CookieAuth": []}],
        "tags": [
            {"name": "auth", "description": "认证相关接口 - 登录、登出、令牌刷新"},
            {"name": "users", "description": "用户管理接口 - CRUD、搜索、批量操作"},
            {"name": "scores", "description": "积分管理接口 - 录入、记录、统计"},
            {"name": "rules", "description": "规则管理接口 - 规则配置、匹配、推荐"},
            {"name": "nlp", "description": "NLP智能评分接口 - 自然语言解析、模型训练"},
            {"name": "devices", "description": "设备管理接口 - 状态监控、MQTT、固件"},
            {"name": "algorithm", "description": "算法分析接口 - 统计、分群、预警、评分"},
            {"name": "system", "description": "系统管理接口 - 配置、日志、权限"},
            {"name": "monitoring", "description": "监控接口 - WebSocket、MQTT监控、通知"},
        ],
        "definitions": {
            "User": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer", "description": "用户ID"},
                    "name": {"type": "string", "description": "用户姓名"},
                    "card_id": {"type": "string", "description": "卡号"},
                    "class_name": {"type": "string", "description": "班级"},
                    "current_score": {"type": "number", "description": "当前积分"},
                    "is_active": {"type": "boolean", "description": "是否活跃"},
                },
            },
            "ScoreRecord": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer", "description": "记录ID"},
                    "user_id": {"type": "integer", "description": "用户ID"},
                    "score_change": {"type": "number", "description": "积分变动"},
                    "description": {"type": "string", "description": "变动描述"},
                    "created_at": {"type": "string", "format": "date-time"},
                },
            },
            "ScoreRule": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer", "description": "规则ID"},
                    "name": {"type": "string", "description": "规则名称"},
                    "score": {"type": "number", "description": "积分值"},
                    "category_id": {"type": "integer", "description": "分类ID"},
                    "is_active": {"type": "boolean", "description": "是否启用"},
                },
            },
            "NLPParseResult": {
                "type": "object",
                "properties": {
                    "intent": {"type": "string", "enum": ["add", "deduct", "query", "unknown"]},
                    "name": {"type": "string", "description": "提取的姓名"},
                    "score": {"type": "number", "description": "积分值"},
                    "confidence": {"type": "number", "description": "置信度"},
                    "matched_rules": {"type": "array", "items": {"$re": "#/definitions/ScoreRule"}},
                },
            },
            "ErrorResponse": {
                "type": "object",
                "properties": {
                    "code": {"type": "integer", "description": "错误码"},
                    "message": {"type": "string", "description": "错误信息"},
                    "success": {"type": "boolean", "default": False},
                },
            },
            "SuccessResponse": {
                "type": "object",
                "properties": {
                    "code": {"type": "integer", "default": 0},
                    "message": {"type": "string", "default": "success"},
                    "success": {"type": "boolean", "default": True},
                    "data": {"type": "object"},
                },
            },
        },
        "paths": {},
    }
    swagger_config = {
        "headers": [],
        "specs": [
            {
                "endpoint": "api_spec",
                "route": "/api/spec",
                "rule_filter": lambda rule: True,
                "model_filter": lambda tag: True,
            }
        ],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        "specs_route": "/swagger/",
        "ui_params": {
            "docExpansion": "list",
            "defaultModelsExpandDepth": 2,
            "defaultModelExpandDepth": 2,
            "displayOperationId": False,
            "filter": True,
            "showExtensions": True,
            "showCommonExtensions": True,
            "tryItOutEnabled": True,
            "requestSnippetsEnabled": True,
            "persistAuthorization": True,
        },
    }
    return Swagger(app, template=swagger_template, config=swagger_config)


API_RESPONSE_MODELS = {
    "user_list": {
        "success": True,
        "data": {
            "users": [{"id": 1, "name": "张三", "card_id": "001", "class_name": "一班", "current_score": 85}],
            "pagination": {"page": 1, "per_page": 10, "total": 100},
        },
    },
    "nlp_parse": {
        "success": True,
        "data": {
            "intent": "add",
            "name": "张三",
            "score": 2,
            "confidence": 0.95,
            "matched_rules": [{"rule_id": 1, "behavior_keyword": "发言", "score_value": 2}],
        },
    },
    "score_statistics": {
        "success": True,
        "data": {
            "total_users": 100,
            "average_score": 75.5,
            "max_score": 100,
            "min_score": 30,
            "distribution": {"excellent": 15, "good": 40, "average": 30, "poor": 15},
        },
    },
}

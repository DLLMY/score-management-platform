import json
import traceback
import logging
from flask_restx import Namespace, Resource, fields
from services.mqtt_service import publish_mqtt, mqtt_logs, connect_mqtt, mqtt_manager
from services.mqtt_message_service import mqtt_message_service
from services.mqtt_management_service import mqtt_management_service
from utils.permission import requires_permission
from utils.api_cache_middleware import cached_api, invalidate_cache
from datetime import datetime
from utils.rate_limit import RateLimitStrategy
from utils.response import APIResponse

logger = logging.getLogger(__name__)


def get_flask_app():
    from app import app as flask_app

    return flask_app


def get_limiter():
    from app import limiter

    return limiter


def get_app_context():
    from app import app

    return app


ns_mqtt = Namespace("mqtt", description="MQTT related operations")

mqtt_config_model = ns_mqtt.model(
    "MQTTConfig",
    {
        "id": fields.Integer(readOnly=True, description="Config ID"),
        "broker": fields.String(description="MQTT Broker address"),
        "port": fields.Integer(description="Port"),
        "client_id": fields.String(description="Client ID"),
        "username": fields.String(description="Username"),
        "password": fields.String(description="Password"),
        "ssl": fields.Boolean(description="Enable SSL"),
        "timeout": fields.Integer(description="Timeout"),
        "keepalive": fields.Integer(description="Keepalive interval"),
    },
)

mqtt_publish_model = ns_mqtt.model(
    "MQTTPublish",
    {
        "topic": fields.String(required=True, description="MQTT topic"),
        "message": fields.String(required=True, description="Message content"),
    },
)

mqtt_status_response = ns_mqtt.model(
    "MQTTStatusResponse",
    {
        "connected": fields.Boolean(description="Connected status"),
        "subscribed_topics": fields.List(fields.String, description="Subscribed topics list"),
    },
)

mqtt_connect_model = ns_mqtt.model(
    "MQTTConnect",
    {
        "broker": fields.String(description="MQTT Broker address"),
        "port": fields.Integer(description="Port"),
        "client_id": fields.String(description="Client ID"),
        "username": fields.String(description="Username"),
        "password": fields.String(description="Password"),
        "ssl": fields.Boolean(description="Enable SSL"),
        "timeout": fields.Integer(description="Timeout"),
        "keepalive": fields.Integer(description="Keepalive interval"),
        "transport": fields.String(description="Transport protocol (tcp/websocket)"),
        "ws_path": fields.String(description="WebSocket path"),
    },
)

mqtt_subscribe_model = ns_mqtt.model(
    "MQTTSubscribe",
    {
        "topic": fields.String(required=True, description="MQTT topic"),
        "qos": fields.Integer(description="QoS level (0/1/2)"),
    },
)

mqtt_unlock_model = ns_mqtt.model(
    "MQTTUnlock", {"box_id": fields.String(description="Box ID (A/B)")}
)

mqtt_command_model = ns_mqtt.model(
    "MQTTCommand",
    {
        "device_id": fields.String(description="Device ID, broadcast to all if empty"),
        "command": fields.String(
            required=True, description="Command type: open_door, open_phonebox, restart"
        ),
        "params": fields.Raw(description="Command parameters (optional)"),
    },
)


@ns_mqtt.route("/logs")
class MQTTLogs(Resource):

    @ns_mqtt.doc("get_mqtt_logs", description="Get MQTT logs")
    @ns_mqtt.response(200, "Success")
    @requires_permission("manage_devices")
    @cached_api(ttl=30)
    def get(self):
        logs = mqtt_management_service.get_mqtt_logs()
        return APIResponse.success(data=logs)


@ns_mqtt.route("/config")
class MQTTConfigResource(Resource):

    @ns_mqtt.doc("get_mqtt_config", description="Get MQTT config")
    @ns_mqtt.response(200, "Success")
    @requires_permission("manage_devices")
    @cached_api(ttl=60)
    def get(self):
        config = mqtt_management_service.get_mqtt_config()
        return APIResponse.success(data=config)

    @ns_mqtt.doc("update_mqtt_config", description="Update MQTT config", security="Bearer")
    @ns_mqtt.expect(mqtt_config_model)
    @ns_mqtt.response(200, "Success")
    @requires_permission("system.settings")
    def put(self):
        data = ns_mqtt.payload
        mqtt_management_service.update_mqtt_config(data)
        invalidate_cache("api:/api/monitoring/mqtt/*")
        return APIResponse.success(message="MQTT config updated successfully")


@ns_mqtt.route("/status")
class MQTTStatus(Resource):

    @ns_mqtt.doc("get_mqtt_status", description="Get MQTT connection status")
    @ns_mqtt.response(200, "Success", mqtt_status_response)
    @cached_api(ttl=30)
    def get(self):
        status = mqtt_manager.get_status()
        return {"connected": status["connected"], "subscribed_topics": status["subscribed_topics"]}


@ns_mqtt.route("/publish")
class MQTTPublish(Resource):

    @ns_mqtt.doc("publish_mqtt_message", description="Publish MQTT message", security="Bearer")
    @ns_mqtt.expect(mqtt_publish_model)
    @ns_mqtt.response(200, "Success")
    @ns_mqtt.response(400, "Bad request")
    @ns_mqtt.response(429, "Rate limited")
    @requires_permission("device.manage")
    def post(self):
        limiter = get_limiter()

        @limiter.limit(RateLimitStrategy.MQTT_PUBLISH)
        def _do_publish(topic, message):
            return publish_mqtt(
                topic, json.dumps(message) if isinstance(message, dict) else str(message)
            )

        data = ns_mqtt.payload
        topic = data.get("topic")
        message = data.get("message")

        if not topic or message is None:
            return APIResponse.error(message="topic and message are required", status_code=400)

        if len(topic) > 200:
            return APIResponse.error(
                message="Topic length cannot exceed 200 characters", status_code=400
            )

        if len(message) > 10000:
            return APIResponse.error(
                message="Message content cannot exceed 10000 characters", status_code=400
            )

        result = _do_publish(topic, message)
        if result:
            return APIResponse.success(message="Published successfully")
        else:
            return APIResponse.error(message="Publish failed")


@ns_mqtt.route("/recent")
class MQTTRecentLogs(Resource):

    @ns_mqtt.doc("get_recent_mqtt_logs", description="Get recent MQTT logs")
    @ns_mqtt.response(200, "Success")
    @requires_permission("manage_devices")
    @cached_api(ttl=30)
    def get(self):
        return mqtt_logs[-50:] if len(mqtt_logs) > 50 else mqtt_logs


@ns_mqtt.route("/connect")
class MQTTConnect(Resource):

    @ns_mqtt.doc("connect_mqtt", description="Connect to MQTT server")
    @ns_mqtt.expect(mqtt_connect_model)
    @ns_mqtt.response(200, "Success")
    @ns_mqtt.response(500, "Connection failed")
    @requires_permission("manage_devices")
    def post(self):
        logger.info("=== MQTT connect API called ===")
        try:
            if mqtt_manager.is_connected:
                logger.info("MQTT already connected, no need to reconnect")
                return APIResponse.success(
                    data={"status": "connected"}, message="MQTT already connected"
                )

            config_dict = None

            with get_flask_app().app_context():
                from models import MQTTConfig

                config = MQTTConfig.query.first()
                if config:
                    config_dict = {
                        "broker": config.broker,
                        "port": config.port,
                        "client_id": config.client_id,
                        "username": config.username,
                        "password": config.password,
                        "ssl": config.ssl,
                        "timeout": config.timeout,
                        "keepalive": config.keepalive,
                    }

            data = None
            try:
                data = ns_mqtt.payload
            except Exception:
                pass

            if data:
                # P2-7 修复: username/password 不再回退硬编码 "phoneboxtest"/"123456"，缺省置空
                config_dict = {
                    "broker": data.get(
                        "broker",
                        (
                            config_dict["broker"]
                            if config_dict
                            else "nc5233fc.ala.cn-hangzhou.emqxsl.cn"
                        ),
                    ),
                    "port": data.get("port", config_dict["port"] if config_dict else 8883),
                    "client_id": data.get(
                        "client_id", config_dict["client_id"] if config_dict else "score_backend"
                    ),
                    "username": data.get(
                        "username", config_dict["username"] if config_dict else ""
                    ),
                    "password": data.get(
                        "password", config_dict["password"] if config_dict else ""
                    ),
                    "ssl": data.get("ssl", config_dict["ssl"] if config_dict else True),
                    "timeout": data.get("timeout", config_dict["timeout"] if config_dict else 10),
                    "keepalive": data.get(
                        "keepalive", config_dict["keepalive"] if config_dict else 60
                    ),
                    "transport": data.get("transport", "tcp"),
                    "ws_path": data.get("ws_path", "/mqtt"),
                }
            else:
                if not config_dict:
                    # P2-7 修复: 无 DB 配置且无请求参数时明确报错，不再用硬编码弱口令连接生产 Broker
                    return APIResponse.error(
                        message="MQTT 未配置：请先在系统 MQTT 配置中填写 Broker 地址与凭据，再发起连接",
                        status_code=400,
                    )
                else:
                    config_dict["transport"] = "tcp"
                    config_dict["ws_path"] = "/mqtt"

            logger.info(
                f"Using config: broker={config_dict['broker']}, "
                f"port={config_dict['port']}, "
                f"transport={config_dict['transport']}"
            )

            result = connect_mqtt(config_dict)  # noqa: F841

            if result:
                logger.info("MQTT connection successful!")
                return APIResponse.success(message="MQTT connection successful")
            else:
                logger.warning("MQTT connection failed")
                return APIResponse.error(message="MQTT connection failed", status_code=500)

        except Exception as e:
            logger.warning(f"MQTT connection failed: {type(e).__name__}: {e}")

            traceback.print_exc()
            logger.error("%s: %s", "MQTT connection failed", e)
            return APIResponse.error(message="MQTT connection failed", status_code=500)


@ns_mqtt.route("/disconnect")
class MQTTDisconnect(Resource):

    @ns_mqtt.doc("disconnect_mqtt", description="Disconnect MQTT")
    @ns_mqtt.response(200, "Success")
    @ns_mqtt.response(500, "Disconnect failed")
    @requires_permission("manage_devices")
    def post(self):
        try:
            mqtt_manager.disconnect()
            return APIResponse.success(message="MQTT disconnected")
        except Exception as e:
            logger.error("%s: %s", "MQTT disconnect error", e)
            return APIResponse.error(message="MQTT disconnect error", status_code=500)


@ns_mqtt.route("/subscribe")
class MQTTSubscribe(Resource):

    @ns_mqtt.doc("subscribe_mqtt_topic", description="Subscribe to MQTT topic")
    @ns_mqtt.expect(mqtt_subscribe_model)
    @ns_mqtt.response(200, "Success")
    @ns_mqtt.response(400, "Bad request")
    @ns_mqtt.response(500, "Subscribe failed")
    @requires_permission("manage_devices")
    def post(self):
        data = ns_mqtt.payload
        topic = data.get("topic")
        qos = data.get("qos", 0)

        if not topic:
            return APIResponse.error(message="Topic is required", status_code=400)

        result = mqtt_manager.subscribe(topic, qos)  # noqa: F841
        if result:
            return APIResponse.success(message=f"Subscribed successfully: {topic}")
        else:
            return APIResponse.error(
                message="Subscribe failed, MQTT not connected", status_code=500
            )


@ns_mqtt.route("/unsubscribe")
class MQTTUnsubscribe(Resource):

    @ns_mqtt.doc("unsubscribe_mqtt_topic", description="Unsubscribe from MQTT topic")
    @ns_mqtt.expect(mqtt_subscribe_model)
    @ns_mqtt.response(200, "Success")
    @ns_mqtt.response(400, "Bad request")
    @ns_mqtt.response(500, "Unsubscribe failed")
    @requires_permission("manage_devices")
    def post(self):
        data = ns_mqtt.payload
        topic = data.get("topic")

        if not topic:
            return APIResponse.error(message="Topic is required", status_code=400)

        result = mqtt_manager.unsubscribe(topic)  # noqa: F841
        if result:
            return APIResponse.success(message=f"Unsubscribed successfully: {topic}")
        else:
            return APIResponse.error(
                message="Unsubscribe failed, MQTT not connected", status_code=500
            )


@ns_mqtt.route("/unlock")
class MQTTUnlock(Resource):

    @ns_mqtt.doc("publish_unlock_command", description="Publish unlock command")
    @ns_mqtt.expect(mqtt_unlock_model)
    @ns_mqtt.response(200, "Success")
    @requires_permission("manage_devices")
    def post(self):
        try:
            data = ns_mqtt.payload
            box_id = data.get("box_id", "A")

            topic = f"phonebox/unlock/{box_id}"

            if box_id == "A":
                payload = ""
            else:
                payload = json.dumps(
                    {
                        "result": data.get("response", {}).get("result", "false"),
                        "reason": data.get("response", {}).get("reason", "manual"),
                        "current_score": data.get("response", {}).get("current_score"),
                    }
                )

            result = publish_mqtt(topic, payload)  # noqa: F841
            if result:
                return APIResponse.success(message=f"Unlock command sent to {topic}")
            else:
                return APIResponse.error(message="Send failed, MQTT not connected", status_code=500)
        except Exception as e:
            logger.error("%s: %s", "Send error", e)
            return APIResponse.error(message="Send error", status_code=500)


@ns_mqtt.route("/command")
class MQTTCommand(Resource):

    @ns_mqtt.doc("send_device_command", description="Send device command", security="Bearer")
    @ns_mqtt.expect(mqtt_command_model)
    @ns_mqtt.response(200, "Success")
    @ns_mqtt.response(400, "Bad request")
    @ns_mqtt.response(500, "Send failed")
    @requires_permission("device.manage")
    def post(self):
        try:
            data = ns_mqtt.payload
            device_id = data.get("device_id")
            command = data.get("command")
            params = data.get("params", {})

            if not command:
                return APIResponse.error(message="Command type is required", status_code=400)

            valid_commands = ["open_door", "open_phonebox", "restart"]
            if command not in valid_commands:
                return APIResponse.error(
                    message=f"Invalid command type, supported: {valid_commands}", status_code=400
                )

            message = {"command": command, "timestamp": datetime.now().isoformat()}
            if params:
                message["params"] = params

            if device_id:
                topic = f"phonebox/command/{device_id}"
            else:
                topic = "phonebox/command"

            result = publish_mqtt(topic, json.dumps(message))  # noqa: F841
            if result:
                return APIResponse.success(message=f'Command "{command}" sent to {topic}')
            else:
                return APIResponse.error(message="Send failed, MQTT not connected", status_code=500)
        except Exception as e:
            logger.error("%s: %s", "Send error", e)
            return APIResponse.error(message="Send error", status_code=500)


def register_mqtt_message_handler():
    mqtt_manager.add_message_callback(mqtt_message_service.handle_mqtt_message)

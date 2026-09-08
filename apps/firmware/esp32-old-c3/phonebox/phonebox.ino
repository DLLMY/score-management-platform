/**
 * @file phonebox.ino
 * @brief ESP32手机管理箱主程序（DX-NF01 RFID模块版）
 * 
 * 本程序实现一个基于ESP32的双箱手机管理系统，支持：
 * - A箱：班主任远程控制开锁（MQTT协议）
 * - B箱：学生刷卡验证开锁（积分≥60分才能开锁）
 * - 网页配网功能（长按按键3秒进入AP模式）
 * - Captive Portal自动弹窗配网
 * - 门状态检测与上报
 * - OLED显示与LED/蜂鸣器提示
 * 
 * RFID模块：DX-NF01（国产13.56MHz），使用AT指令协议
 * 默认波特率：9600
 * 
 * 调试模式：每次烧录程序后自动重置配置（DEBUG_VERSION递增触发）
 * 
 * 改进：非阻塞式状态机架构，无阻塞延迟
 * 
 * @author Auto Generated
 * @version 2.5
 */

#include <WiFi.h>
#include <WebServer.h>
#include <PubSubClient.h>
#include <U8g2lib.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <WiFiClientSecure.h>
#include <DNSServer.h>
#include <Update.h>
#include <HTTPClient.h>
#include <ArduinoOTA.h>
#include "esp_system.h"

// ==================== 硬件平台自动检测 ====================
typedef enum {
  PLATFORM_UNKNOWN,
  PLATFORM_ESP32_WROOM,
  PLATFORM_ESP32_S3
} PlatformType;

PlatformType detectedPlatform = PLATFORM_UNKNOWN;
String platformName = "Unknown";

void detectPlatform() {
  esp_chip_info_t chipInfo;
  esp_chip_info(&chipInfo);
  
  switch(chipInfo.model) {
    case CHIP_ESP32S3:
      detectedPlatform = PLATFORM_ESP32_S3;
      platformName = "ESP32-S3";
      break;
    case CHIP_ESP32:
      detectedPlatform = PLATFORM_ESP32_WROOM;
      platformName = "ESP32-WROOM";
      break;
    default:
      detectedPlatform = PLATFORM_UNKNOWN;
      platformName = "Unknown";
      break;
  }
  
  Serial.printf("\n[硬件检测] 芯片型号: %s\n", platformName.c_str());
  Serial.printf("[硬件检测] 核心数: %d\n", chipInfo.cores);
  Serial.printf("[硬件检测] Flash大小: %d MB\n", spi_flash_get_chip_size() / (1024 * 1024));
  Serial.printf("[硬件检测] 特性: %s %s %s\n", 
    (chipInfo.features & CHIP_FEATURE_WIFI_BGN) ? "WiFi" : "",
    (chipInfo.features & CHIP_FEATURE_BLE) ? "BLE" : "",
    (chipInfo.features & CHIP_FEATURE_EMB_FLASH) ? "Flash" : "");
}

#define RELAY_A    5    // 从GPIO4改为GPIO5，GPIO4可能被内部功能占用
#define RELAY_B    2               // 原GPIO16改为GPIO2，GPIO16用于UART2_RX
#define LED_RED    25
#define LED_GREEN  26
#define BUZZER     27
#define DOOR_A     32
#define DOOR_B     33
#define CONFIG_PIN 15
#define RFID_RESET 23

// UART2默认引脚配置（ESP32 WROOM 32）
// GPIO16 = UART2_RX (连接DX-NF01模块TX)
// GPIO17 = UART2_TX (连接DX-NF01模块RX)

#define EEPROM_SIZE     512
#define CONFIG_VERSION  100
#define DEBUG_VERSION   15              // 每次烧录需要重置时递增此值
#define FIRMWARE_VERSION "2.5"          // 固件版本号，OTA升级时用于标识
#define AP_SSID         "PhoneBox-Config"
#define AP_PASSWORD     "12345678"
#define RFID_BAUD_RATE  9600
#define DNS_PORT        53

WiFiClientSecure espClient;
PubSubClient mqtt(espClient);
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0);
WebServer server(80);
DNSServer dnsServer;

#define TOPIC_QUERY      "phonebox/query"
#define TOPIC_UNLOCK_A   "phonebox/unlock/A"
#define TOPIC_UNLOCK_B   "phonebox/unlock/B"
#define TOPIC_STATUS     "phonebox/status"
#define TOPIC_LOG        "phonebox/log"
#define TOPIC_HEARTBEAT  "phonebox/heartbeat"  // 心跳包主题
#define TOPIC_OTA        "phonebox/ota"        // OTA固件升级指令主题
#define TOPIC_OTA_STATUS "phonebox/ota/status" // OTA升级进度上报主题

#define HEARTBEAT_INTERVAL 10000  // 心跳发送间隔，单位毫秒（建议10秒）

typedef enum {
  STATE_IDLE,
  STATE_UNLOCKING_A,
  STATE_UNLOCKING_B,
  STATE_ERROR_B,
  STATE_SHOWING_CARD,
  STATE_OTA_UPDATING
} SystemState;

typedef struct {
  char wifi_ssid[32];
  char wifi_password[64];
  char mqtt_server[64];
  int mqtt_port;
  char mqtt_client_id[32];
  char mqtt_username[32];
  char mqtt_password[64];
  int rfid_baud;
  bool mqtt_ssl;
  int config_version;
  int debug_version;
} Config;

Config config;
bool isConfigMode = false;
unsigned long configModeStartTime = 0;

SystemState currentState = STATE_IDLE;
unsigned long stateStartTime = 0;
String currentBoxId = "";
String errorReason = "";
int errorScore = 0;

static struct {
  unsigned long lastQueryTime;
  unsigned long lastReadTime;
  unsigned long lastDoorCheck;
  unsigned long cardShowStart;
  String lastCardId;
  bool showingCard;
  String responseBuffer;
  unsigned long beepStartTime;
  int beepRemainingTimes;
  int beepDuration;
  bool beeping;
  unsigned long lastHeartbeatTime;  // 上次心跳发送时间
  bool cardPresent;  // 标记是否有卡片在感应范围内
  unsigned long lastModuleResponseTime;  // 上次模块响应时间
  int consecutiveNoResponse;  // 连续无响应次数
  String lastRawCardId;  // 上次读取的原始卡号
  int cardReadCount;  // 连续读取相同卡号的次数
  String otaUrl;           // OTA固件下载地址
  bool otaPending;         // 是否有OTA升级待处理
  String otaTargetVersion; // 目标固件版本号
  bool otaForceUpdate;     // 是否强制升级（忽略版本检查）
} stateVars;

void loadConfig();
void saveConfig();
void setLED(bool red, bool green);
void startBeep(int times, int durationMs);
void updateBeep();
void oledShow(String line1, String line2 = "", String line3 = String(), String line4 = String());
void sendStatus(String box, String status);
void sendHeartbeat();
void sendCardQuery(String cardId);
void triggerUnlock(String boxId);
void updateStateMachine();
void mqttCallback(char* topic, byte* payload, unsigned int length);
bool setup_wifi();
void startAP();
void handleRoot();
void handleSave();
void handleReset();
void handleNotFound();
void reconnect();
void checkConfigMode();
void sendNF01Command(String cmd);
String parseNF01Response(String response);
void initNF01();
void processRFID();
void performOTAUpdate(const String& url);
void sendOTAStatus(const String& status, int progress = -1);
void testPins();

void loadConfig() {
  EEPROM.begin(EEPROM_SIZE);
  EEPROM.get(0, config);
  EEPROM.end();
  
  Serial.printf("Loaded config version: %d, required: %d\n", config.config_version, CONFIG_VERSION);
  Serial.printf("Loaded debug version: %d, required: %d\n", config.debug_version, DEBUG_VERSION);
  Serial.printf("WiFi SSID: [%s]\n", config.wifi_ssid);
  Serial.printf("WiFi Password length: %d\n", strlen(config.wifi_password));
  Serial.printf("MQTT Server: [%s:%d]\n", config.mqtt_server, config.mqtt_port);
  
  if (config.config_version != CONFIG_VERSION || config.debug_version != DEBUG_VERSION) {
    Serial.println("Config version mismatch or debug version changed, resetting to defaults");
    
    strcpy(config.wifi_ssid, "");
    strcpy(config.wifi_password, "");
    strcpy(config.mqtt_server, "nc5233fc.ala.cn-hangzhou.emqxsl.cn");
    config.mqtt_port = 8883;
    strcpy(config.mqtt_client_id, "phonebox_001");
    strcpy(config.mqtt_username, "phoneboxtest");
    strcpy(config.mqtt_password, "123456");
    config.rfid_baud = RFID_BAUD_RATE;
    config.mqtt_ssl = true;
    config.config_version = CONFIG_VERSION;
    config.debug_version = DEBUG_VERSION;
    saveConfig();
    Serial.println("Default config saved with Aliyun MQTT");
  }
}

void saveConfig() {
  EEPROM.begin(EEPROM_SIZE);
  EEPROM.put(0, config);
  bool success = EEPROM.commit();
  EEPROM.end();
  
  Serial.printf("Config saved, success: %d\n", success);
  Serial.printf("Saved WiFi SSID: [%s]\n", config.wifi_ssid);
  Serial.printf("Saved MQTT Server: [%s:%d]\n", config.mqtt_server, config.mqtt_port);
}

void setLED(bool red, bool green) {
  digitalWrite(LED_RED, red ? LOW : HIGH);
  digitalWrite(LED_GREEN, green ? LOW : HIGH);
}

void startBeep(int times, int durationMs) {
  stateVars.beeping = true;
  stateVars.beepRemainingTimes = times;
  stateVars.beepDuration = durationMs;
  stateVars.beepStartTime = millis();
  digitalWrite(BUZZER, LOW);  // 低电平触发，开始响铃
}

void updateBeep() {
  if (!stateVars.beeping) return;
  
  unsigned long elapsed = millis() - stateVars.beepStartTime;
  int cycle = stateVars.beepDuration * 2;
  int currentCycle = elapsed / cycle;
  int positionInCycle = elapsed % cycle;
  
  if (currentCycle >= stateVars.beepRemainingTimes) {
    stateVars.beeping = false;
    digitalWrite(BUZZER, HIGH);  // 高电平关闭蜂鸣器
    return;
  }
  
  digitalWrite(BUZZER, positionInCycle < stateVars.beepDuration ? LOW : HIGH);  // 低电平响，高电平静音
}

void oledShow(String line1, String line2, String line3, String line4) {
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_ncenB08_tr);
  u8g2.drawStr(0, 12, line1.c_str());
  u8g2.drawStr(0, 28, line2.c_str());
  u8g2.drawStr(0, 44, line3.c_str());
  u8g2.drawStr(0, 60, line4.c_str());
  u8g2.sendBuffer();
}

void sendStatus(String box, String status) {
  String msg = "{\"box_id\":\"" + box + "\",\"status\":\"" + status + "\",\"timestamp\":" + String(millis() / 1000) + "}";
  mqtt.publish(TOPIC_STATUS, msg.c_str());
  Serial.println("Status: " + msg);
}

void sendHeartbeat() {
  StaticJsonDocument<384> doc;
  doc["device_id"] = String(config.mqtt_client_id);
  doc["timestamp"] = millis() / 1000;
  doc["status"] = "online";
  doc["fw_version"] = FIRMWARE_VERSION;
  doc["platform"] = platformName;
  doc["wifi_signal"] = WiFi.RSSI();
  doc["free_heap"] = ESP.getFreeHeap();
  doc["uptime"] = millis() / 1000;
  doc["box_a_status"] = digitalRead(RELAY_A) == HIGH ? "opened" : "closed";
  doc["box_b_status"] = digitalRead(RELAY_B) == HIGH ? "opened" : "closed";
  doc["system_state"] = currentState;
  
  String jsonStr;
  serializeJson(doc, jsonStr);
  
  mqtt.publish(TOPIC_HEARTBEAT, jsonStr.c_str());
  Serial.printf("心跳包发送: %s\n", jsonStr.c_str());
}

void sendCardQuery(String cardId) {
  StaticJsonDocument<256> doc;
  doc["box_id"] = "B";
  doc["card_id"] = cardId;
  doc["timestamp"] = millis() / 1000;
  doc["type"] = "query";
  
  struct tm timeinfo;
  if (getLocalTime(&timeinfo)) {
    doc["hour"] = timeinfo.tm_hour;
    doc["minute"] = timeinfo.tm_min;
  }
  
  String jsonStr;
  serializeJson(doc, jsonStr);
  mqtt.publish(TOPIC_QUERY, jsonStr.c_str());
  Serial.printf("刷卡查询发送: %s\n", jsonStr.c_str());
}

void triggerUnlock(String boxId) {
  Serial.println("=== triggerUnlock 开始 ===");
  Serial.println("boxId: " + boxId);
  
  currentState = boxId == "A" ? STATE_UNLOCKING_A : STATE_UNLOCKING_B;
  currentBoxId = boxId;
  stateStartTime = millis();
  
  int relayPin = boxId == "A" ? RELAY_A : RELAY_B;
  Serial.printf("选择继电器引脚: %d\n", relayPin);
  
  // 读取当前引脚状态
  int currentStateBefore = digitalRead(relayPin);
  Serial.printf("设置前引脚状态: %d\n", currentStateBefore);
  
  Serial.printf("重新配置引脚为OUTPUT模式...\n");
  pinMode(relayPin, OUTPUT);
  
  Serial.printf("设置引脚为 HIGH...\n");
  digitalWrite(relayPin, HIGH);
  
  // 短暂延迟确保设置生效
  delay(10);
  
  // 读取设置后的状态
  int currentStateAfter = digitalRead(relayPin);
  Serial.printf("设置后引脚状态: %d\n", currentStateAfter);
  
  if (currentStateAfter == 0 && relayPin == RELAY_A) {
    Serial.println("警告: GPIO4设置失败，尝试特殊处理...");
    // 尝试直接操作寄存器来设置GPIO4
    REG_WRITE(GPIO_OUT_W1TS_REG, (1ULL << RELAY_A));
    delay(10);
    currentStateAfter = digitalRead(relayPin);
    Serial.printf("寄存器操作后引脚状态: %d\n", currentStateAfter);
  }
  
  setLED(false, true);
  
  String operatorText = String("请") + (boxId == "A" ? "班主任" : "学生") + "操作";
  oledShow("箱门已开", operatorText, "3秒后自动锁闭", "");
  startBeep(2, 100);
  
  sendStatus(boxId, "opened");
  String logMsg = String("{\"event\":\"unlock_") + boxId + "\",\"result\":\"success\"}";
  mqtt.publish(TOPIC_LOG, logMsg.c_str());
}

void updateStateMachine() {
  unsigned long elapsed = millis() - stateStartTime;
  
  switch (currentState) {
    case STATE_IDLE:
      break;
      
    case STATE_UNLOCKING_A:
    case STATE_UNLOCKING_B:
      if (elapsed >= 3000) {
        int relayPin = currentBoxId == "A" ? RELAY_A : RELAY_B;
        digitalWrite(relayPin, LOW);
        setLED(false, false);
        sendStatus(currentBoxId, "closed");  // 关锁时发送状态
        oledShow("手机管理箱", "A箱:远程等待", "B箱:请刷卡", "就绪");
        currentState = STATE_IDLE;
      }
      break;
      
    case STATE_ERROR_B:
      if (elapsed >= 2000) {
        setLED(false, false);
        oledShow("手机管理箱", "A箱:远程等待", "B箱:请刷卡", "就绪");
        currentState = STATE_IDLE;
        stateVars.lastReadTime = 0;  // 重置读卡时间，允许立即再次刷卡
      }
      break;
      
    case STATE_SHOWING_CARD:
      if (elapsed >= 8000) {
        oledShow("B箱刷卡", "等待响应超时", "请重试刷卡", "");
        startBeep(1, 500);
        delay(500);
        oledShow("手机管理箱", "A箱:远程等待", "B箱:请刷卡", "就绪");
        currentState = STATE_IDLE;
        stateVars.lastReadTime = 0;  // 重置读卡时间，允许立即再次刷卡
      }
      break;
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
  Serial.printf("=== MQTT 收到消息 ===\n");
  Serial.printf("Topic: [%s]\n", topic);
  Serial.printf("Message: [%s]\n", message.c_str());
  Serial.printf("当前系统状态: %d\n", currentState);

  // 测试功能：直接控制GPIO4
  if (String(topic) == "phonebox/test/gpio4") {
    Serial.println("=== GPIO4 测试功能触发 ===");
    if (message == "ON") {
      Serial.println("设置 GPIO4 为 HIGH");
      digitalWrite(RELAY_A, HIGH);
      Serial.printf("GPIO4 状态: %d\n", digitalRead(RELAY_A));
    } else if (message == "OFF") {
      Serial.println("设置 GPIO4 为 LOW");
      digitalWrite(RELAY_A, LOW);
      Serial.printf("GPIO4 状态: %d\n", digitalRead(RELAY_A));
    } else if (message == "READ") {
      Serial.printf("读取 GPIO4 状态: %d\n", digitalRead(RELAY_A));
    }
    return;
  }

  // OTA固件升级指令
  if (String(topic) == TOPIC_OTA) {
    Serial.println("=== OTA升级指令收到 ===");
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, message);
    if (!error) {
      const char* url = doc["url"];
      const char* action = doc["action"] | "update";
      const char* version = doc["version"] | "";
      bool force = doc["force"] | false;
      
      if (url && strlen(url) > 0 && String(action) == "update") {
        Serial.printf("OTA固件URL: %s\n", url);
        Serial.printf("目标版本: %s\n", strlen(version) > 0 ? version : "未知");
        Serial.printf("强制升级: %s\n", force ? "是" : "否");
        
        // 版本检查（非强制模式下）
        if (!force && strlen(version) > 0) {
          if (String(version) <= FIRMWARE_VERSION) {
            Serial.printf("版本检查失败: 当前版本%s >= 目标版本%s\n", FIRMWARE_VERSION, version);
            sendOTAStatus("version_check_failed", -1);
            return;
          }
        }
        
        // 不在回调中直接执行OTA（会阻塞MQTT），设置标志位在loop中处理
        stateVars.otaUrl = String(url);
        stateVars.otaPending = true;
        stateVars.otaTargetVersion = String(version);
        stateVars.otaForceUpdate = force;
        
        // 立即回复收到指令的确认
        sendOTAStatus("command_received", -1);
        Serial.println("OTA升级将在loop中处理");
      } else {
        Serial.println("OTA指令格式错误，缺少url或action");
        sendOTAStatus("invalid_command", -1);
      }
    } else {
      Serial.printf("OTA指令JSON解析失败: %s\n", error.c_str());
      sendOTAStatus("parse_error", -1);
    }
    return;
  }

  if (String(topic) == TOPIC_UNLOCK_A && currentState == STATE_IDLE) {
    Serial.println("--- A箱开锁指令！触发！");
    Serial.println("当前状态检查通过，调用 triggerUnlock(\"A\")");
    triggerUnlock("A");
  } else if (String(topic) == TOPIC_UNLOCK_B) {
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, message);
    if (!error) {
      String result = doc["result"] | "false";
      if (result == "true" && (currentState == STATE_IDLE || currentState == STATE_SHOWING_CARD)) {
        Serial.println("B箱开锁授权成功，触发开锁！");
        triggerUnlock("B");
      } else if (result == "false") {
        errorReason = doc["reason"] | "unknown";
        errorScore = doc["current_score"] | 0;
        currentState = STATE_ERROR_B;
        stateStartTime = millis();
        stateVars.lastReadTime = 0;  // 重置读卡时间，允许立即再次刷卡
        
        // 发送失败状态
        sendStatus("B", "error");
        
        // 发送日志
        StaticJsonDocument<200> logDoc;
        logDoc["event"] = "unlock_B";
        logDoc["result"] = "failure";
        logDoc["reason"] = errorReason;
        logDoc["current_score"] = errorScore;
        String logMsg;
        serializeJson(logDoc, logMsg);
        mqtt.publish(TOPIC_LOG, logMsg.c_str());
        
        setLED(true, false);
        if (errorReason == "score_low") {
          oledShow("B箱开锁失败", "积分不足: " + String(errorScore), "需≥60分", "");
        } else if (errorReason == "card_not_found") {
          oledShow("B箱开锁失败", "卡号未注册", "请联系班主任", "");
        } else if (errorReason == "not_in_time") {
          oledShow("B箱开锁失败", "非开锁时间段", "请在规定时间内", "");
        } else {
          oledShow("B箱开锁失败", "原因: " + errorReason, "", "");
        }
        startBeep(1, 800);
      }
    }
  }
}

bool setup_wifi() {
  if (strlen(config.wifi_ssid) == 0) return false;
  delay(10);
  Serial.print("Connecting to ");
  Serial.println(config.wifi_ssid);
  WiFi.begin(config.wifi_ssid, config.wifi_password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected. IP: " + WiFi.localIP().toString());
    oledShow("WiFi已连接", "IP:" + WiFi.localIP().toString(), "MQTT连接中...", "");
    return true;
  } else {
    Serial.println("WiFi连接失败");
    return false;
  }
}

void handleReset() {
  strcpy(config.wifi_ssid, "");
  strcpy(config.wifi_password, "");
  strcpy(config.mqtt_server, "nc5233fc.ala.cn-hangzhou.emqxsl.cn");
  config.mqtt_port = 8883;
  strcpy(config.mqtt_client_id, "phonebox_001");
  strcpy(config.mqtt_username, "phoneboxtest");
  strcpy(config.mqtt_password, "123456");
  config.rfid_baud = RFID_BAUD_RATE;
  config.mqtt_ssl = true;
  config.config_version = CONFIG_VERSION;
  config.debug_version = DEBUG_VERSION;
  saveConfig();
  
  String html = "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>配置已重置</title>";
  html += "<style>body{font-family:Arial;margin:20px;text-align:center;}</style></head><body>";
  html += "<h1>⚠️ 配置已重置</h1>";
  html += "<p>设备将在3秒后重启</p>";
  html += "</body></html>";
  server.send(200, "text/html", html);
  
  delay(3000);
  ESP.restart();
}

void startAP() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  IPAddress apIP = WiFi.softAPIP();
  
  dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
  dnsServer.start(DNS_PORT, "*", apIP);
  
  Serial.print("AP mode started. IP: ");
  Serial.println(apIP);
  Serial.println("Captive Portal enabled - auto popup config page");
  
  oledShow("配网模式", "SSID: " + String(AP_SSID), "连接后自动弹窗", "");
  startBeep(3, 150);
}

void handleRoot() {
  Serial.println("handleRoot called - showing config page");
  
  String html = "<!DOCTYPE html><html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>手机箱配置</title>";
  html += "<meta http-equiv='Cache-Control' content='no-cache, no-store, must-revalidate'>";
  html += "<meta http-equiv='Pragma' content='no-cache'>";
  html += "<meta http-equiv='Expires' content='0'>";
  html += "<style>";
  html += "body{font-family:Arial;margin:20px;max-width:400px;margin:0 auto;padding:20px;}";
  html += "input{width:100%;padding:10px;margin:8px 0;box-sizing:border-box;border:1px solid #ddd;border-radius:4px;}";
  html += "button{width:100%;padding:12px;background:#4CAF50;color:white;border:none;border-radius:4px;font-size:16px;cursor:pointer;margin:10px 0;}";
  html += "button:hover{background:#45a049;}";
  html += ".reset-btn{background:#f44336;}";
  html += ".reset-btn:hover{background:#d32f2f;}";
  html += "h1{color:#333;text-align:center;}";
  html += "h3{color:#666;border-bottom:1px solid #eee;padding-bottom:5px;}";
  html += "</style></head><body>";
  html += "<h1>📱 手机箱配置</h1>";
  html += "<p style='color:#666;text-align:center;'>配置WiFi网络连接阿里云MQTT</p>";
  html += "<form action='/save' method='POST'>";
  
  html += "<h3>WiFi配置</h3>";
  html += "<input type='text' name='wifi_ssid' value='" + String(config.wifi_ssid) + "' required placeholder='WiFi名称' maxlength='31'>";
  html += "<input type='password' name='wifi_password' value='" + String(config.wifi_password) + "' placeholder='WiFi密码' maxlength='63'>";
  
  html += "<h3>MQTT配置</h3>";
  html += "<input type='text' name='mqtt_server' value='" + String(config.mqtt_server) + "' required maxlength='63'>";
  html += "<input type='number' name='mqtt_port' value='" + String(config.mqtt_port) + "' min='1' max='65535'>";
  html += "<input type='text' name='mqtt_client_id' value='" + String(config.mqtt_client_id) + "' maxlength='31'>";
  html += "<input type='text' name='mqtt_username' value='" + String(config.mqtt_username) + "' maxlength='31'>";
  html += "<input type='password' name='mqtt_password' value='" + String(config.mqtt_password) + "' maxlength='63'>";
  html += "<label><input type='checkbox' name='mqtt_ssl' " + String(config.mqtt_ssl ? "checked" : "") + "> 启用SSL</label>";
  
  html += "<h3>RFID配置</h3>";
  html += "<select name='rfid_baud' style='width:100%;padding:10px;'>";
  html += "<option value='9600'" + String(config.rfid_baud == 9600 ? " selected" : "") + ">9600 (默认)</option>";
  html += "<option value='115200'" + String(config.rfid_baud == 115200 ? " selected" : "") + ">115200</option>";
  html += "</select>";
  
  html += "<button type='submit'>💾 保存配置</button>";
  html += "</form>";
  html += "<form action='/reset' method='POST'>";
  html += "<button type='submit' class='reset-btn'>⚠️ 重置配置</button>";
  html += "</form>";
  html += "</body></html>";
  
  server.sendHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  server.sendHeader("Pragma", "no-cache");
  server.sendHeader("Expires", "0");
  server.send(200, "text/html", html);
}

void handleNotFound() {
  Serial.println("handleNotFound - redirecting to root");
  server.sendHeader("Location", "/", true);
  server.send(302, "text/plain", "");
}

void handleSave() {
  String wifi_ssid = server.arg("wifi_ssid");
  String wifi_password = server.arg("wifi_password");
  String mqtt_server = server.arg("mqtt_server");
  int mqtt_port = server.arg("mqtt_port").toInt();
  String mqtt_client_id = server.arg("mqtt_client_id");
  String mqtt_username = server.arg("mqtt_username");
  String mqtt_password = server.arg("mqtt_password");
  bool mqtt_ssl = server.arg("mqtt_ssl") == "on";
  int rfid_baud = server.arg("rfid_baud").toInt();
  
  if (wifi_ssid.length() > 31) wifi_ssid = wifi_ssid.substring(0, 31);
  if (wifi_password.length() > 63) wifi_password = wifi_password.substring(0, 63);
  if (mqtt_server.length() > 63) mqtt_server = mqtt_server.substring(0, 63);
  if (mqtt_client_id.length() > 31) mqtt_client_id = mqtt_client_id.substring(0, 31);
  if (mqtt_username.length() > 31) mqtt_username = mqtt_username.substring(0, 31);
  if (mqtt_password.length() > 63) mqtt_password = mqtt_password.substring(0, 63);
  
  wifi_ssid.toCharArray(config.wifi_ssid, sizeof(config.wifi_ssid));
  wifi_password.toCharArray(config.wifi_password, sizeof(config.wifi_password));
  mqtt_server.toCharArray(config.mqtt_server, sizeof(config.mqtt_server));
  config.mqtt_port = (mqtt_port < 1 || mqtt_port > 65535) ? 1883 : mqtt_port;
  mqtt_client_id.toCharArray(config.mqtt_client_id, sizeof(config.mqtt_client_id));
  mqtt_username.toCharArray(config.mqtt_username, sizeof(config.mqtt_username));
  mqtt_password.toCharArray(config.mqtt_password, sizeof(config.mqtt_password));
  config.mqtt_ssl = mqtt_ssl;
  config.rfid_baud = rfid_baud;
  
  saveConfig();
  
  String html = "<!DOCTYPE html><html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>配置成功</title>";
  html += "<style>body{font-family:Arial;text-align:center;padding:50px;}h1{color:#4CAF50;}</style></head><body>";
  html += "<h1>✅ 配置成功</h1>";
  html += "<p>设备正在重启并连接WiFi...</p>";
  html += "</body></html>";
  server.send(200, "text/html", html);
  
  delay(3000);
  ESP.restart();
}

void reconnect() {
  while (!mqtt.connected()) {
    Serial.print("Attempting MQTT connection...");
    
    bool connected;
    if (strlen(config.mqtt_username) > 0) {
      connected = mqtt.connect(config.mqtt_client_id, config.mqtt_username, config.mqtt_password);
    } else {
      connected = mqtt.connect(config.mqtt_client_id);
    }
    
    if (connected) {
      Serial.println("connected");
      mqtt.subscribe(TOPIC_UNLOCK_A);
      mqtt.subscribe(TOPIC_UNLOCK_B);
      mqtt.subscribe("phonebox/test/gpio4");  // 订阅测试topic
      mqtt.subscribe(TOPIC_OTA);             // 订阅OTA升级指令topic
      oledShow("手机管理箱 v" FIRMWARE_VERSION, "A箱:远程等待", "B箱:请刷卡", "MQTT已连接");
      
      sendStatus("A", "closed");
      sendStatus("B", "closed");
      Serial.println("Initial status sent");
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqtt.state());
      oledShow("MQTT连接失败", "5秒后重试", "", "");
      unsigned long retryStart = millis();
      while (millis() - retryStart < 5000) {
        if (isConfigMode) return;
        delay(10);
      }
    }
  }
}

void checkConfigMode() {
  static unsigned long pressStartTime = 0;
  static bool beeped = false;
  bool buttonPressed = digitalRead(CONFIG_PIN) == LOW;
  
  if (buttonPressed && pressStartTime == 0) {
    pressStartTime = millis();
    beeped = false;
    Serial.println("按钮按下");
  } else if (buttonPressed && pressStartTime > 0) {
    unsigned long pressedDuration = millis() - pressStartTime;
    
    if (pressedDuration >= 3000 && !isConfigMode) {
      Serial.println("长按3秒，进入配网模式");
      startBeep(2, 200);
      isConfigMode = true;
      configModeStartTime = millis();
      startAP();
      server.on("/", HTTP_GET, handleRoot);
      server.on("/save", HTTP_POST, handleSave);
      server.on("/reset", HTTP_POST, handleReset);
      server.onNotFound(handleNotFound);
      server.begin();
      Serial.println("Web server started on 192.168.4.1");
      pressStartTime = 0;
    } else if (pressedDuration >= 1000 && pressedDuration < 3000 && !beeped) {
      startBeep(1, 100);
      beeped = true;
      oledShow("释放取消配网", "继续长按进入", "配网模式...", "");
    }
  } else if (!buttonPressed && pressStartTime > 0) {
    unsigned long pressedDuration = millis() - pressStartTime;
    if (pressedDuration < 3000) {
      Serial.println("按钮释放，未达到3秒");
    }
    pressStartTime = 0;
    beeped = false;
    if (!isConfigMode) {
      oledShow("手机管理箱", "A箱:远程等待", "B箱:请刷卡", "就绪");
    }
  }
}

void sendNF01Command(String cmd) {
  Serial2.println(cmd);
  Serial.print("NF01 cmd: ");
  Serial.println(cmd);
}

String parseNF01Response(String response) {
  response.trim();
  int uidIndex = response.indexOf("UID:");
  if (uidIndex != -1) {
    String uid = response.substring(uidIndex + 4);
    uid.trim();
    if (uid.length() >= 8 && uid.length() <= 16) {
      bool isValid = true;
      for (int i = 0; i < uid.length(); i++) {
        char c = uid[i];
        if (!((c >= '0' && c <= '9') || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f'))) {
          isValid = false;
          break;
        }
      }
      if (isValid) {
        String upperUid = uid;
        upperUid.toUpperCase();
        return upperUid;
      }
    }
  }
  return "";
}

void initNF01() {
  Serial.println("Initializing DX-NF01 RFID module...");
  Serial.printf("Serial2 baud rate: %d\n", config.rfid_baud);
  
  delay(1500);
  
  Serial.println("Step 1: Clear buffer...");
  while (Serial2.available() > 0) {
    Serial2.read();
  }
  
  Serial.println("Step 2: Test AT command...");
  Serial2.println("AT");
  delay(1000);
  
  String response = "";
  while (Serial2.available() > 0) {
    response += (char)Serial2.read();
  }
  Serial.println(response);
  if (response.indexOf("OK") >= 0) {
    Serial.println("AT command OK");
  }
  
  Serial.println("Step 3: Reset module...");
  Serial2.println("AT+RESET");
  delay(1000);
  response = "";
  while (Serial2.available() > 0) {
    response += (char)Serial2.read();
  }
  Serial.println(response);
  
  Serial.println("Step 4: Try enabling auto output...");
  delay(500);
  
  // 尝试不同的自动输出命令
  String autoCmd = "";
  bool autoSet = false;
  
  // 尝试方案1: AT+AUTOREP=ON
  Serial2.println("AT+AUTOREP=ON");
  delay(1000);
  response = "";
  while (Serial2.available() > 0) {
    response += (char)Serial2.read();
  }
  Serial.println("AT+AUTOREP=ON: " + response);
  if (response.indexOf("OK") >= 0) {
    autoCmd = "AT+AUTOREP=ON";
    autoSet = true;
  }
  
  // 尝试方案2: AT+REPORT=ON
  if (!autoSet) {
    Serial2.println("AT+REPORT=ON");
    delay(1000);
    response = "";
    while (Serial2.available() > 0) {
      response += (char)Serial2.read();
    }
    Serial.println("AT+REPORT=ON: " + response);
    if (response.indexOf("OK") >= 0) {
      autoCmd = "AT+REPORT=ON";
      autoSet = true;
    }
  }
  
  // 尝试方案3: AT+AUTORPT=ON
  if (!autoSet) {
    Serial2.println("AT+AUTORPT=ON");
    delay(1000);
    response = "";
    while (Serial2.available() > 0) {
      response += (char)Serial2.read();
    }
    Serial.println("AT+AUTORPT=ON: " + response);
    if (response.indexOf("OK") >= 0) {
      autoCmd = "AT+AUTORPT=ON";
      autoSet = true;
    }
  }
  
  if (autoSet) {
    Serial.println("Auto output enabled: " + autoCmd);
  } else {
    Serial.println("Note: Auto commands not recognized, using polling mode");
  }
  
  Serial.println("NF01 initialization complete");
}

void processRFID() {
  // 允许在IDLE、ERROR_B、SHOWING_CARD状态下检测刷卡
  // 只有在开锁过程中（UNLOCKING_A、UNLOCKING_B）才禁止刷卡
  if (currentState == STATE_UNLOCKING_A || currentState == STATE_UNLOCKING_B) {
    return;
  }
  
  // 读取所有可用数据到缓冲区
  static uint8_t buffer[64];
  static int bufLen = 0;
  
  while (Serial2.available() > 0 && bufLen < 64) {
    buffer[bufLen++] = Serial2.read();
  }
  
  // 查找自动模式帧（AA BB开头）
  int frameStart = -1;
  for (int i = 0; i < bufLen - 1; i++) {
    if (buffer[i] == 0xAA && buffer[i+1] == 0xBB) {
      frameStart = i;
      break;
    }
  }
  
  if (frameStart >= 0) {
    uint8_t dataLen = buffer[frameStart + 2];
    
    // 等待完整的帧：AA BB 04 + 4字节卡号 + 校验 = 8字节
    if (dataLen == 0x04 && bufLen >= frameStart + 8) {
      // 验证校验字节（DD）
      if (buffer[frameStart + 7] == 0xDD) {
        String cardId = "";
        for (int i = 0; i < 4; i++) {
          char hex[3];
          sprintf(hex, "%02X", buffer[frameStart + 3 + i]);
          cardId += hex;
        }
        
        // 简化验证：读取到有效卡号就处理
        if (cardId != "00000000" && millis() - stateVars.lastReadTime > 1000) {
          stateVars.lastReadTime = millis();
          Serial.println("Card detected (auto): " + cardId);
          
          oledShow("B箱刷卡", "卡号:" + cardId, "验证中...", "");
          startBeep(1, 100);
          
          sendCardQuery(cardId);
          currentState = STATE_SHOWING_CARD;
          stateStartTime = millis();
        }
        
        stateVars.cardPresent = true;
      }
      bufLen = 0;
      return;
    } else if (dataLen == 0x01 && bufLen >= frameStart + 4) {
      // 卡片离开：AA BB 01 DD (4字节)
      if (buffer[frameStart + 3] == 0xDD) {
        if (stateVars.cardPresent) {
          Serial.println("Card removed");
          stateVars.cardPresent = false;
          stateVars.cardReadCount = 0;  // 重置读卡计数
          stateVars.lastRawCardId = "";  // 清除上一张卡号
        }
      }
      bufLen = 0;
      return;
    }
  }
  
  // 处理命令模式响应（+UID=开头）
  for (int i = 0; i < bufLen - 5; i++) {
    if (buffer[i] == '+' && buffer[i+1] == 'U' && 
        buffer[i+2] == 'I' && buffer[i+3] == 'D' && buffer[i+4] == '=') {
      String cardId = "";
      bool isValid = true;
      
      for (int j = i + 5; j < i + 20 && j < bufLen; j++) {
        char c = (char)buffer[j];
        if (c == '\r' || c == '\n' || c == ' ') break;
        if ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f')) {
          cardId += c;
        } else {
          isValid = false;
          break;
        }
      }
      
      if (isValid && cardId.length() >= 4 && cardId.length() <= 8) {
        cardId.toUpperCase();
        
        // 简化验证：读取到有效卡号就处理
        if (cardId != "00000000" && millis() - stateVars.lastReadTime > 1000) {
          stateVars.lastReadTime = millis();
          Serial.println("Card detected (cmd): " + cardId);
          
          oledShow("B箱刷卡", "卡号:" + cardId, "验证中...", "");
          startBeep(1, 100);
          
          sendCardQuery(cardId);
          currentState = STATE_SHOWING_CARD;
          stateStartTime = millis();
        }
      }
      
      bufLen = 0;
      return;
    }
  }
  
  // 轮询命令已禁用，模块已启用自动输出功能
  // if (millis() - stateVars.lastQueryTime >= 2000) {
  //   stateVars.lastQueryTime = millis();
  //   Serial2.println("AT+UID");
  //   Serial.println("Sent AT+UID (polling)");
  // }
}

// ============================================================
// OTA 远程固件升级功能
// 通过 MQTT 接收升级指令，从 HTTP URL 下载固件并自动刷写
// ============================================================

/**
 * @brief 发送OTA升级状态到MQTT
 * @param status 状态字符串: downloading/updating/success/failed/...
 * @param progress 进度百分比 (0-100)，-1表示无进度
 */
void sendOTAStatus(const String& status, int progress) {
  if (!mqtt.connected()) return;
  
  StaticJsonDocument<384> doc;
  doc["device_id"] = String(config.mqtt_client_id);
  doc["status"] = status;
  doc["from_version"] = FIRMWARE_VERSION;
  if (stateVars.otaTargetVersion.length() > 0) {
    doc["to_version"] = stateVars.otaTargetVersion;
  }
  doc["timestamp"] = millis() / 1000;
  if (progress >= 0) {
    doc["progress"] = progress;
  }
  
  String jsonStr;
  serializeJson(doc, jsonStr);
  mqtt.publish(TOPIC_OTA_STATUS, jsonStr.c_str());
  Serial.printf("OTA状态: %s\n", jsonStr.c_str());
}

/**
 * @brief 执行OTA固件下载与升级
 * 
 * 此函数会阻塞执行，直至升级完成（自动重启）或失败（重启回滚）
 * 升级流程：
 *   1. 关闭所有继电器（安全优先）
 *   2. 从指定URL通过HTTP GET下载固件
 *   3. 使用ESP32 Update库写入OTA分区
 *   4. 每10%进度通过OLED和MQTT上报
 *   5. 成功后自动重启，失败后延时重启回滚
 * 
 * @param url 固件文件的HTTP/HTTPS下载地址
 */
void testPins() {
  Serial.println("\n[引脚测试] 开始测试...");
  
  Serial.println("[引脚测试] 测试继电器A...");
  pinMode(RELAY_A, OUTPUT);
  digitalWrite(RELAY_A, HIGH);
  delay(200);
  digitalWrite(RELAY_A, LOW);
  
  Serial.println("[引脚测试] 测试继电器B...");
  pinMode(RELAY_B, OUTPUT);
  digitalWrite(RELAY_B, HIGH);
  delay(200);
  digitalWrite(RELAY_B, LOW);
  
  Serial.println("[引脚测试] 测试LED...");
  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  digitalWrite(LED_RED, LOW);
  digitalWrite(LED_GREEN, LOW);
  delay(300);
  digitalWrite(LED_RED, HIGH);
  digitalWrite(LED_GREEN, HIGH);
  
  Serial.println("[引脚测试] 测试蜂鸣器...");
  pinMode(BUZZER, OUTPUT);
  digitalWrite(BUZZER, LOW);
  delay(200);
  digitalWrite(BUZZER, HIGH);
  
  Serial.println("[引脚测试] 完成");
}

void performOTAUpdate(const String& url) {
  Serial.println("========================================");
  Serial.println("开始OTA固件升级");
  Serial.printf("固件URL: %s\n", url.c_str());
  Serial.printf("当前版本: %s\n", FIRMWARE_VERSION);
  Serial.println("========================================");
  
  // 1. 安全操作：关闭所有继电器
  digitalWrite(RELAY_A, LOW);
  digitalWrite(RELAY_B, LOW);
  setLED(true, false);  // 红灯亮，表示升级中
  
  // 2. 断开MQTT连接，避免升级过程中收到消息干扰
  if (mqtt.connected()) {
    mqtt.disconnect();
    delay(100);
  }
  
  oledShow("OTA固件升级", "正在连接服务器...", "", "");
  sendOTAStatus("started", 0);
  
  // 3. 配置HTTP客户端（支持HTTP和HTTPS）
  HTTPClient http;
  http.setTimeout(30000);  // 30秒超时
  
  // 根据URL协议选择Client
  if (url.startsWith("https://")) {
    WiFiClientSecure httpsClient;
    httpsClient.setInsecure();  // 跳过证书验证
    http.begin(httpsClient, url);
  } else {
    WiFiClient wifiClient;
    http.begin(wifiClient, url);
  }
  
  // 4. 发送HTTP GET请求
  int httpCode = http.GET();
  Serial.printf("HTTP响应码: %d\n", httpCode);
  
  if (httpCode <= 0) {
    Serial.printf("HTTP请求失败: %s\n", http.errorToString(httpCode).c_str());
    oledShow("OTA下载失败", "HTTP请求失败", "将自动重启...", "");
    sendOTAStatus("download_failed", -1);
    http.end();
    delay(3000);
    ESP.restart();
    return;
  }
  
  if (httpCode != HTTP_CODE_OK) {
    Serial.printf("HTTP状态码异常: %d\n", httpCode);
    oledShow("OTA下载失败", "HTTP " + String(httpCode), "将自动重启...", "");
    sendOTAStatus("download_failed", -1);
    http.end();
    delay(3000);
    ESP.restart();
    return;
  }
  
  // 5. 获取固件大小
  int contentLength = http.getSize();
  if (contentLength <= 0) {
    contentLength = 0x100000;  // 未知大小，使用1MB估算
    Serial.println("警告: 无法获取固件大小，使用默认值");
  }
  
  Serial.printf("固件大小: %d 字节\n", contentLength);
  
  // 6. 检查可用空间
  if (contentLength > ESP.getFreeSketchSpace()) {
    Serial.printf("空间不足！需要: %d, 可用: %d\n", 
                  contentLength, ESP.getFreeSketchSpace());
    oledShow("OTA升级失败", "空间不足", "将自动重启...", "");
    sendOTAStatus("space_insufficient", -1);
    http.end();
    delay(3000);
    ESP.restart();
    return;
  }
  
  // 7. 开始OTA写入
  if (!Update.begin(contentLength)) {
    Serial.printf("Update.begin() 失败，错误码: %d\n", Update.getError());
    oledShow("OTA开始失败", "错误码:" + String(Update.getError()), "将自动重启...", "");
    sendOTAStatus("begin_failed", -1);
    http.end();
    delay(3000);
    ESP.restart();
    return;
  }
  
  oledShow("OTA固件升级", "正在下载固件...", "", "");
  sendOTAStatus("downloading", 0);
  
  // 8. 流式写入固件数据
  WiFiClient* stream = http.getStreamPtr();
  uint8_t buffer[1024];
  size_t written = 0;
  int lastProgress = -1;
  unsigned long lastReportTime = millis();
  
  while (http.connected() && (written < (size_t)contentLength)) {
    size_t available = stream->available();
    if (available == 0) {
      delay(1);
      // 防止死循环：30秒无数据则超时
      if (millis() - lastReportTime > 30000) {
        Serial.println("下载超时");
        break;
      }
      continue;
    }
    
    size_t toRead = (available > sizeof(buffer)) ? sizeof(buffer) : available;
    size_t bytesRead = stream->readBytes(buffer, toRead);
    if (bytesRead > 0) {
      size_t bytesWritten = Update.write(buffer, bytesRead);
      if (bytesWritten != bytesRead) {
        Serial.printf("写入错误: 期望%d字节，实际写入%d字节\n", bytesRead, bytesWritten);
      }
      written += bytesWritten;
      lastReportTime = millis();
      
      // 每10%上报一次进度
      int progress = (contentLength > 0) ? (written * 100 / contentLength) : 0;
      if (progress >= lastProgress + 10) {
        lastProgress = progress;
        oledShow("OTA固件升级", "进度: " + String(progress) + "%", 
                 String(written / 1024) + "KB/" + String(contentLength / 1024) + "KB", "");
        sendOTAStatus("updating", progress);
        Serial.printf("OTA进度: %d%% (%d/%d)\n", progress, written, contentLength);
      }
    }
  }
  
  http.end();
  
  Serial.printf("下载完成: %d 字节 (期望 %d 字节)\n", written, contentLength);
  
  // 9. 完成OTA写入
  if (written > 0 && Update.end(true)) {
    if (Update.isFinished()) {
      Serial.println("OTA升级成功！即将重启...");
      oledShow("OTA升级成功", "版本: " FIRMWARE_VERSION, "即将重启...", "");
      sendOTAStatus("success", 100);
      setLED(false, true);  // 绿灯亮，升级成功
      delay(3000);
      ESP.restart();
    } else {
      Serial.printf("Update.end() 成功但未标记完成，错误: %d\n", Update.getError());
      oledShow("OTA异常", "错误码:" + String(Update.getError()), "尝试重启...", "");
      sendOTAStatus("incomplete", -1);
      delay(3000);
      ESP.restart();
    }
  } else {
    Serial.printf("OTA升级失败！错误码: %d\n", Update.getError());
    oledShow("OTA升级失败", "错误码:" + String(Update.getError()), "将重启回滚...", "");
    sendOTAStatus("failed", -1);
    setLED(true, false);  // 红灯亮，升级失败
    delay(5000);
    ESP.restart();
  }
}

void setup() {
  // ========== 启动信息 ==========
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n======================================");
  Serial.println("        PhoneBox ESP32 系统启动");
  Serial.println("======================================");
  Serial.printf("固件版本: v%s\n", FIRMWARE_VERSION);
  Serial.printf("编译时间: %s %s\n", __DATE__, __TIME__);
  
  // 检测硬件平台
  detectPlatform();
  
  // 显示内存信息
  Serial.printf("可用内存: %d bytes\n", ESP.getFreeHeap());
  Serial.println("======================================");
  
  // ========== 引脚初始化 ==========
  Serial.println("\n[初始化] 配置GPIO引脚...");
  
  pinMode(RELAY_A, OUTPUT); 
  digitalWrite(RELAY_A, LOW);
  
  pinMode(RELAY_B, OUTPUT); 
  digitalWrite(RELAY_B, LOW);
  
  pinMode(LED_RED, OUTPUT); digitalWrite(LED_RED, HIGH);
  pinMode(LED_GREEN, OUTPUT); digitalWrite(LED_GREEN, HIGH);
  pinMode(BUZZER, OUTPUT); digitalWrite(BUZZER, HIGH);
  
  pinMode(DOOR_A, INPUT_PULLUP);
  pinMode(DOOR_B, INPUT_PULLUP);
  pinMode(CONFIG_PIN, INPUT_PULLUP);
  
  pinMode(RFID_RESET, OUTPUT); digitalWrite(RFID_RESET, HIGH);
  
  memset(&stateVars, 0, sizeof(stateVars));
  
  // ========== 引脚测试 ==========
  testPins();
  
  // ========== OLED初始化 ==========
  Serial.println("\n[初始化] 启动OLED显示...");
  u8g2.begin();
  oledShow("系统启动 v" FIRMWARE_VERSION, "初始化中...", platformName, "");
  
  // ========== 加载配置 ==========
  Serial.println("\n[初始化] 加载配置...");
  loadConfig();
  
  if (strlen(config.wifi_ssid) == 0) {
    Serial.println("WiFi not configured, entering config mode automatically");
    isConfigMode = true;
    configModeStartTime = millis();
    startAP();
    server.on("/", HTTP_GET, handleRoot);
    server.on("/save", HTTP_POST, handleSave);
    server.on("/reset", HTTP_POST, handleReset);
    server.onNotFound(handleNotFound);
    server.begin();
    Serial.println("Web server started with Captive Portal");
  } else {
    checkConfigMode();
  }
  
  if (!isConfigMode) {
    Serial.printf("Initializing Serial2: baud=%d, RX=GPIO16, TX=GPIO17\n", config.rfid_baud);
    Serial2.begin(config.rfid_baud, SERIAL_8N1, 16, 17);
    delay(100);
    
    Serial.println("Checking Serial2 connection...");
    Serial2.println("AT");
    delay(500);
    
    String testResp = "";
    while (Serial2.available() > 0) {
      testResp += (char)Serial2.read();
    }
    Serial.printf("Serial2 test response: [%s]\n", testResp.c_str());
    
    initNF01();
    
    if (setup_wifi()) {
      mqtt.setServer(config.mqtt_server, config.mqtt_port);
      mqtt.setCallback(mqttCallback);
      
      if (config.mqtt_ssl) {
        espClient.setInsecure();
        Serial.println("MQTT SSL enabled");
      }
      
      reconnect();
      
      // 配置ArduinoOTA（本地IDE/开发工具无线烧录）
      // 设备需与电脑在同一局域网，使用 "ESP32 mDNS名称" 或 IP 即可发现
      ArduinoOTA.setHostname(config.mqtt_client_id);
      ArduinoOTA.setPassword("phonebox_ota");  // OTA密码，防止未授权烧录
      ArduinoOTA.onStart([]() {
        String type = (ArduinoOTA.getCommand() == U_FLASH) ? "固件" : "文件系统";
        Serial.printf("ArduinoOTA 开始: %s\n", type.c_str());
        oledShow("ArduinoOTA", "正在接收固件...", "", "");
        // 安全关闭继电器
        digitalWrite(RELAY_A, LOW);
        digitalWrite(RELAY_B, LOW);
      });
      ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
        int pct = (progress * 100) / total;
        if (pct % 20 == 0) {
          oledShow("ArduinoOTA", "进度: " + String(pct) + "%", "", "");
        }
      });
      ArduinoOTA.onEnd([]() {
        Serial.println("ArduinoOTA 完成，即将重启");
        oledShow("OTA完成", "即将重启...", "", "");
      });
      ArduinoOTA.onError([](ota_error_t error) {
        Serial.printf("ArduinoOTA 错误[%u]: ", error);
        oledShow("OTA错误", "错误码:" + String(error), "请重试", "");
        delay(2000);
      });
      ArduinoOTA.begin();
      Serial.println("ArduinoOTA ready (password: phonebox_ota)");
    } else {
      oledShow("WiFi连接失败", "长按按键3秒", "进入配网模式", "");
    }
  }
  
  startBeep(1, 200);
}

void loop() {
  // ArduinoOTA 本地无线烧录监听（优先级最高）
  ArduinoOTA.handle();
  
  updateBeep();
  
  // OTA远程升级：在loop中安全处理（避免在MQTT回调中阻塞）
  if (stateVars.otaPending && currentState != STATE_OTA_UPDATING) {
    stateVars.otaPending = false;
    currentState = STATE_OTA_UPDATING;
    Serial.println("开始执行OTA远程升级...");
    performOTAUpdate(stateVars.otaUrl);
    // performOTAUpdate 成功后会自动重启，不会执行到这里
    // 如果执行到这里说明升级失败已重启，以下为安全兜底
    return;
  }
  
  if (isConfigMode) {
    dnsServer.processNextRequest();
    server.handleClient();
    if (millis() - configModeStartTime > 180000) {
      ESP.restart();
    }
    return;
  }
  
  updateStateMachine();
  
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqtt.connected()) reconnect();
    mqtt.loop();
    
    // 心跳发送逻辑
    if (mqtt.connected() && millis() - stateVars.lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
      stateVars.lastHeartbeatTime = millis();
      sendHeartbeat();
    }
  }
  
  // 门状态检测接口 - 保留供后续扩展
  // 当前使用锁状态反馈，此代码暂不启用
  // if (millis() - stateVars.lastDoorCheck > 5000) {
  //   stateVars.lastDoorCheck = millis();
  //   if (digitalRead(DOOR_A) == LOW) sendStatus("A", "closed");
  //   else sendStatus("A", "open");
  //   if (digitalRead(DOOR_B) == LOW) sendStatus("B", "closed");
  //   else sendStatus("B", "open");
  // }
  
  if (WiFi.status() == WL_CONNECTED && mqtt.connected() && currentState == STATE_IDLE) {
    processRFID();
  }
  
  checkConfigMode();
}

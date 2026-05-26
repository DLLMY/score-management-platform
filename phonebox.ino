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
 * @version 2.4
 */

#include <WiFi.h>
#include <WebServer.h>
#include <PubSubClient.h>
#include <U8g2lib.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <WiFiClientSecure.h>
#include <DNSServer.h>

#define RELAY_A    4
#define RELAY_B    16
#define LED_RED    25
#define LED_GREEN  26
#define BUZZER     27
#define DOOR_A     32
#define DOOR_B     33
#define CONFIG_PIN 15
#define RFID_RESET 23

#define EEPROM_SIZE     512
#define CONFIG_VERSION  100
#define DEBUG_VERSION   13              // 每次烧录需要重置时递增此值
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

typedef enum {
  STATE_IDLE,
  STATE_UNLOCKING_A,
  STATE_UNLOCKING_B,
  STATE_ERROR_B,
  STATE_SHOWING_CARD
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
} stateVars;

void loadConfig();
void saveConfig();
void setLED(bool red, bool green);
void startBeep(int times, int durationMs);
void updateBeep();
void oledShow(String line1, String line2 = "", String line3 = String(), String line4 = String());
void sendStatus(String box, String status);
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
  digitalWrite(BUZZER, HIGH);
}

void updateBeep() {
  if (!stateVars.beeping) return;
  
  unsigned long elapsed = millis() - stateVars.beepStartTime;
  int cycle = stateVars.beepDuration * 2;
  int currentCycle = elapsed / cycle;
  int positionInCycle = elapsed % cycle;
  
  if (currentCycle >= stateVars.beepRemainingTimes) {
    stateVars.beeping = false;
    digitalWrite(BUZZER, LOW);
    return;
  }
  
  digitalWrite(BUZZER, positionInCycle < stateVars.beepDuration ? HIGH : LOW);
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

void triggerUnlock(String boxId) {
  currentState = boxId == "A" ? STATE_UNLOCKING_A : STATE_UNLOCKING_B;
  currentBoxId = boxId;
  stateStartTime = millis();
  
  int relayPin = boxId == "A" ? RELAY_A : RELAY_B;
  digitalWrite(relayPin, HIGH);
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
      }
      break;
      
    case STATE_SHOWING_CARD:
      if (elapsed >= 2000) {
        oledShow("手机管理箱", "A箱:远程等待", "B箱:请刷卡", "就绪");
        currentState = STATE_IDLE;
      }
      break;
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
  Serial.printf("MQTT recv: %s -> %s\n", topic, message.c_str());

  if (String(topic) == TOPIC_UNLOCK_A && currentState == STATE_IDLE) {
    triggerUnlock("A");
  } else if (String(topic) == TOPIC_UNLOCK_B) {
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, message);
    if (!error) {
      String result = doc["result"] | "false";
      if (result == "true" && currentState == STATE_IDLE) {
        triggerUnlock("B");
      } else if (result == "false") {
        errorReason = doc["reason"] | "unknown";
        errorScore = doc["current_score"] | 0;
        currentState = STATE_ERROR_B;
        stateStartTime = millis();
        
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
      oledShow("手机管理箱", "A箱:远程等待", "B箱:请刷卡", "MQTT已连接");
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
  bool buttonPressed = digitalRead(CONFIG_PIN) == LOW;
  
  if (buttonPressed && pressStartTime == 0) {
    pressStartTime = millis();
  } else if (!buttonPressed && pressStartTime > 0) {
    if (millis() - pressStartTime >= 3000) {
      Serial.println("Entering config mode via button");
      isConfigMode = true;
      configModeStartTime = millis();
      startAP();
      server.on("/", HTTP_GET, handleRoot);
      server.on("/save", HTTP_POST, handleSave);
      server.on("/reset", HTTP_POST, handleReset);
      server.onNotFound(handleNotFound);
      server.begin();
      Serial.println("Web server started on 192.168.4.1");
    }
    pressStartTime = 0;
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
  unsigned long initStart = millis();
  sendNF01Command("AT");
  
  while (millis() - initStart < 100) {
    if (Serial2.available() > 0) {
      Serial.print("NF01 init response: ");
      String response = Serial2.readStringUntil('\n');
      Serial.println(response);
    }
  }
  
  sendNF01Command("AT+RESET");
  delay(100);
}

void processRFID() {
  if (currentState != STATE_IDLE) return;
  
  if (millis() - stateVars.lastQueryTime >= 500) {
    stateVars.lastQueryTime = millis();
    sendNF01Command("AT+UID");
  }
  
  while (Serial2.available() > 0) {
    char c = Serial2.read();
    if (c == '\n' || c == '\r') {
      String cardId = parseNF01Response(stateVars.responseBuffer);
      if (cardId.length() > 0 && millis() - stateVars.lastReadTime > 2000) {
        stateVars.lastReadTime = millis();
        Serial.println("Card detected: " + cardId);
        setLED(false, false);
        oledShow("B箱刷卡", "卡号:" + cardId, "验证中...", "");
        
        StaticJsonDocument<256> doc;
        doc["box_id"] = "B";
        doc["card_id"] = cardId;
        doc["timestamp"] = millis() / 1000;
        doc["type"] = "query";
        String jsonStr;
        serializeJson(doc, jsonStr);
        mqtt.publish(TOPIC_QUERY, jsonStr.c_str());
        
        currentState = STATE_SHOWING_CARD;
        stateStartTime = millis();
      }
      stateVars.responseBuffer = "";
    } else {
      stateVars.responseBuffer += c;
      if (stateVars.responseBuffer.length() > 64) {
        stateVars.responseBuffer = "";
      }
    }
  }
}

void setup() {
  Serial.begin(115200);
  
  pinMode(RELAY_A, OUTPUT); digitalWrite(RELAY_A, LOW);
  pinMode(RELAY_B, OUTPUT); digitalWrite(RELAY_B, LOW);
  pinMode(LED_RED, OUTPUT); digitalWrite(LED_RED, HIGH);
  pinMode(LED_GREEN, OUTPUT); digitalWrite(LED_GREEN, HIGH);
  pinMode(BUZZER, OUTPUT); digitalWrite(BUZZER, LOW);
  
  pinMode(DOOR_A, INPUT_PULLUP);
  pinMode(DOOR_B, INPUT_PULLUP);
  pinMode(CONFIG_PIN, INPUT_PULLUP);
  
  pinMode(RFID_RESET, OUTPUT); digitalWrite(RFID_RESET, HIGH);
  
  memset(&stateVars, 0, sizeof(stateVars));
  
  u8g2.begin();
  oledShow("系统启动", "初始化中...", "", "");
  
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
    Serial2.begin(config.rfid_baud);
    initNF01();
    
    if (setup_wifi()) {
      mqtt.setServer(config.mqtt_server, config.mqtt_port);
      mqtt.setCallback(mqttCallback);
      
      if (config.mqtt_ssl) {
        espClient.setInsecure();
        Serial.println("MQTT SSL enabled");
      }
      
      reconnect();
    } else {
      oledShow("WiFi连接失败", "长按按键3秒", "进入配网模式", "");
    }
  }
  
  startBeep(1, 200);
}

void loop() {
  updateBeep();
  
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
  
  if (!isConfigMode && WiFi.status() != WL_CONNECTED) {
    checkConfigMode();
  }
}

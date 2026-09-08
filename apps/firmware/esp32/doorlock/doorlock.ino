/*
 * 门禁系统 DoorLock v2.0 (FreeRTOS多线程版)
 * 基于 ESP32-S3 N8R2
 * 
 * 功能：密码开门、刷卡开门、积分管理、OTA升级、配网功能
 * 
 * 线程设计：
 * - 键盘扫描任务 (优先级1) - 高优先级，及时响应按键
 * - RFID读取任务 (优先级1) - 高优先级，及时读取卡片
 * - 状态机处理任务 (优先级2) - 中优先级，业务逻辑处理
 * - MQTT通信任务 (优先级3) - 中优先级，网络通信
 * - LCD显示任务 (优先级4) - 低优先级，显示输出
 */

// ============== 必需库 ==============
#include <Arduino.h>
#include <WiFi.h>
#include <Wire.h>
#include <EEPROM.h>
#include <DNSServer.h>
#include <WebServer.h>
#include <WiFiClientSecure.h>
#include <ArduinoOTA.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>

// ============== 第三方库 ==============
#include <PubSubClient.h>

// ============== 引脚定义 ==============
// ESP32-S3-N8R2 引脚分配（每两个引脚空一个位置，减少干扰）
// 第一组（连接器1物理顺序）：4、5、6、7、15、16、17、18、8、3、46、9、10、11、12、13、14
// 第二组（连接器2物理顺序）：19、20、21、47、48、45、0、35、36、37、38、39、40、41、42、2、1
// 分配原则：每使用2个引脚空1个位置（危险引脚自动跳过）

// 键盘引脚 - 使用第一组（使用:4,5 空:6 使用:7,15 空:16 使用:17,18）
#define KEYPAD_R1     4     // 行线1 (GPIO4) - 第1位
#define KEYPAD_R2     5     // 行线2 (GPIO5) - 第2位
// 空:6 - 第3位
#define KEYPAD_R3     7     // 行线3 (GPIO7) - 第4位
#define KEYPAD_C1    15     // 列线1 (GPIO15) - 第5位
// 空:16 - 第6位
#define KEYPAD_C2    17     // 列线2 (GPIO17) - 第7位
#define KEYPAD_C3    18     // 列线3 (GPIO18) - 第8位

// LCD I2C引脚 - 使用第一组（使用:8,9）
// ESP32-S3 I2C0标准引脚: SDA=GPIO8, SCL=GPIO9（硬件I2C，稳定性更好）
#define LCD_SDA       8     // I2C0数据 (GPIO8) - 第一组第9位
#define LCD_SCL       9     // I2C0时钟 (GPIO9) - 第一组第12位

// 继电器控制 - 使用第一组（空:10 使用:11,12 空:13 使用:14）
// 空:10 - 第13位
#define RELAY_PIN    11     // 门锁控制 (GPIO11) - 第14位
#define RELAY_PHONE  12     // 手机箱A继电器控制 (GPIO12) - 第15位
// 空:13 - 第16位
#define RELAY_PHONE_B 14    // 手机箱B继电器控制 (GPIO14) - 第17位

// LED指示和蜂鸣器 - 使用第二组（使用:19 空:20,21 使用:45,35 空:36 使用:39）
#define LED_RED      19     // 红色LED (GPIO19) - 第二组第1位
// 空:20,21 - 第二组第2-3位(UART2标准引脚，留给RFID)
#define BUZZER_PIN   45     // 蜂鸣器 (GPIO45) - 第二组第6位
#define CONFIG_PIN   35     // 配网按键 (GPIO35) - 第二组第8位
// 空:36 - 第二组第9位
#define LED_GREEN    39     // 绿色LED (GPIO39) - 第二组第12位

// RFID引脚 - 使用UART2标准引脚（硬件串口，稳定性更好）
// ESP32-S3 UART2: RX=GPIO20, TX=GPIO21
#define RFID_TX      21     // RFID TX → ESP32 RX (GPIO21) - 第二组第3位
#define RFID_RX      20     // RFID RX → ESP32 TX (GPIO20) - 第二组第2位

// ============== 配置参数 ==============
#define EEPROM_SIZE     512
#define CONFIG_VERSION  1
#define DEBUG_VERSION   9              // 递增以重置配置
#define AP_SSID         "DoorLock-Config"
#define AP_PASSWORD     "12345678"
#define AP_IP           IPAddress(192, 168, 4, 1)
#define DNS_PORT        53

// ============== FreeRTOS配置 ==============
#define TASK_PRIORITY_KEYPAD    1    // 键盘扫描任务优先级（最高）
#define TASK_PRIORITY_RFID      1    // RFID读取任务优先级（最高）
#define TASK_PRIORITY_STATE     2    // 状态机处理任务优先级（中）
#define TASK_PRIORITY_MQTT      3    // MQTT通信任务优先级（中）
#define TASK_PRIORITY_LCD       4    // LCD显示任务优先级（低）

#define QUEUE_SIZE_KEY          8     // 键盘队列大小
#define QUEUE_SIZE_CARD         4     // 卡片队列大小
#define QUEUE_SIZE_LCD          4     // LCD显示队列大小

// ============== 系统状态 ==============
typedef enum {
  STATE_IDLE,
  STATE_PASSWORD_INPUT,
  STATE_MENU,
  STATE_INPUT_NUMBER,
  STATE_INPUT_AMOUNT,
  STATE_WAITING_MQTT,
  STATE_SHOW_RESULT,
  STATE_CHANGE_PASSWORD,
  STATE_INPUT_NEW_PASSWORD,
  STATE_CONFIRM_NEW_PASSWORD,
  STATE_REGISTER_CARD,
  STATE_DELETE_CARD,
  STATE_PHONEBOX_QUERY,
  STATE_PHONEBOX_OPENING,
  STATE_DOOR_OPENING,
  STATE_SHOW_MESSAGE
} SystemState;

typedef enum {
  OP_NONE,
  OP_QUERY,
  OP_ADD,
  OP_SUB,
  OP_PHONEBOX
} PointsOperation;

// ============== 配置结构体 ==============
typedef struct {
  int config_version;
  int debug_version;
  char wifi_ssid[32];
  char wifi_password[64];
  char mqtt_server[64];
  int mqtt_port;
  char mqtt_client_id[32];
  char mqtt_username[32];
  char mqtt_password[64];
  char door_password[16];
} Config;

typedef struct {
  String currentCardId;
  String currentCardUser;
  String inputBuffer;
  String targetNumber;
  String newPassword;
  String confirmPassword;
  String newCardName;
  int pointsAmount;
  PointsOperation pendingOp;
  String requestId;
  String messageLine1;
  String messageLine2;
} OperationContext;

unsigned long doorOpenTime = 0;

// ============== LCD显示消息结构体 ==============
typedef struct {
  char line1[17];
  char line2[17];
} LcdMessage;

// ============== 全局对象 ==============
WiFiClientSecure wifiClient;
PubSubClient mqttClient(wifiClient);
DNSServer dnsServer;
WebServer webServer(80);
HardwareSerial RFIDSerial(2);

// ============== 全局变量 ==============
Config config;
bool isConfigMode = false;
SystemState currentState = STATE_IDLE;
OperationContext context;
unsigned long lastActivityTime = 0;
unsigned long mqttWaitStartTime = 0;  // MQTT等待超时计时器
#define MQTT_WAIT_TIMEOUT 10000       // MQTT响应超时时间（10秒）

// 键盘变量
const byte KEYPAD_ROWS = 4;
const byte KEYPAD_COLS = 3;
char keys[KEYPAD_ROWS][KEYPAD_COLS] = {
  {'1', '2', '3'},
  {'4', '5', '6'},
  {'7', '8', '9'},
  {'*', '0', '#'}
};
byte rowPins[KEYPAD_ROWS] = {KEYPAD_R1, KEYPAD_R2, KEYPAD_R3, KEYPAD_R4};
byte colPins[KEYPAD_COLS] = {KEYPAD_C1, KEYPAD_C2, KEYPAD_C3};

// 有效卡号
struct Card {
  String id;
  String user;
} validCards[] = {
  {"ED7140EB", "Card 1"},
  {"3A76B29F", "Zhang San"},
  {"4B87C3A0", "Li Si"},
  {"5C98D4B1", "Wang Wu"},
  {"6DA9E5C2", "Zhao Liu"}
};
const int cardCount = sizeof(validCards) / sizeof(validCards[0]);
const String masterPassword = "123456";

// ============== LCD 全局变量 ==============
uint8_t lcdAddr = 0;
bool lcdInitialized = false;

// ============== FreeRTOS任务句柄和队列 ==============
TaskHandle_t taskHandleKeypad = NULL;
TaskHandle_t taskHandleRFID = NULL;
TaskHandle_t taskHandleState = NULL;
TaskHandle_t taskHandleMQTT = NULL;
TaskHandle_t taskHandleLCD = NULL;

QueueHandle_t queueKey = NULL;
QueueHandle_t queueCard = NULL;
QueueHandle_t queueLCD = NULL;

// ============== I2C扫描函数 ==============
void scanI2C() {
  Serial.println("      正在扫描 I2C 总线...");
  byte error, address;
  int nDevices = 0;
  
  for(address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    error = Wire.endTransmission();
    
    if (error == 0) {
      Serial.print("      找到设备: 0x");
      if (address < 16) Serial.print("0");
      Serial.println(address, HEX);
      nDevices++;
      
      switch(address) {
        case 0x20: case 0x21: case 0x22: case 0x23:
        case 0x24: case 0x25: case 0x26: case 0x27:
          Serial.println("        (可能是 PCF8574 LCD I2C)");
          break;
        case 0x38: case 0x39: case 0x3A: case 0x3B:
        case 0x3C: case 0x3D: case 0x3E: case 0x3F:
          Serial.println("        (可能是 PCF8574AT LCD I2C)");
          break;
        default:
          Serial.println("        (未知设备)");
      }
    }
  }
  
  if (nDevices == 0) {
    Serial.println("      I2C 总线上未找到任何设备!");
    Serial.println("      请检查:");
    Serial.println("      1. SDA/SCL 接线是否正确");
    Serial.println("      2. 设备是否供电");
    Serial.println("      3. 上拉电阻是否存在");
  }
}

// ============== 检测 LCD I2C 地址 ==============
bool detectLcdAddress() {
  byte addresses[] = {0x27, 0x3F, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x3E};
  
  for (int i = 0; i < sizeof(addresses); i++) {
    Wire.beginTransmission(addresses[i]);
    if (Wire.endTransmission() == 0) {
      lcdAddr = addresses[i];
      Serial.print("      检测 LCD 地址... 找到 LCD，地址：0x");
      Serial.println(lcdAddr, HEX);
      return true;
    }
  }
  
  return false;
}

// ============== 原生 LCD 控制函数 ==============
void lcdRawWrite(uint8_t addr, uint8_t rs, uint8_t data) {
  uint8_t high = (rs << 0) | (0 << 1) | (1 << 3) | ((data >> 4) & 0x0F) << 4;
  uint8_t low = (rs << 0) | (0 << 1) | (1 << 3) | (data & 0x0F) << 4;
  
  Wire.beginTransmission(addr);
  Wire.write(high | 0x04);
  Wire.endTransmission();
  delayMicroseconds(1);
  
  Wire.beginTransmission(addr);
  Wire.write(high & ~0x04);
  Wire.endTransmission();
  delayMicroseconds(1);
  
  Wire.beginTransmission(addr);
  Wire.write(low | 0x04);
  Wire.endTransmission();
  delayMicroseconds(1);
  
  Wire.beginTransmission(addr);
  Wire.write(low & ~0x04);
  Wire.endTransmission();
  delayMicroseconds(50);
}

// ============== 初始化 LCD ==============
bool initLcdWithRetry() {
  Wire.begin(LCD_SDA, LCD_SCL);
  
  if (!detectLcdAddress()) {
    Serial.println("      未找到 LCD!");
    scanI2C();
    return false;
  }
  
  Serial.print("      使用检测到的地址 0x");
  Serial.println(lcdAddr, HEX);
  
  delay(100);
  
  Wire.beginTransmission(lcdAddr);
  Wire.write(0x3C);
  Wire.endTransmission();
  Wire.beginTransmission(lcdAddr);
  Wire.write(0x38);
  Wire.endTransmission();
  delay(5);
  
  Wire.beginTransmission(lcdAddr);
  Wire.write(0x3C);
  Wire.endTransmission();
  Wire.beginTransmission(lcdAddr);
  Wire.write(0x38);
  Wire.endTransmission();
  delay(1);
  
  Wire.beginTransmission(lcdAddr);
  Wire.write(0x3C);
  Wire.endTransmission();
  Wire.beginTransmission(lcdAddr);
  Wire.write(0x38);
  Wire.endTransmission();
  delay(1);
  
  Wire.beginTransmission(lcdAddr);
  Wire.write(0x2C);
  Wire.endTransmission();
  Wire.beginTransmission(lcdAddr);
  Wire.write(0x28);
  Wire.endTransmission();
  delay(1);
  
  lcdRawWrite(lcdAddr, 0, 0x28);
  delay(5);
  
  lcdRawWrite(lcdAddr, 0, 0x08);
  delay(5);
  
  lcdRawWrite(lcdAddr, 0, 0x01);
  delay(10);
  
  lcdRawWrite(lcdAddr, 0, 0x06);
  delay(5);
  
  lcdRawWrite(lcdAddr, 0, 0x0C);
  delay(5);
  
  lcdRawWrite(lcdAddr, 0, 0x80);
  delay(1);
  
  lcdRawWrite(lcdAddr, 1, 'H');
  delay(1);
  lcdRawWrite(lcdAddr, 1, 'i');
  delay(1);
  
  delay(100);
  
  lcdRawWrite(lcdAddr, 0, 0x01);
  delay(10);
  
  Serial.println("      LCD 初始化成功!");
  return true;
}

// ============== LCD显示函数（直接显示） ==============
void lcdDirectShow(const char* line1, const char* line2) {
  if (!lcdInitialized) {
    Serial.println("[LCD] Not initialized");
    return;
  }
  
  Serial.print("[LCD] Show: '");
  Serial.print(line1);
  Serial.print("' / '");
  Serial.print(line2);
  Serial.println("'");
  
  lcdRawWrite(lcdAddr, 0, 0x01);
  delay(2);
  
  lcdRawWrite(lcdAddr, 0, 0x80);
  for (int i = 0; i < 16 && line1[i] != '\0'; i++) {
    lcdRawWrite(lcdAddr, 1, line1[i]);
  }
  
  lcdRawWrite(lcdAddr, 0, 0xC0);
  for (int i = 0; i < 16 && line2[i] != '\0'; i++) {
    lcdRawWrite(lcdAddr, 1, line2[i]);
  }
}

// ============== LCD显示函数（通过队列） ==============
void lcdShow(String line1, String line2) {
  if (!lcdInitialized) {
    Serial.println("[LCD] Not initialized");
    return;
  }
  
  if (queueLCD != NULL) {
    LcdMessage msg;
    strncpy(msg.line1, line1.c_str(), sizeof(msg.line1) - 1);
    msg.line1[sizeof(msg.line1) - 1] = '\0';
    strncpy(msg.line2, line2.c_str(), sizeof(msg.line2) - 1);
    msg.line2[sizeof(msg.line2) - 1] = '\0';
    
    xQueueSend(queueLCD, &msg, pdMS_TO_TICKS(100));
  } else {
    lcdDirectShow(line1.c_str(), line2.c_str());
  }
}

// ============== 键盘初始化 ==============
void initKeypad() {
  Serial.println("[KEYPAD] 初始化键盘...");
  for (int i = 0; i < KEYPAD_ROWS; i++) {
    pinMode(rowPins[i], INPUT_PULLUP);
  }
  for (int i = 0; i < KEYPAD_COLS; i++) {
    pinMode(colPins[i], OUTPUT);
    digitalWrite(colPins[i], HIGH);
  }
  Serial.println("[KEYPAD] 键盘初始化完成");
}

// ============== 非阻塞键盘扫描 ==============
char scanKeypad() {
  static unsigned long lastDebounceTime = 0;
  static bool keyReleased = true;
  unsigned long now = millis();
  
  if (now - lastDebounceTime < 200) return '\0';
  
  for (int col = 0; col < KEYPAD_COLS; col++) {
    digitalWrite(colPins[col], LOW);
    
    for (int row = 0; row < KEYPAD_ROWS; row++) {
      if (digitalRead(rowPins[row]) == LOW) {
        if (keyReleased) {
          keyReleased = false;
          lastDebounceTime = millis();
          char key = keys[row][col];
          
          for (int c = 0; c < KEYPAD_COLS; c++) {
            digitalWrite(colPins[c], HIGH);
          }
          return key;
        }
      }
    }
    
    digitalWrite(colPins[col], HIGH);
  }
  
  bool allHigh = true;
  for (int row = 0; row < KEYPAD_ROWS; row++) {
    if (digitalRead(rowPins[row]) == LOW) {
      allHigh = false;
      break;
    }
  }
  if (allHigh) {
    keyReleased = true;
  }
  
  return '\0';
}

// ============== RFID初始化（DX-NF01模块） ==============
void initRFID() {
  Serial.println("[RFID] 初始化DX-NF01 RFID模块...");
  Serial.printf("[RFID] 串口波特率: %d\n", 9600);
  
  // 等待模块上电稳定
  delay(1500);
  
  // 清空串口缓冲区
  Serial.println("[RFID] 清空缓冲区...");
  while (RFIDSerial.available() > 0) {
    RFIDSerial.read();
  }
  
  // 测试AT命令通信
  Serial.println("[RFID] 测试AT命令...");
  RFIDSerial.println("AT");
  delay(1000);
  
  String response = "";
  while (RFIDSerial.available() > 0) {
    response += (char)RFIDSerial.read();
  }
  Serial.println(response);
  if (response.indexOf("OK") >= 0) {
    Serial.println("[RFID] AT命令通信正常");
  }
  
  // 复位模块
  Serial.println("[RFID] 复位模块...");
  RFIDSerial.println("AT+RESET");
  delay(1000);
  
  response = "";
  while (RFIDSerial.available() > 0) {
    response += (char)RFIDSerial.read();
  }
  Serial.println(response);
  
  // 设置自动输出模式
  Serial.println("[RFID] 设置自动输出模式...");
  delay(500);
  
  // 尝试方案1: AT+AUTOREP=ON
  RFIDSerial.println("AT+AUTOREP=ON");
  delay(1000);
  response = "";
  while (RFIDSerial.available() > 0) {
    response += (char)RFIDSerial.read();
  }
  Serial.println("[RFID] AT+AUTOREP=ON: " + response);
  
  // 尝试方案2: AT+REPORT=ON
  if (response.indexOf("OK") < 0) {
    RFIDSerial.println("AT+REPORT=ON");
    delay(1000);
    response = "";
    while (RFIDSerial.available() > 0) {
      response += (char)RFIDSerial.read();
    }
    Serial.println("[RFID] AT+REPORT=ON: " + response);
  }
  
  Serial.println("[RFID] RFID模块初始化完成");
}

// ============== RFID读取函数（DX-NF01模块） ==============
unsigned long lastCardReadTime = 0;

String readCardData() {
  static uint8_t buffer[64];
  static int bufLen = 0;
  
  // 读取所有可用数据到缓冲区
  while (RFIDSerial.available() > 0 && bufLen < 64) {
    buffer[bufLen++] = RFIDSerial.read();
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
        
        // 防重复读卡：1秒内不处理重复卡片
        if (cardId != "00000000" && millis() - lastCardReadTime > 1000) {
          lastCardReadTime = millis();
          Serial.print("[RFID] Card detected: ");
          Serial.println(cardId);
          
          bufLen = 0;
          return cardId;
        }
      }
      bufLen = 0;
      return "";
    } else if (dataLen == 0x01 && bufLen >= frameStart + 4) {
      // 卡片离开：AA BB 01 DD (4字节)
      if (buffer[frameStart + 3] == 0xDD) {
        Serial.println("[RFID] Card removed");
      }
      bufLen = 0;
      return "";
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
        
        if (cardId != "00000000" && millis() - lastCardReadTime > 1000) {
          lastCardReadTime = millis();
          Serial.print("[RFID] Card (cmd): ");
          Serial.println(cardId);
          
          bufLen = 0;
          return cardId;
        }
      }
      bufLen = 0;
      return "";
    }
  }
  
  // 缓冲区溢出保护
  if (bufLen > 64) {
    bufLen = 0;
  }
  
  return "";
}

// ============== 门锁控制 ==============
void openDoorNonBlocking() {
  digitalWrite(RELAY_PIN, HIGH);
  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(LED_RED, LOW);
  beepSuccess();
  doorOpenTime = millis();
}

void closeDoor() {
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_GREEN, LOW);
}

void lockDoor() {
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED, HIGH);
}

void checkDoorTimeout() {
  if (currentState == STATE_DOOR_OPENING && doorOpenTime > 0) {
    if (millis() - doorOpenTime >= 3000) {
      closeDoor();
      doorOpenTime = 0;
      transitionTo(STATE_MENU);
    }
  }
}

// ============== 手机箱控制 ==============
unsigned long phoneBoxOpenTime = 0;
unsigned long phoneBoxBOpenTime = 0;

void closePhoneBox() {
  digitalWrite(RELAY_PHONE, LOW);
  phoneBoxOpenTime = 0;
}

void closePhoneBoxB() {
  digitalWrite(RELAY_PHONE_B, LOW);
  phoneBoxBOpenTime = 0;
}

void checkPhoneBoxTimeout() {
  if (currentState == STATE_PHONEBOX_OPENING && phoneBoxOpenTime > 0) {
    if (millis() - phoneBoxOpenTime >= 15000) {
      closePhoneBox();
      lcdShow("PhoneBox A Closed", "");
      transitionTo(STATE_IDLE);
    }
  }
  
  if (currentState == STATE_PHONEBOX_OPENING && phoneBoxBOpenTime > 0) {
    if (millis() - phoneBoxBOpenTime >= 15000) {
      closePhoneBoxB();
      lcdShow("PhoneBox B Closed", "");
      transitionTo(STATE_IDLE);
    }
  }
}

// ============== 字符串工具函数 ==============
String repeatChar(char c, int count) {
  String result = "";
  for (int i = 0; i < count; i++) {
    result += c;
  }
  return result;
}

// ============== 密码管理 ==============
bool checkPassword(String password) {
  return password.equals(String(config.door_password));
}

bool changePassword(String oldPassword, String newPassword) {
  if (checkPassword(oldPassword)) {
    strncpy(config.door_password, newPassword.c_str(), sizeof(config.door_password) - 1);
    config.door_password[sizeof(config.door_password) - 1] = '\0';
    saveConfig();
    return true;
  }
  return false;
}

// ============== 动态卡号管理 ==============
#define MAX_CARDS 20
struct CardEntry {
  String id;
  String user;
  bool valid;
};

CardEntry registeredCards[MAX_CARDS];
int registeredCardCount = 0;

void initCardRegistry() {
  registeredCardCount = 0;
  // 初始化默认卡片
  String defaultCards[][2] = {
    {"ED7140EB", "Card 1"},
    {"3A76B29F", "Zhang San"},
    {"4B87C3A0", "Li Si"},
    {"5C98D4B1", "Wang Wu"},
    {"6DA9E5C2", "Zhao Liu"}
  };
  
  for (int i = 0; i < 5 && i < MAX_CARDS; i++) {
    registeredCards[i].id = defaultCards[i][0];
    registeredCards[i].user = defaultCards[i][1];
    registeredCards[i].valid = true;
    registeredCardCount++;
  }
}

bool registerNewCard(String cardId) {
  if (registeredCardCount >= MAX_CARDS) {
    return false;
  }
  
  // 检查是否已存在
  for (int i = 0; i < registeredCardCount; i++) {
    if (registeredCards[i].id.equalsIgnoreCase(cardId)) {
      return false;
    }
  }
  
  registeredCards[registeredCardCount].id = cardId;
  registeredCards[registeredCardCount].user = "Card " + String(registeredCardCount + 1);
  registeredCards[registeredCardCount].valid = true;
  registeredCardCount++;
  return true;
}

bool deleteCard(String cardId) {
  for (int i = 0; i < registeredCardCount; i++) {
    if (registeredCards[i].valid && registeredCards[i].id.equalsIgnoreCase(cardId)) {
      registeredCards[i].valid = false;
      return true;
    }
  }
  return false;
}

bool isValidCard(String cardId) {
  for (int i = 0; i < registeredCardCount; i++) {
    if (registeredCards[i].valid && registeredCards[i].id.equalsIgnoreCase(cardId)) {
      return true;
    }
  }
  return false;
}

String getCardUser(String cardId) {
  for (int i = 0; i < registeredCardCount; i++) {
    if (registeredCards[i].valid && registeredCards[i].id.equalsIgnoreCase(cardId)) {
      return registeredCards[i].user;
    }
  }
  return "Unknown";
}

// ============== 配置加载 ==============
void loadConfig() {
  EEPROM.get(0, config);
  
  Serial.print("Loaded config version: ");
  Serial.println(config.config_version);
  Serial.print("Loaded debug version: ");
  Serial.println(config.debug_version);
  
  if (config.config_version != CONFIG_VERSION || config.debug_version != DEBUG_VERSION) {
    Serial.println("配置版本不匹配，使用默认配置");
    
    config.config_version = CONFIG_VERSION;
    config.debug_version = DEBUG_VERSION;
    
    strcpy(config.wifi_ssid, "Tsgbgs407");
    strcpy(config.wifi_password, "12345678");
    
    strcpy(config.mqtt_server, "nc5233fc.ala.cn-hangzhou.emqxsl.cn");
    config.mqtt_port = 8883;
    strcpy(config.mqtt_client_id, "doorlock_001");
    strcpy(config.mqtt_username, "phoneboxtest");
    strcpy(config.mqtt_password, "123456");
    
    strcpy(config.door_password, "123456");
    
    saveConfig();
  }
}

// ============== 配置保存 ==============
void saveConfig() {
  EEPROM.put(0, config);
  EEPROM.commit();
  Serial.println("配置已保存");
}

// ============== 配置重置 ==============
void resetConfig() {
  Serial.println("重置配置...");
  config.config_version = 0;
  saveConfig();
  ESP.restart();
}

// ============== 配置检查 ==============
bool isConfigured() {
  return (config.config_version == CONFIG_VERSION && 
          strlen(config.wifi_ssid) > 0 && 
          strlen(config.mqtt_server) > 0);
}

// ============== 蜂鸣器函数 ==============
void beep(int duration) {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(duration);
  digitalWrite(BUZZER_PIN, LOW);
}

void beepSuccess() {
  beep(100);
  delay(50);
  beep(100);
}

void beepError() {
  beep(200);
  delay(100);
  beep(200);
  delay(100);
  beep(200);
}

// ============== WiFi连接 ==============
bool connectWiFi() {
  Serial.print("       SSID: ");
  Serial.println(config.wifi_ssid);
  
  WiFi.begin(config.wifi_ssid, config.wifi_password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    vTaskDelay(pdMS_TO_TICKS(1000));
    Serial.print(".");
    attempts++;
    if (attempts % 10 == 0) {
      lcdShow("WiFi连接中", String(attempts * 10) + "s");
    }
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("");
    Serial.print("       WiFi Connected: ");
    Serial.println(WiFi.localIP());
    lcdShow("WiFi Connected", WiFi.localIP().toString());
    return true;
  } else {
    Serial.println("");
    Serial.println("       WiFi连接失败!");
    return false;
  }
}

// ============== MQTT初始化 ==============
void initMQTT() {
  Serial.println("       初始化MQTT...");
  Serial.print("       Server: ");
  Serial.print(config.mqtt_server);
  Serial.print(":");
  Serial.println(config.mqtt_port);
  
  wifiClient.setInsecure();
  mqttClient.setServer(config.mqtt_server, config.mqtt_port);
  Serial.println("       MQTT初始化完成");
}

// ============== MQTT重连 ==============
bool reconnectMQTT() {
  if (!mqttClient.connected()) {
    static int connectAttempts = 0;
    
    connectAttempts++;
    if (connectAttempts > 10) {
      connectAttempts = 0;
      Serial.println("[MQTT] 连接失败次数过多，继续运行");
      return false;
    }
    
    Serial.print("[MQTT] 尝试连接... ");
    
    if (mqttClient.connect(config.mqtt_client_id, config.mqtt_username, config.mqtt_password)) {
      Serial.println("[MQTT] Connected");
      lcdShow("MQTT Connected", "Ready");
      
      // 订阅积分结果主题
      mqttClient.subscribe("phonebox/points/result");
      // 订阅广播命令主题（所有设备）
      mqttClient.subscribe("phonebox/command");
      // 订阅设备特定命令主题
      String deviceCommandTopic = "phonebox/command/" + String(config.mqtt_client_id);
      mqttClient.subscribe(deviceCommandTopic.c_str());
      // 订阅手机箱开锁响应
      mqttClient.subscribe("phonebox/unlock/B");
      // 订阅审批通知主题
      mqttClient.subscribe("phonebox/notification");
      
      Serial.println("[MQTT] 订阅主题: phonebox/points/result");
      Serial.println("[MQTT] 订阅主题: phonebox/command");
      Serial.println("[MQTT] 订阅主题: " + deviceCommandTopic);
      Serial.println("[MQTT] 订阅主题: phonebox/unlock/B");
      Serial.println("[MQTT] 订阅主题: phonebox/notification");
      return true;
    } else {
      Serial.print("[MQTT] 连接失败，错误码: ");
      Serial.println(mqttClient.state());
      return false;
    }
  }
  return true;
}

// ============== 生成请求ID ==============
String generateRequestId() {
  static int requestCounter = 0;
  requestCounter++;
  return "req_" + String(millis() / 1000) + "_" + String(requestCounter);
}

// ============== 发送心跳包 ==============
void sendHeartbeat() {
  if (!mqttClient.connected()) return;
  
  String requestId = generateRequestId();
  String payload = "{";
  payload += "\"request_id\":\"" + requestId + "\",";
  payload += "\"timestamp\":" + String(millis() / 1000) + ",";
  payload += "\"device_id\":\"" + String(config.mqtt_client_id) + "\",";
  payload += "\"status\":\"online\",";
  payload += "\"fw_version\":\"1.0\",";
  payload += "\"platform\":\"ESP32-S3\",";
  payload += "\"wifi_signal\":" + String(WiFi.RSSI()) + ",";
  payload += "\"free_heap\":" + String(ESP.getFreeHeap()) + ",";
  payload += "\"uptime\":" + String(millis() / 1000);
  payload += "}";
  
  mqttClient.publish("phonebox/heartbeat", payload.c_str());
  Serial.println("[MQTT] 发送心跳包");
}

// ============== 发送操作日志 ==============
void sendLog(String logType, String cardId, String cardUser, String result, String message) {
  if (!mqttClient.connected()) return;
  
  String requestId = generateRequestId();
  String payload = "{";
  payload += "\"request_id\":\"" + requestId + "\",";
  payload += "\"timestamp\":" + String(millis() / 1000) + ",";
  payload += "\"device_id\":\"" + String(config.mqtt_client_id) + "\",";
  payload += "\"log_type\":\"" + logType + "\",";
  payload += "\"card_id\":\"" + cardId + "\",";
  payload += "\"card_user\":\"" + cardUser + "\",";
  payload += "\"result\":\"" + result + "\",";
  payload += "\"message\":\"" + message + "\"";
  payload += "}";
  
  mqttClient.publish("phonebox/log", payload.c_str());
  Serial.print("[MQTT] 发送日志: ");
  Serial.println(logType);
}

// ============== MQTT消息处理 ==============
void handleMQTTMessage(char* topic, byte* payload, unsigned int length) {
  Serial.print("[MQTT] 收到消息: ");
  Serial.print(topic);
  Serial.print(" ");
  
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);
  
  // 远程命令处理
  if (String(topic) == "phonebox/command") {
    int cmdIndex = message.indexOf("\"command\":\"");
    if (cmdIndex != -1) {
      int endIndex = message.indexOf("\"", cmdIndex + 11);
      String command = message.substring(cmdIndex + 11, endIndex);
      
      Serial.print("[MQTT] 远程命令: ");
      Serial.println(command);
      
      if (command == "open_door") {
        openDoorNonBlocking();
        transitionTo(STATE_DOOR_OPENING);
        sendLog("door_open", "remote", "Remote", "success", "远程开门成功");
      } else if (command == "open_phonebox") {
        digitalWrite(RELAY_PHONE, HIGH);
        phoneBoxOpenTime = millis();
        lcdShow("PhoneBox A Open", "15s countdown");
        beepSuccess();
        transitionTo(STATE_PHONEBOX_OPENING);
        sendLog("phonebox_open", "remote", "Remote", "success", "远程开手机箱A成功");
      } else if (command == "open_phonebox_b") {
        digitalWrite(RELAY_PHONE_B, HIGH);
        phoneBoxBOpenTime = millis();
        lcdShow("PhoneBox B Open", "15s countdown");
        beepSuccess();
        transitionTo(STATE_PHONEBOX_OPENING);
        sendLog("phonebox_open", "remote", "Remote", "success", "远程开手机箱B成功");
      } else if (command == "restart") {
        ESP.restart();
      }
    }
    return;
  }
  
  // 手机箱响应处理 - 支持查询和开锁两种响应
  if (String(topic) == "phonebox/unlock/B") {
    if (context.pendingOp == OP_PHONEBOX) {
      int resultIndex = message.indexOf("\"result\":");
      if (resultIndex != -1) {
        String result = message.substring(resultIndex + 9);
        if (result.startsWith("true")) {
          // 检查是否是查询响应还是开锁响应
          int reasonIndex = message.indexOf("\"reason\":\"");
          if (reasonIndex != -1) {
            int endIndex = message.indexOf("\"", reasonIndex + 10);
            String reason = message.substring(reasonIndex + 10, endIndex);
            
            if (reason == "query_ok") {
              // 查询成功，显示积分
              int scoreIndex = message.indexOf("\"current_score\":");
              if (scoreIndex != -1) {
                int scoreEndIndex = message.indexOf(",", scoreIndex);
                if (scoreEndIndex == -1) scoreEndIndex = message.indexOf("}", scoreIndex);
                int score = message.substring(scoreIndex + 16, scoreEndIndex).toInt();
                context.messageLine1 = "Points: " + String(score);
                context.messageLine2 = "Query Success";
                beepSuccess();
                sendLog("points_query", context.currentCardId, context.currentCardUser, "success", "手机箱查询积分成功");
              }
              transitionTo(STATE_SHOW_MESSAGE);
            } else if (reason == "score_ok") {
              // 开锁成功
              lcdShow("PhoneBox A Open", "15s countdown");
              beepSuccess();
              digitalWrite(RELAY_PHONE, HIGH);
              phoneBoxOpenTime = millis();
              transitionTo(STATE_PHONEBOX_OPENING);
              sendLog("phonebox_open", context.currentCardId, context.currentCardUser, "success", "刷卡开手机箱A成功");
            }
          }
        } else {
          String reason = "unknown";
          int reasonIndex = message.indexOf("\"reason\":\"");
          if (reasonIndex != -1) {
            int endIndex = message.indexOf("\"", reasonIndex + 10);
            if (endIndex != -1) {
              reason = message.substring(reasonIndex + 10, endIndex);
            }
          }
          context.messageLine1 = "PhoneBox Denied";
          context.messageLine2 = reason;
          beepError();
          transitionTo(STATE_SHOW_MESSAGE);
          sendLog("phonebox_open", context.currentCardId, context.currentCardUser, "failed", "开手机箱失败: " + reason);
        }
        context.pendingOp = OP_NONE;
      }
    }
    return;
  }
  
  // 积分结果处理
  if (String(topic) == "phonebox/points/result") {
    if (context.pendingOp != OP_NONE) {
      // 清除超时计时器
      mqttWaitStartTime = 0;
      
      int successIndex = message.indexOf("\"success\":");
      int statusIndex = message.indexOf("\"status\":");
      
      if (successIndex != -1) {
        bool success = (message.substring(successIndex + 10) == "true");
        
        if (success) {
          // 检查是否是审批状态
          bool isPending = false;
          if (statusIndex != -1) {
            int statusEndIndex = message.indexOf("\"", statusIndex + 9);
            String status = message.substring(statusIndex + 9, statusEndIndex);
            isPending = (status == "pending");
          }
          
          if (isPending) {
            // 审批申请已提交
            switch(context.pendingOp) {
              case OP_ADD:
                context.messageLine1 = "Applied +" + String(context.pointsAmount);
                context.messageLine2 = "Pending Approval";
                sendLog("points_add", context.currentCardId, context.currentCardUser, "pending", "加分申请已提交审批");
                break;
              case OP_SUB:
                context.messageLine1 = "Applied -" + String(context.pointsAmount);
                context.messageLine2 = "Pending Approval";
                sendLog("points_sub", context.currentCardId, context.currentCardUser, "pending", "扣分申请已提交审批");
                break;
            }
            beepSuccess();
            transitionTo(STATE_SHOW_MESSAGE);
          } else {
            // 直接操作成功（查询或其他）
            int newPointsIndex = message.indexOf("\"new_points\":");
            int points = 0;
            if (newPointsIndex != -1) {
              int endIndex = message.indexOf(",", newPointsIndex);
              if (endIndex == -1) endIndex = message.indexOf("}", newPointsIndex);
              points = message.substring(newPointsIndex + 12, endIndex).toInt();
            }
            
            switch(context.pendingOp) {
              case OP_QUERY:
                context.messageLine1 = "Points: " + String(points);
                context.messageLine2 = "Query Success";
                sendLog("points_query", context.currentCardId, context.currentCardUser, "success", "积分查询成功");
                break;
              case OP_ADD:
                context.messageLine1 = "Added: +" + String(context.pointsAmount);
                context.messageLine2 = "Points: " + String(points);
                sendLog("points_add", context.currentCardId, context.currentCardUser, "success", "积分增加成功");
                break;
              case OP_SUB:
                context.messageLine1 = "Sub: -" + String(context.pointsAmount);
                context.messageLine2 = "Points: " + String(points);
                sendLog("points_sub", context.currentCardId, context.currentCardUser, "success", "积分减少成功");
                break;
            }
            beepSuccess();
            transitionTo(STATE_SHOW_MESSAGE);
          }
        } else {
          // 解析错误消息
          int msgIndex = message.indexOf("\"message\":");
          if (msgIndex != -1) {
            int msgStart = message.indexOf("\"", msgIndex + 11) + 1;
            int msgEnd = message.indexOf("\"", msgStart);
            String errorMsg = message.substring(msgStart, msgEnd);
            
            context.messageLine1 = "Error";
            if (errorMsg.indexOf("卡号未录入") != -1) {
              context.messageLine2 = "Card not registered";
            } else if (errorMsg.indexOf("用户不存在") != -1) {
              context.messageLine2 = "User not found";
            } else {
              context.messageLine2 = "Operation Failed";
            }
          } else {
            context.messageLine1 = "Operation Failed";
            context.messageLine2 = "Please try again";
          }
          beepError();
          transitionTo(STATE_SHOW_MESSAGE);
          sendLog("points_op", context.currentCardId, context.currentCardUser, "failed", "积分操作失败");
        }
        
        context.pendingOp = OP_NONE;
      }
    }
    return;
  }
  
  // 审批通知处理
  if (String(topic) == "phonebox/notification") {
    int typeIndex = message.indexOf("\"type\":");
    if (typeIndex != -1) {
      int typeEndIndex = message.indexOf("\"", typeIndex + 7);
      String notificationType = message.substring(typeIndex + 7, typeEndIndex);
      
      if (notificationType == "approval_result") {
        // 解析审批结果
        int statusIndex = message.indexOf("\"status\":");
        int userNameIndex = message.indexOf("\"user_name\":");
        int scoreChangeIndex = message.indexOf("\"score_change\":");
        int newPointsIndex = message.indexOf("\"new_points\":");
        
        String userName = "";
        int scoreChange = 0;
        int newPoints = 0;
        String approvalStatus = "";
        
        if (userNameIndex != -1) {
          int nameStart = message.indexOf("\"", userNameIndex + 12) + 1;
          int nameEnd = message.indexOf("\"", nameStart);
          userName = message.substring(nameStart, nameEnd);
        }
        
        if (statusIndex != -1) {
          int statusStart = message.indexOf("\"", statusIndex + 9) + 1;
          int statusEnd = message.indexOf("\"", statusStart);
          approvalStatus = message.substring(statusStart, statusEnd);
        }
        
        if (scoreChangeIndex != -1) {
          int endIndex = message.indexOf(",", scoreChangeIndex);
          if (endIndex == -1) endIndex = message.indexOf("}", scoreChangeIndex);
          scoreChange = message.substring(scoreChangeIndex + 14, endIndex).toInt();
        }
        
        if (newPointsIndex != -1) {
          int endIndex = message.indexOf(",", newPointsIndex);
          if (endIndex == -1) endIndex = message.indexOf("}", newPointsIndex);
          newPoints = message.substring(newPointsIndex + 12, endIndex).toInt();
        }
        
        Serial.print("[MQTT] 审批通知: ");
        Serial.print(userName);
        Serial.print(" ");
        Serial.print(approvalStatus);
        Serial.print(" score_change=");
        Serial.println(scoreChange);
        
        // 显示审批结果（仅当设备处于空闲状态时）
        if (currentState == STATE_IDLE) {
          if (approvalStatus == "approved") {
            context.messageLine1 = userName + " Approved";
            context.messageLine2 = "Points: " + String(newPoints);
            beepSuccess();
          } else {
            context.messageLine1 = userName + " Rejected";
            context.messageLine2 = "Check with admin";
            beepError();
          }
          transitionTo(STATE_SHOW_MESSAGE);
          sendLog("approval_notify", "", userName, approvalStatus, "收到审批结果通知");
        }
      }
    }
    return;
  }
}

// ============== MQTT请求发送 ==============
void sendMQTTRequest(String topic, String request) {
  if (!mqttClient.connected()) {
    Serial.println("[MQTT] 未连接，无法发送请求");
    lcdShow("MQTT Not Connected", "Please retry");
    beepError();
    return;
  }
  
  mqttClient.publish(topic.c_str(), request.c_str());
  Serial.print("[MQTT] 发送请求到 ");
  Serial.print(topic);
  Serial.print(": ");
  Serial.println(request);
}

// ============== OTA初始化 ==============
void initOTA() {
  Serial.println("       初始化OTA...");
  
  ArduinoOTA.setHostname(config.mqtt_client_id);
  ArduinoOTA.setPassword(config.mqtt_password);
  
  ArduinoOTA.onStart([]() {
    Serial.println("[OTA] 开始升级...");
    lcdShow("OTA Update", "Starting...");
  });
  
  ArduinoOTA.onEnd([]() {
    Serial.println("[OTA] 升级完成");
    lcdShow("OTA Complete", "Rebooting...");
  });
  
  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("[OTA] 进度: %u%%\r", (progress / (total / 100)));
    lcdShow("OTA Progress", String((progress / (total / 100))) + "%");
  });
  
  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("[OTA] 错误[%u]: ", error);
    if (error == OTA_AUTH_ERROR) Serial.println("认证失败");
    else if (error == OTA_BEGIN_ERROR) Serial.println("开始失败");
    else if (error == OTA_CONNECT_ERROR) Serial.println("连接失败");
    else if (error == OTA_RECEIVE_ERROR) Serial.println("接收失败");
    else if (error == OTA_END_ERROR) Serial.println("结束失败");
    lcdShow("OTA Failed", "Error: " + String(error));
  });
  
  ArduinoOTA.begin();
  Serial.println("       OTA初始化完成");
}

// ============== 状态转换 ==============
void transitionTo(SystemState newState) {
  Serial.print("[STATE] ");
  Serial.print(currentState);
  Serial.print(" -> ");
  Serial.println(newState);
  
  currentState = newState;
  lastActivityTime = millis();
  
  // 进入MQTT等待状态时记录开始时间
  if (newState == STATE_WAITING_MQTT) {
    mqttWaitStartTime = millis();
  }
  
  switch(newState) {
    case STATE_IDLE:
      context.inputBuffer = "";
      context.targetNumber = "";
      context.pendingOp = OP_NONE;
      lcdShow("System Ready", "5:PW 6:Add 7:Del");
      break;
    case STATE_PASSWORD_INPUT:
      context.inputBuffer = "";
      lcdShow("Enter Password", "********");
      break;
    case STATE_MENU:
      lcdShow("1:Query 2:Add", "3:Sub 4:PhoneBox");
      break;
    case STATE_INPUT_NUMBER:
      context.targetNumber = "";
      lcdShow("Enter ID:", "");
      break;
    case STATE_INPUT_AMOUNT:
      context.inputBuffer = "";
      lcdShow("Enter Amount:", "");
      break;
    case STATE_WAITING_MQTT:
      lcdShow("Waiting Server", "Please wait...");
      break;
    case STATE_SHOW_RESULT:
      break;
    case STATE_CHANGE_PASSWORD:
      context.inputBuffer = "";
      lcdShow("Old Password:", "");
      break;
    case STATE_INPUT_NEW_PASSWORD:
      context.newPassword = "";
      lcdShow("New Password:", "");
      break;
    case STATE_CONFIRM_NEW_PASSWORD:
      context.confirmPassword = "";
      lcdShow("Confirm PW:", "");
      break;
    case STATE_REGISTER_CARD:
      lcdShow("Swipe to Add", "#:Exit");
      break;
    case STATE_DELETE_CARD:
      lcdShow("Swipe to Del", "#:Exit");
      break;
    case STATE_PHONEBOX_QUERY:
      lcdShow("PhoneBox Query", "Waiting...");
      break;
    case STATE_PHONEBOX_OPENING:
      lcdShow("Opening PhoneBox", "15s countdown");
      break;
    case STATE_DOOR_OPENING:
      lcdShow("Door Open", "3s countdown");
      break;
    case STATE_SHOW_MESSAGE:
      lcdShow(context.messageLine1, context.messageLine2);
      break;
  }
}

// ============== MQTT请求发送函数 ==============
void sendQueryRequest() {
  context.pendingOp = OP_QUERY;
  String requestId = generateRequestId();
  
  String payload = "{";
  payload += "\"request_id\":\"" + requestId + "\",";
  payload += "\"timestamp\":" + String(millis() / 1000) + ",";
  payload += "\"device_id\":\"" + String(config.mqtt_client_id) + "\",";
  payload += "\"card_id\":\"" + context.currentCardId + "\",";
  payload += "\"card_user\":\"" + context.currentCardUser + "\",";
  payload += "\"target_number\":\"" + context.targetNumber + "\",";
  payload += "\"operation\":\"query\"";
  payload += "}";
  
  sendMQTTRequest("phonebox/points/query", payload);
  transitionTo(STATE_WAITING_MQTT);
}

void sendAddRequest() {
  context.pendingOp = OP_ADD;
  String requestId = generateRequestId();
  
  String payload = "{";
  payload += "\"request_id\":\"" + requestId + "\",";
  payload += "\"timestamp\":" + String(millis() / 1000) + ",";
  payload += "\"device_id\":\"" + String(config.mqtt_client_id) + "\",";
  payload += "\"card_id\":\"" + context.currentCardId + "\",";
  payload += "\"card_user\":\"" + context.currentCardUser + "\",";
  payload += "\"target_number\":\"" + context.targetNumber + "\",";
  payload += "\"amount\":" + String(context.pointsAmount) + ",";
  payload += "\"operation\":\"add\"";
  payload += "}";
  
  sendMQTTRequest("phonebox/points/add", payload);
  transitionTo(STATE_WAITING_MQTT);
}

void sendSubRequest() {
  context.pendingOp = OP_SUB;
  String requestId = generateRequestId();
  
  String payload = "{";
  payload += "\"request_id\":\"" + requestId + "\",";
  payload += "\"timestamp\":" + String(millis() / 1000) + ",";
  payload += "\"device_id\":\"" + String(config.mqtt_client_id) + "\",";
  payload += "\"card_id\":\"" + context.currentCardId + "\",";
  payload += "\"card_user\":\"" + context.currentCardUser + "\",";
  payload += "\"target_number\":\"" + context.targetNumber + "\",";
  payload += "\"amount\":" + String(context.pointsAmount) + ",";
  payload += "\"operation\":\"subtract\"";
  payload += "}";
  
  sendMQTTRequest("phonebox/points/sub", payload);
  transitionTo(STATE_WAITING_MQTT);
}

// ============== 手机箱查询请求 - 仅查询状态，不扣积分 ==============
void sendPhoneBoxQuery() {
  context.pendingOp = OP_PHONEBOX;
  String requestId = generateRequestId();
  
  String payload = "{";
  payload += "\"request_id\":\"" + requestId + "\",";
  payload += "\"timestamp\":" + String(millis() / 1000) + ",";
  payload += "\"device_id\":\"" + String(config.mqtt_client_id) + "\",";
  payload += "\"card_id\":\"" + context.currentCardId + "\",";
  payload += "\"card_user\":\"" + context.currentCardUser + "\",";
  payload += "\"box_id\":\"B\",";
  payload += "\"type\":\"query\"";
  payload += "}";
  
  mqttClient.publish("phonebox/query", payload.c_str());
  Serial.print("[MQTT] 发送手机箱查询: ");
  Serial.println(payload);
  transitionTo(STATE_PHONEBOX_QUERY);
}

// ============== 手机箱开锁请求 - 执行开锁并扣积分 ==============
void sendPhoneBoxUnlock() {
  context.pendingOp = OP_PHONEBOX;
  String requestId = generateRequestId();
  
  // 获取当前时间
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("[TIME] 获取时间失败");
  }
  
  String payload = "{";
  payload += "\"request_id\":\"" + requestId + "\",";
  payload += "\"timestamp\":" + String(millis() / 1000) + ",";
  payload += "\"device_id\":\"" + String(config.mqtt_client_id) + "\",";
  payload += "\"card_id\":\"" + context.currentCardId + "\",";
  payload += "\"card_user\":\"" + context.currentCardUser + "\",";
  payload += "\"box_id\":\"B\",";
  payload += "\"hour\":" + String(timeinfo.tm_hour) + ",";
  payload += "\"minute\":" + String(timeinfo.tm_min) + ",";
  payload += "\"type\":\"unlock\"";
  payload += "}";
  
  mqttClient.publish("phonebox/unlock", payload.c_str());
  Serial.print("[MQTT] 发送手机箱开锁请求: ");
  Serial.println(payload);
  transitionTo(STATE_PHONEBOX_QUERY);
}

// ============== 按键处理 ==============
void handleKey(char key) {
  if (key == '\0') return;
  
  Serial.print("[KEY] 按键: ");
  Serial.println(key);
  
  switch(currentState) {
    case STATE_IDLE:
      if (key == '*') {
        transitionTo(STATE_PASSWORD_INPUT);
      } else if (key == '#') {
        resetConfig();
      } else if (key == '5') {
        transitionTo(STATE_CHANGE_PASSWORD);
      } else if (key == '6') {
        transitionTo(STATE_REGISTER_CARD);
      } else if (key == '7') {
        transitionTo(STATE_DELETE_CARD);
      }
      break;
      
    case STATE_PASSWORD_INPUT:
      if (key == '#') {
        if (checkPassword(context.inputBuffer)) {
          lcdShow("Password OK", "Opening Door...");
          openDoorNonBlocking();
          transitionTo(STATE_DOOR_OPENING);
          sendLog("door_open", "password", "Password User", "success", "密码开门成功");
        } else {
          context.messageLine1 = "Wrong Password";
          context.messageLine2 = "Try again";
          beepError();
          transitionTo(STATE_SHOW_MESSAGE);
          sendLog("password_attempt", "unknown", "Unknown", "failed", "密码验证失败");
        }
      } else if (key == '*') {
        if (context.inputBuffer.length() > 0) {
          context.inputBuffer = context.inputBuffer.substring(0, context.inputBuffer.length() - 1);
        }
        String display = "";
        for (int i = 0; i < 8; i++) {
          if (context.inputBuffer.length() > 0 && i == context.inputBuffer.length() - 1) {
            display += context.inputBuffer[i];
          } else {
            display += "*";
          }
        }
        lcdShow("Enter Password", display);
      } else {
        if (context.inputBuffer.length() < 8) {
          context.inputBuffer += key;
          String display = "";
          for (int i = 0; i < 8; i++) {
            if (i == context.inputBuffer.length() - 1) {
              display += key;
            } else {
              display += "*";
            }
          }
          lcdShow("Enter Password", display);
        }
      }
      break;
      
    case STATE_MENU:
      switch(key) {
        case '1':
          // 查询积分：使用已刷的卡号
          if (context.currentCardId.length() > 0) {
            context.targetNumber = context.currentCardId;
            sendQueryRequest();
          } else {
            context.messageLine1 = "No Card";
            context.messageLine2 = "Please swipe first";
            beepError();
            transitionTo(STATE_SHOW_MESSAGE);
          }
          break;
        case '2':
          // 增加积分：使用已刷的卡号，进入金额输入
          if (context.currentCardId.length() > 0) {
            context.targetNumber = context.currentCardId;
            context.pendingOp = OP_ADD;
            context.inputBuffer = "";
            transitionTo(STATE_INPUT_AMOUNT);
            lcdShow("Enter Amount:", "");
          } else {
            context.messageLine1 = "No Card";
            context.messageLine2 = "Please swipe first";
            beepError();
            transitionTo(STATE_SHOW_MESSAGE);
          }
          break;
        case '3':
          // 减少积分：使用已刷的卡号，进入金额输入
          if (context.currentCardId.length() > 0) {
            context.targetNumber = context.currentCardId;
            context.pendingOp = OP_SUB;
            context.inputBuffer = "";
            transitionTo(STATE_INPUT_AMOUNT);
            lcdShow("Enter Amount:", "");
          } else {
            context.messageLine1 = "No Card";
            context.messageLine2 = "Please swipe first";
            beepError();
            transitionTo(STATE_SHOW_MESSAGE);
          }
          break;
        case '4':
          // 手机箱操作：先查询状态，再决定是否开锁
          if (context.currentCardId.length() > 0) {
            sendPhoneBoxUnlock();  // 直接发送开锁请求
          } else {
            context.messageLine1 = "No Card";
            context.messageLine2 = "Please swipe first";
            beepError();
            transitionTo(STATE_SHOW_MESSAGE);
          }
          break;
        case '5':
          transitionTo(STATE_CHANGE_PASSWORD);
          break;
        case '6':
          transitionTo(STATE_REGISTER_CARD);
          break;
        case '#':
          transitionTo(STATE_IDLE);
          break;
      }
      break;
      
    case STATE_INPUT_NUMBER:
      // 备用：手动输入卡号模式（保留但不使用）
      if (key == '#') {
        if (context.targetNumber.length() > 0) {
          lcdShow("Card: " + context.targetNumber, "Confirm?");
          vTaskDelay(pdMS_TO_TICKS(1000));
          
          if (context.pendingOp == OP_QUERY) {
            sendQueryRequest();
          } else {
            context.inputBuffer = "";
            transitionTo(STATE_INPUT_AMOUNT);
            lcdShow("Enter Amount:", "");
          }
        }
      } else if (key == '*') {
        if (context.targetNumber.length() > 0) {
          context.targetNumber = context.targetNumber.substring(0, context.targetNumber.length() - 1);
        }
        lcdShow("Enter Card ID:", context.targetNumber);
      } else {
        if (context.targetNumber.length() < 10) {
          context.targetNumber += key;
          lcdShow("Enter Card ID:", context.targetNumber);
        }
      }
      break;
      
    case STATE_INPUT_AMOUNT:
      if (key == '#') {
        if (context.inputBuffer.length() > 0) {
          context.pointsAmount = context.inputBuffer.toInt();
          if (context.pendingOp == OP_ADD) {
            sendAddRequest();
          } else {
            sendSubRequest();
          }
        }
      } else if (key == '*') {
        if (context.inputBuffer.length() > 0) {
          context.inputBuffer = context.inputBuffer.substring(0, context.inputBuffer.length() - 1);
        }
        lcdShow("Enter Amount:", context.inputBuffer);
      } else {
        if (context.inputBuffer.length() < 5) {
          context.inputBuffer += key;
          lcdShow("Enter Amount:", context.inputBuffer);
        }
      }
      break;
      
    case STATE_CHANGE_PASSWORD:
      if (key == '#') {
        if (context.inputBuffer.length() >= 4) {
          context.targetNumber = context.inputBuffer;  // 保存旧密码
          transitionTo(STATE_INPUT_NEW_PASSWORD);
        }
      } else if (key == '*') {
        if (context.inputBuffer.length() > 0) {
          context.inputBuffer = context.inputBuffer.substring(0, context.inputBuffer.length() - 1);
        }
        lcdShow("Old Password:", repeatChar('*', context.inputBuffer.length()));
      } else {
        if (context.inputBuffer.length() < 8) {
          context.inputBuffer += key;
          lcdShow("Old Password:", repeatChar('*', context.inputBuffer.length()));
        }
      }
      break;
      
    case STATE_INPUT_NEW_PASSWORD:
      if (key == '#') {
        if (context.inputBuffer.length() >= 4) {
          context.newPassword = context.inputBuffer;
          transitionTo(STATE_CONFIRM_NEW_PASSWORD);
        }
      } else if (key == '*') {
        if (context.inputBuffer.length() > 0) {
          context.inputBuffer = context.inputBuffer.substring(0, context.inputBuffer.length() - 1);
        }
        lcdShow("New Password:", repeatChar('*', context.inputBuffer.length()));
      } else {
        if (context.inputBuffer.length() < 8) {
          context.inputBuffer += key;
          lcdShow("New Password:", repeatChar('*', context.inputBuffer.length()));
        }
      }
      break;
      
    case STATE_CONFIRM_NEW_PASSWORD:
      if (key == '#') {
        if (context.inputBuffer.length() >= 4) {
          if (context.inputBuffer == context.newPassword) {
            if (changePassword(context.targetNumber, context.newPassword)) {
              context.messageLine1 = "Password Changed";
              context.messageLine2 = "Successfully!";
              beepSuccess();
              transitionTo(STATE_SHOW_MESSAGE);
            } else {
              context.messageLine1 = "Old PW Wrong";
              context.messageLine2 = "Try again";
              beepError();
              context.inputBuffer = "";
              context.newPassword = "";
              context.targetNumber = "";
              transitionTo(STATE_SHOW_MESSAGE);
              break;
            }
          } else {
            lcdShow("Passwords Mismatch", "Try again");
            beepError();
            transitionTo(STATE_INPUT_NEW_PASSWORD);
          }
        }
      } else if (key == '*') {
        if (context.inputBuffer.length() > 0) {
          context.inputBuffer = context.inputBuffer.substring(0, context.inputBuffer.length() - 1);
        }
        lcdShow("Confirm PW:", repeatChar('*', context.inputBuffer.length()));
      } else {
        if (context.inputBuffer.length() < 8) {
          context.inputBuffer += key;
          lcdShow("Confirm PW:", repeatChar('*', context.inputBuffer.length()));
        }
      }
      break;
      
    case STATE_REGISTER_CARD:
      if (key == '#') {
        lcdShow("Exit Register", "Return to Idle");
        transitionTo(STATE_IDLE);
      }
      break;
      
    case STATE_DELETE_CARD:
      if (key == '#') {
        lcdShow("Exit Delete", "Return to Idle");
        transitionTo(STATE_IDLE);
      }
      break;
      
    case STATE_PHONEBOX_QUERY:
      if (key == '#') {
        context.pendingOp = OP_NONE;
        transitionTo(STATE_IDLE);
      }
      break;
      
    default:
      break;
  }
}

// ============== 卡片处理 ==============
void handleCard(String cardId) {
  Serial.print("[CARD] 检测到卡片: ");
  Serial.println(cardId);
  
  // 注册新卡片状态 - 直接注册，无需输入用户名
  if (currentState == STATE_REGISTER_CARD) {
    if (registerNewCard(cardId)) {
      context.messageLine1 = "Card Added";
      context.messageLine2 = "Success!";
      beepSuccess();
      sendLog("card_register", cardId, "New Card", "success", "新卡片注册成功");
    } else {
      context.messageLine1 = "Add Failed";
      context.messageLine2 = "Exists/Full";
      beepError();
      sendLog("card_register", cardId, "New Card", "failed", "卡片注册失败：已存在或已满");
    }
    transitionTo(STATE_SHOW_MESSAGE);
    return;
  }
  
  // 删除卡片状态
  if (currentState == STATE_DELETE_CARD) {
    if (deleteCard(cardId)) {
      context.messageLine1 = "Card Deleted";
      context.messageLine2 = "Success!";
      beepSuccess();
      sendLog("card_delete", cardId, "Deleted", "success", "卡片删除成功");
    } else {
      context.messageLine1 = "Delete Failed";
      context.messageLine2 = "Not Found";
      beepError();
      sendLog("card_delete", cardId, "Unknown", "failed", "卡片删除失败：未找到");
    }
    transitionTo(STATE_SHOW_MESSAGE);
    return;
  }
  
  // 菜单状态下刷卡：只记录卡号，用于积分操作
  if (currentState == STATE_MENU) {
    context.currentCardId = cardId;
    context.currentCardUser = getCardUser(cardId);
    context.targetNumber = cardId;
    
    lcdShow("Card: " + cardId, "Ready for Points");
    beepSuccess();
    sendLog("card_scan", cardId, context.currentCardUser, "success", "菜单状态下刷卡");
    return; // 保持在菜单状态
  }
  
  // 其他状态：正常刷卡开门
  if (isValidCard(cardId)) {
    context.currentCardId = cardId;
    context.currentCardUser = getCardUser(cardId);
    
    lcdShow("Welcome: " + context.currentCardUser, "Card: " + cardId);
    beepSuccess();
    openDoorNonBlocking();
    transitionTo(STATE_DOOR_OPENING);
    sendLog("door_open", cardId, context.currentCardUser, "success", "刷卡开门成功");
  } else {
    context.messageLine1 = "Invalid Card";
    context.messageLine2 = "Access Denied";
    beepError();
    transitionTo(STATE_SHOW_MESSAGE);
    sendLog("door_open", cardId, "Unknown", "failed", "刷卡开门失败：无效卡片");
  }
}

// ============== 配网功能 ==============
void handleRoot() {
  String html = "<!DOCTYPE HTML><html><head>";
  html += "<title>DoorLock Config</title>";
  html += "<style>body{font-family:Arial;margin:20px;}";
  html += "input{width:100%;padding:10px;margin:5px 0;}";
  html += "button{background:#4CAF50;color:white;padding:12px 20px;border:none;cursor:pointer;width:100%;}";
  html += "button:hover{opacity:0.8;}</style></head><body>";
  html += "<h1>门禁系统配置</h1>";
  html += "<form method='POST' action='/save'>";
  
  html += "<h3>WiFi 设置</h3>";
  html += "<input type='text' name='ssid' placeholder='WiFi SSID' value='";
  html += String(config.wifi_ssid) + "' required><br>";
  html += "<input type='password' name='password' placeholder='WiFi Password' value='";
  html += String(config.wifi_password) + "' required><br>";
  
  html += "<h3>MQTT 设置</h3>";
  html += "<input type='text' name='mqtt_server' placeholder='MQTT Server' value='";
  html += String(config.mqtt_server) + "' required><br>";
  html += "<input type='number' name='mqtt_port' placeholder='MQTT Port' value='";
  html += String(config.mqtt_port) + "' required><br>";
  html += "<input type='text' name='mqtt_client_id' placeholder='Client ID' value='";
  html += String(config.mqtt_client_id) + "' required><br>";
  html += "<input type='text' name='mqtt_username' placeholder='Username' value='";
  html += String(config.mqtt_username) + "' required><br>";
  html += "<input type='password' name='mqtt_password' placeholder='Password' value='";
  html += String(config.mqtt_password) + "' required><br>";
  
  html += "<button type='submit'>保存配置</button>";
  html += "</form></body></html>";
  
  webServer.send(200, "text/html", html);
}

void handleSave() {
  if (webServer.hasArg("ssid")) strcpy(config.wifi_ssid, webServer.arg("ssid").c_str());
  if (webServer.hasArg("password")) strcpy(config.wifi_password, webServer.arg("password").c_str());
  if (webServer.hasArg("mqtt_server")) strcpy(config.mqtt_server, webServer.arg("mqtt_server").c_str());
  if (webServer.hasArg("mqtt_port")) config.mqtt_port = webServer.arg("mqtt_port").toInt();
  if (webServer.hasArg("mqtt_client_id")) strcpy(config.mqtt_client_id, webServer.arg("mqtt_client_id").c_str());
  if (webServer.hasArg("mqtt_username")) strcpy(config.mqtt_username, webServer.arg("mqtt_username").c_str());
  if (webServer.hasArg("mqtt_password")) strcpy(config.mqtt_password, webServer.arg("mqtt_password").c_str());
  
  config.config_version = CONFIG_VERSION;
  config.debug_version = DEBUG_VERSION;
  saveConfig();
  
  String html = "<!DOCTYPE HTML><html><body>";
  html += "<h1>配置已保存!</h1>";
  html += "<p>设备将在5秒后重启...</p>";
  html += "</body></html>";
  
  webServer.send(200, "text/html", html);
  
  delay(5000);
  ESP.restart();
}

void handleNotFound() {
  webServer.sendHeader("Location", "http://" + String(AP_IP.toString()), true);
  webServer.send(302, "text/plain", "");
}

void startAPMode() {
  Serial.println("       启动AP模式...");
  
  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(AP_IP, AP_IP, IPAddress(255, 255, 255, 0));
  
  if (WiFi.softAP(AP_SSID, AP_PASSWORD)) {
    Serial.print("       SSID: ");
    Serial.println(AP_SSID);
    Serial.print("       IP: ");
    Serial.println(WiFi.softAPIP());
  }
  
  dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
  dnsServer.start(DNS_PORT, "*", AP_IP);
  
  webServer.on("/", handleRoot);
  webServer.on("/save", HTTP_POST, handleSave);
  webServer.onNotFound(handleNotFound);
  webServer.begin();
  
  Serial.println("       AP模式启动完成");
  lcdShow("AP Mode", AP_SSID);
}

void processAPMode() {
  dnsServer.processNextRequest();
  webServer.handleClient();
}

// ============== FreeRTOS任务函数 ==============

// 键盘扫描任务
void taskKeypad(void *pvParameters) {
  Serial.println("[TASK] 键盘扫描任务启动");
  
  while (true) {
    if (!isConfigMode) {
      char key = scanKeypad();
      if (key != '\0') {
        Serial.print("[TASK-KEYPAD] 检测到按键: ");
        Serial.println(key);
        
        if (queueKey != NULL) {
          xQueueSend(queueKey, &key, pdMS_TO_TICKS(100));
        }
      }
    }
    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

// RFID读取任务
void taskRFID(void *pvParameters) {
  Serial.println("[TASK] RFID读取任务启动");
  
  while (true) {
    if (!isConfigMode) {
      String cardId = readCardData();
      if (cardId.length() > 0) {
        Serial.print("[TASK-RFID] 检测到卡片: ");
        Serial.println(cardId);
        
        if (queueCard != NULL) {
          char cardBuf[17];
          strncpy(cardBuf, cardId.c_str(), sizeof(cardBuf) - 1);
          cardBuf[sizeof(cardBuf) - 1] = '\0';
          xQueueSend(queueCard, cardBuf, pdMS_TO_TICKS(100));
        }
      }
    }
    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

// 状态机处理任务
void taskStateMachine(void *pvParameters) {
  Serial.println("[TASK] 状态机处理任务启动");
  
  char key;
  char cardBuf[17];
  
  while (true) {
    if (!isConfigMode) {
      // 检查键盘队列
      if (xQueueReceive(queueKey, &key, pdMS_TO_TICKS(10)) == pdPASS) {
        handleKey(key);
      }
      
      // 检查卡片队列
      if (xQueueReceive(queueCard, cardBuf, pdMS_TO_TICKS(10)) == pdPASS) {
        handleCard(String(cardBuf));
      }
      
      // 检查MQTT等待超时
      if (currentState == STATE_WAITING_MQTT && mqttWaitStartTime > 0) {
        if (millis() - mqttWaitStartTime > MQTT_WAIT_TIMEOUT) {
          Serial.println("[STATE] MQTT响应超时");
          context.messageLine1 = "Server Timeout";
          context.messageLine2 = "Please retry";
          context.pendingOp = OP_NONE;
          mqttWaitStartTime = 0;
          beepError();
          transitionTo(STATE_SHOW_MESSAGE);
          sendLog("mqtt_timeout", context.currentCardId, context.currentCardUser, "error", "MQTT响应超时");
        }
      }
      
      // 自动返回空闲状态
      if (currentState != STATE_IDLE && millis() - lastActivityTime > 30000) {
        transitionTo(STATE_IDLE);
      }
      
      // 检查手机箱超时
      checkPhoneBoxTimeout();
      
      // 检查门锁超时
      checkDoorTimeout();
      
      // 检查消息显示超时
      if (currentState == STATE_SHOW_MESSAGE && millis() - lastActivityTime > 2000) {
        transitionTo(STATE_IDLE);
      }
    }
    
    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

// MQTT通信任务
void taskMQTT(void *pvParameters) {
  Serial.println("[TASK] MQTT通信任务启动");
  
  unsigned long lastHeartbeatTime = 0;
  const unsigned long HEARTBEAT_INTERVAL = 10000; // 10秒发送一次心跳包
  
  while (true) {
    if (!isConfigMode) {
      // 设置MQTT回调
      mqttClient.setCallback(handleMQTTMessage);
      
      // 尝试重连
      reconnectMQTT();
      
      // 处理MQTT消息
      mqttClient.loop();
      
      // 处理OTA
      ArduinoOTA.handle();
      
      // 发送心跳包（每10秒）
      if (mqttClient.connected() && millis() - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
        sendHeartbeat();
        lastHeartbeatTime = millis();
      }
    }
    
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

// LCD显示任务
void taskLCD(void *pvParameters) {
  Serial.println("[TASK] LCD显示任务启动");
  
  LcdMessage msg;
  
  while (true) {
    if (queueLCD != NULL && xQueueReceive(queueLCD, &msg, pdMS_TO_TICKS(100)) == pdPASS) {
      lcdDirectShow(msg.line1, msg.line2);
    }
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

// ============== 主函数 ==============
void setup() {
  Serial.begin(115200);
  delay(100);
  
  Serial.println("");
  Serial.println("===== 门禁系统启动 =====");
  
  // 初始化引脚
  Serial.println("[1/7] 初始化引脚...");
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(RELAY_PHONE, OUTPUT);
  pinMode(RELAY_PHONE_B, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(CONFIG_PIN, INPUT_PULLUP);
  
  lockDoor();
  closePhoneBox();
  closePhoneBoxB();
  
  // 初始化卡片注册表
  initCardRegistry();
  
  // 初始化 LCD
  Serial.println("[2/7] 初始化 LCD...");
  if (initLcdWithRetry()) {
    lcdInitialized = true;
    Serial.println("       LCD 初始化成功");
  } else {
    Serial.println("       LCD 初始化失败!");
  }
  
  Serial.println("[3/7] 初始化键盘...");
  initKeypad();
  
  Serial.println("[4/7] 初始化RFID...");
  initRFID();
  
  Serial.println("[5/7] 初始化EEPROM...");
  EEPROM.begin(EEPROM_SIZE);
  loadConfig();
  
  Serial.println("[6/7] 检查配置...");
  
  // 检查配网按键状态
  if (digitalRead(CONFIG_PIN) == LOW) {
    Serial.println("       检测到配网按键，进入配网模式");
    isConfigMode = true;
    startAPMode();
    Serial.println("[SETUP] 配网模式启动完成");
    return;
  }
  
  if (!isConfigured()) {
    Serial.println("       未配置，启动AP模式...");
    isConfigMode = true;
    startAPMode();
    Serial.println("[SETUP] 配网模式启动完成");
    return;
  }
  
  Serial.println("       已配置，进入正常模式");
  
  // 连接 WiFi
  Serial.println("       开始连接WiFi...");
  if (!connectWiFi()) {
    Serial.println("       WiFi连接失败，进入配网模式");
    isConfigMode = true;
    startAPMode();
    return;
  }
  
  // 初始化 MQTT
  initMQTT();
  
  // 初始化 OTA
  initOTA();
  
  Serial.println("[7/7] 创建FreeRTOS任务...");
  
  // 创建队列
  queueKey = xQueueCreate(QUEUE_SIZE_KEY, sizeof(char));
  queueCard = xQueueCreate(QUEUE_SIZE_CARD, sizeof(char) * 17);
  queueLCD = xQueueCreate(QUEUE_SIZE_LCD, sizeof(LcdMessage));
  
  if (queueKey == NULL || queueCard == NULL || queueLCD == NULL) {
    Serial.println("       创建队列失败!");
  }
  
  // 创建任务
  xTaskCreate(taskKeypad, "Keypad", 2048, NULL, TASK_PRIORITY_KEYPAD, &taskHandleKeypad);
  xTaskCreate(taskRFID, "RFID", 2048, NULL, TASK_PRIORITY_RFID, &taskHandleRFID);
  xTaskCreate(taskStateMachine, "StateMachine", 4096, NULL, TASK_PRIORITY_STATE, &taskHandleState);
  xTaskCreate(taskMQTT, "MQTT", 4096, NULL, TASK_PRIORITY_MQTT, &taskHandleMQTT);
  xTaskCreate(taskLCD, "LCD", 2048, NULL, TASK_PRIORITY_LCD, &taskHandleLCD);
  
  Serial.println("       FreeRTOS任务创建完成");
  
  // 切换到空闲状态
  transitionTo(STATE_IDLE);
  
  // 发送系统启动日志
  sendLog("system_start", "system", "System", "success", "门禁系统启动完成");
  
  beepSuccess();
  Serial.println("[SETUP] 完成，任务已启动");
}

void loop() {
  if (isConfigMode) {
    processAPMode();
    delay(100);
  } else {
    // 在FreeRTOS模式下，主循环只处理配网模式的情况
    // 其他任务由FreeRTOS调度
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}
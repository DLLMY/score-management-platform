import paho.mqtt.client as mqtt
import json
import time
import os
import sys
import hashlib
from notifier import set_volume, fullscreen_popup, speak_text, show_notification, score_window

# 设置标准输出编码为UTF-8
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

# ========== 配置区域 ==========
MQTT_BROKER = os.environ.get('MQTT_BROKER', 'nc5233fc.ala.cn-hangzhou.emqxsl.cn')
MQTT_PORT = int(os.environ.get('MQTT_PORT', 8883))
MQTT_TOPIC = os.environ.get('MQTT_TOPIC', 'phonebox/remote/notify')
MQTT_USERNAME = os.environ.get('MQTT_USERNAME', 'phoneboxtest')
MQTT_PASSWORD = os.environ.get('MQTT_PASSWORD', '123456')
MQTT_SSL = os.environ.get('MQTT_SSL', 'true').lower() == 'true'
CLIENT_ID = os.environ.get('CLIENT_ID', '')
CONNECTION_TIMEOUT = 10  # 连接超时时间（秒）
# ==============================

connected_flag = False

def on_connect(client, userdata, flags, rc):
    global connected_flag
    if rc == 0:
        connected_flag = True
        print("Connected to MQTT Broker")
        client.subscribe(MQTT_TOPIC)
        print(f"Subscribed to topic: {MQTT_TOPIC}")
        
        client.subscribe('phonebox/remote/notify/all')
        client.subscribe('remote/notify')
        print("Subscribed to broadcast topics")
        
        client.subscribe(f'phonebox/remote/notify/{userdata["client_id"]}')
        print(f"Subscribed to client-specific topic: phonebox/remote/notify/{userdata['client_id']}")
    else:
        print(f"Connection failed, return code: {rc}")
        print(f"Error description: {get_mqtt_error(rc)}")

def get_mqtt_error(rc):
    errors = {
        1: "Protocol version error",
        2: "Invalid client ID",
        3: "Server unavailable",
        4: "Invalid username or password",
        5: "Not authorized",
        6: "Server disconnected"
    }
    return errors.get(rc, f"Unknown error ({rc})")

def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode('utf-8')
        print(f"\nReceived message [{msg.topic}]:")
        print(f"  {payload}")
        
        data = json.loads(payload)
        
        text = data.get('text', '')
        if not text:
            print("Invalid message: missing text field")
            return
        
        if 'volume' in data:
            volume = float(data['volume'])
            if set_volume(volume):
                print(f"Volume set to: {int(volume * 100)}%")
        
        # 获取通知类型
        notification_type = data.get('type', 'normal')
        
        # 获取通知参数
        timeout_sec = data.get('timeout_sec', 8)
        is_urgent = data.get('urgent', False)
        
        # 使用智能通知分发
        if notification_type == 'score_change':
            # 积分变化通知 -> 积分窗口
            show_notification(text, timeout_sec, is_urgent, 'score_change')
            print(f"Score change notification processed")
        else:
            # 其他通知 -> 智能分发（根据上课时间选择显示方式）
            show_notification(text, timeout_sec, is_urgent, notification_type)
            print(f"Notification displayed, type={notification_type}, urgent={is_urgent}")
        
        # 独立语音播报（如果需要）
        if data.get('speak', False):
            speak_text(text)
            print(f"Speaking: {text}")
            
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {e}")
    except Exception as e:
        print(f"Error processing message: {e}")
        import traceback
        traceback.print_exc()

def on_disconnect(client, userdata, rc):
    global connected_flag
    connected_flag = False
    print(f"Disconnected, return code: {rc}")
    if rc != 0:
        print("Reconnecting...")

def main():
    print("Remote Notification Listener v1.0")
    print("==================================")
    print(f"Configuration:")
    print(f"  Broker: {MQTT_BROKER}:{MQTT_PORT}")
    print(f"  SSL: {'Enabled' if MQTT_SSL else 'Disabled'}")
    print(f"  Topic: {MQTT_TOPIC}")
    print("==================================")
    
    # Generate client ID
    if CLIENT_ID:
        client_id = CLIENT_ID
    else:
        # Get hostname and convert to ASCII to avoid encoding issues
        hostname = os.environ.get('COMPUTERNAME', 'unknown').lower()
        # Replace non-ASCII characters with hash
        try:
            hostname.encode('ascii')
        except UnicodeEncodeError:
            # If hostname contains non-ASCII chars, use hash
            hostname = 'host_' + hashlib.md5(hostname.encode('utf-8')).hexdigest()[:8]
        client_id = f"remote_notify_{hostname}_{int(time.time())}"
    
    print(f"\nClient ID: {client_id}")
    print(f"  Use this ID in the management platform to send notifications to this client")
    
    # Create MQTT client
    client = mqtt.Client(client_id=client_id)
    client.user_data_set({"client_id": client_id})
    
    if MQTT_USERNAME and MQTT_PASSWORD:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    
    if MQTT_SSL:
        client.tls_set()
        client.tls_insecure_set(True)
    
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect
    
    print("\nConnecting to MQTT Broker...")
    
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, CONNECTION_TIMEOUT)
        client.loop_start()
        
        # Wait for connection
        start_time = time.time()
        while not connected_flag and (time.time() - start_time) < CONNECTION_TIMEOUT:
            time.sleep(0.5)
        
        if not connected_flag:
            print("Connection timeout")
            client.loop_stop()
            return
        
        print("Connection established successfully!")
        print("Waiting for messages...")
        
        while True:
            time.sleep(1)
            
    except ConnectionRefusedError:
        print("Connection refused, check Broker address and port")
    except Exception as e:
        print(f"Connection error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
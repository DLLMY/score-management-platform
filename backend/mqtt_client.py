import paho.mqtt.client as mqtt
import json
import requests
from datetime import datetime

MQTT_SERVER = "localhost"
MQTT_PORT = 1883
MQTT_CLIENT_ID = "score_platform"
MQTT_USERNAME = ""
MQTT_PASSWORD = ""

TOPIC_QUERY = "phonebox/query"
TOPIC_UNLOCK_A = "phonebox/unlock/A"
TOPIC_UNLOCK_B = "phonebox/unlock/B"
TOPIC_STATUS = "phonebox/status"
TOPIC_LOG = "phonebox/log"

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")
    client.subscribe(TOPIC_QUERY)
    client.subscribe(TOPIC_STATUS)

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        print(f"Received message on {msg.topic}: {payload}")
        
        if msg.topic == TOPIC_QUERY:
            handle_query(payload)
        elif msg.topic == TOPIC_STATUS:
            handle_status(payload)
            
    except Exception as e:
        print(f"Error processing message: {e}")

def handle_query(payload):
    card_id = payload.get('card_id')
    box_id = payload.get('box_id', 'B')
    
    try:
        response = requests.post('http://localhost:5000/api/box/verify', json={
            'card_id': card_id,
            'box_id': box_id
        })
        result = response.json()
        
        log_message = {
            'box_id': box_id,
            'card_id': card_id,
            'result': result['result'],
            'reason': result['reason'],
            'timestamp': int(datetime.now().timestamp())
        }
        
        client.publish(TOPIC_LOG, json.dumps(log_message))
        
        if result['result'] == 'true' and box_id == 'B':
            client.publish(TOPIC_UNLOCK_B, json.dumps({
                'box_id': 'B',
                'card_id': card_id,
                'user_name': result.get('user_name', ''),
                'timestamp': int(datetime.now().timestamp())
            }))
            
    except Exception as e:
        print(f"Error handling query: {e}")

def handle_status(payload):
    print(f"Door status update: {payload}")

def on_publish(client, userdata, mid):
    print(f"Message published: {mid}")

client = mqtt.Client(MQTT_CLIENT_ID)
client.on_connect = on_connect
client.on_message = on_message
client.on_publish = on_publish

if MQTT_USERNAME:
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

try:
    client.connect(MQTT_SERVER, MQTT_PORT, 60)
    client.loop_forever()
except Exception as e:
    print(f"MQTT connection failed: {e}")
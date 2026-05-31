#!/usr/bin/env python3
"""
WebSocket实时通信服务
使用Flask-SocketIO实现设备状态、通知等实时推送
"""

import json
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask import request
from threading import Lock

socketio = SocketIO(cors_allowed_origins="*", async_mode='threading')

client_rooms = {}
client_lock = Lock()

NOTIFICATION_EVENT = 'notification'
DEVICE_STATUS_EVENT = 'device_status'
SCORE_UPDATE_EVENT = 'score_update'
ALERT_EVENT = 'alert'
SYSTEM_EVENT = 'system'

@socketio.on('connect', namespace='/ws')
def handle_connect():
    client_id = request.sid
    print(f'Client connected: {client_id}')
    emit('connected', {'sid': client_id, 'message': 'Connected to WebSocket server'})

@socketio.on('disconnect', namespace='/ws')
def handle_disconnect():
    client_id = request.sid
    with client_lock:
        if client_id in client_rooms:
            for room in client_rooms[client_id]:
                leave_room(room)
            del client_rooms[client_id]
    print(f'Client disconnected: {client_id}')

@socketio.on('subscribe', namespace='/ws')
def handle_subscribe(data):
    room = data.get('room')
    if room:
        join_room(room)
        with client_lock:
            if request.sid not in client_rooms:
                client_rooms[request.sid] = set()
            client_rooms[request.sid].add(room)
        emit('subscribed', {'room': room})
        print(f'Client {request.sid} subscribed to {room}')

@socketio.on('unsubscribe', namespace='/ws')
def handle_unsubscribe(data):
    room = data.get('room')
    if room:
        leave_room(room)
        with client_lock:
            if request.sid in client_rooms and room in client_rooms[request.sid]:
                client_rooms[request.sid].remove(room)
        emit('unsubscribed', {'room': room})

@socketio.on('ping', namespace='/ws')
def handle_ping():
    emit('pong', {'timestamp': json.dumps({'server_time': None})})

def send_notification(notification_type, message, data=None):
    socketio.emit(NOTIFICATION_EVENT, {
        'type': notification_type,
        'message': message,
        'data': data or {}
    }, namespace='/ws', room='notifications')

def send_device_status(device_id, status_data):
    socketio.emit(DEVICE_STATUS_EVENT, {
        'device_id': device_id,
        'status': status_data
    }, namespace='/ws', room='devices')

def send_score_update(user_id, score_data):
    socketio.emit(SCORE_UPDATE_EVENT, {
        'user_id': user_id,
        'score': score_data
    }, namespace='/ws', room=f'user_{user_id}')

def send_alert(alert_type, alert_data):
    socketio.emit(ALERT_EVENT, {
        'type': alert_type,
        'data': alert_data
    }, namespace='/ws', room='alerts')

def broadcast_system_message(event_type, message, data=None):
    socketio.emit(SYSTEM_EVENT, {
        'event': event_type,
        'message': message,
        'data': data or {}
    }, namespace='/ws', room='system')

def send_to_room(room, event, data):
    socketio.emit(event, data, namespace='/ws', room=room)

def send_to_user(user_id, event, data):
    socketio.emit(event, data, namespace='/ws', room=f'user_{user_id}')

# -*- coding: utf-8 -*-
"""D1-c object-level to_dict tests (no DB needed)."""
import pytest
from models.device_models import Device
from models.device_models import DeviceGroupMapping
from models.notify_models import NotifyTemplate
from models.user_models import AdminRole
from models.user_models import SecurityAudit



def test_Device_to_dict():
    obj = Device()
    out = obj.to_dict()
    expected = ['id', 'device_id', 'name', 'status', 'last_heartbeat', 'wifi_signal', 'uptime', 'box_a_status', 'box_b_status', 'system_state', 'class_info_id', 'admin_id', 'ip_address', 'fw_version', 'platform', 'device_type', 'auto_update', 'ota_status', 'last_ota_push_at', 'free_heap', 'battery_level', 'temperature', 'last_error', 'error_count', 'alert_enabled', 'heartbeat_timeout', 'last_seen_ts', 'created_at', 'updated_at', 'mac_address', 'subnet_mask', 'broadcast_ip', 'wake_on_lan_enabled', 'last_wake_time', 'wake_count', 'is_active', 'wol_port', 'wol_description']
    assert set(out.keys()) == set(expected)
    # secret columns never leaked
    assert all('secret' not in k and k != 'password' for k in out.keys())
    # fields filter
    sub = obj.to_dict(fields=['id'])
    assert set(sub.keys()) == {'id'}

def test_SecurityAudit_to_dict():
    obj = SecurityAudit()
    out = obj.to_dict()
    expected = ['id', 'event_type', 'severity', 'user_id', 'user_type', 'ip_address', 'user_agent', 'request_path', 'request_method', 'response_status', 'event_details', 'created_at']
    assert set(out.keys()) == set(expected)
    # secret columns never leaked
    assert all('secret' not in k and k != 'password' for k in out.keys())
    # fields filter
    sub = obj.to_dict(fields=['id'])
    assert set(sub.keys()) == {'id'}

def test_NotifyTemplate_to_dict():
    obj = NotifyTemplate()
    out = obj.to_dict()
    expected = ['id', 'name', 'template', 'text', 'description', 'volume', 'speak', 'popup', 'timeout_sec', 'urgent', 'bg_color', 'text_color', 'font_size', 'language', 'category', 'tags', 'usage_count', 'is_active', 'created_by', 'created_at', 'updated_at']
    assert set(out.keys()) == set(expected)
    # secret columns never leaked
    assert all('secret' not in k and k != 'password' for k in out.keys())
    # fields filter
    sub = obj.to_dict(fields=['id'])
    assert set(sub.keys()) == {'id'}

def test_DeviceGroupMapping_to_dict():
    obj = DeviceGroupMapping()
    out = obj.to_dict()
    expected = ['id', 'device_id', 'group_id', 'added_at']
    assert set(out.keys()) == set(expected)
    # secret columns never leaked
    assert all('secret' not in k and k != 'password' for k in out.keys())
    # fields filter
    sub = obj.to_dict(fields=['id'])
    assert set(sub.keys()) == {'id'}

def test_AdminRole_to_dict():
    obj = AdminRole()
    out = obj.to_dict()
    expected = ['id', 'admin_id', 'role_code', 'assigned_at']
    assert set(out.keys()) == set(expected)
    # secret columns never leaked
    assert all('secret' not in k and k != 'password' for k in out.keys())
    # fields filter
    sub = obj.to_dict(fields=['id'])
    assert set(sub.keys()) == {'id'}

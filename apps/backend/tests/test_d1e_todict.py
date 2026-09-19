# -*- coding: utf-8 -*-
"""D1-e object-level to_dict tests (no DB needed)."""
import pytest
from models.device_models import MQTTConfig
from models.score_models import CompositeScore
from models.system_models import AdminClass
from models.system_models import FrontendErrorLog
from models.system_models import SystemConfig



def test_AdminClass_to_dict():
    obj = AdminClass()
    out = obj.to_dict()
    expected = ['id', 'admin_id', 'class_info_id', 'is_primary', 'assigned_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    sub = obj.to_dict(fields=['id'])
    assert set(sub.keys()) == {'id'}

def test_FrontendErrorLog_to_dict():
    obj = FrontendErrorLog()
    out = obj.to_dict()
    expected = ['id', 'error_type', 'message', 'stack', 'file', 'line', 'column', 'page', 'url', 'method', 'status', 'user_agent', 'detail', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    sub = obj.to_dict(fields=['id'])
    assert set(sub.keys()) == {'id'}

def test_CompositeScore_to_dict():
    obj = CompositeScore()
    out = obj.to_dict()
    expected = ['id', 'student_id', 'composite_score', 'academic_score', 'behavior_score', 'attendance_score', 'social_score', 'weights', 'computed_at', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    sub = obj.to_dict(fields=['id'])
    assert set(sub.keys()) == {'id'}

def test_MQTTConfig_to_dict():
    obj = MQTTConfig()
    out = obj.to_dict()
    expected = ['id', 'broker', 'port', 'client_id', 'username', 'ssl', 'timeout', 'keepalive', 'updated_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    sub = obj.to_dict(fields=['id'])
    assert set(sub.keys()) == {'id'}

def test_SystemConfig_to_dict():
    obj = SystemConfig()
    out = obj.to_dict()
    expected = ['id', 'system_name', 'system_logo', 'default_score', 'min_score', 'max_score', 'enable_notifications', 'notification_sound', 'auto_save', 'theme', 'language', 'device_whitelist_enabled', 'updated_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    sub = obj.to_dict(fields=['id'])
    assert set(sub.keys()) == {'id'}

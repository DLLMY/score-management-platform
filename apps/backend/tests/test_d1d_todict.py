# -*- coding: utf-8 -*-
"""D1-d object-level to_dict tests (no DB needed)."""
import pytest
from models.device_models import DeviceFirmwareUpdate
from models.device_models import DeviceHeartbeat
from models.nlp_models import NLPCorrection
from models.system_models import FrontendPerfMetric
from models.user_models import PermissionLog



def test_NLPCorrection_to_dict():
    obj = NLPCorrection()
    out = obj.to_dict()
    expected = ['id', 'input_text', 'original_result', 'corrected_result', 'corrected_by', 'is_validated', 'validated_at', 'created_at', 'original_text', 'field_type', 'original_value', 'corrected_value', 'status', 'confidence_after', 'learn_count', 'last_learned_at', 'verified_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    sub = obj.to_dict(fields=['id'])
    assert set(sub.keys()) == {'id'}

def test_FrontendPerfMetric_to_dict():
    obj = FrontendPerfMetric()
    out = obj.to_dict()
    expected = ['id', 'metric_type', 'name', 'value', 'unit', 'page', 'user_agent', 'screen_width', 'screen_height', 'detail', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    sub = obj.to_dict(fields=['id'])
    assert set(sub.keys()) == {'id'}

def test_PermissionLog_to_dict():
    obj = PermissionLog()
    out = obj.to_dict()
    expected = ['id', 'operator_id', 'operator_type', 'action', 'target_type', 'target_id', 'description', 'ip_address', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    sub = obj.to_dict(fields=['id'])
    assert set(sub.keys()) == {'id'}

def test_DeviceHeartbeat_to_dict():
    obj = DeviceHeartbeat()
    out = obj.to_dict()
    expected = ['id', 'device_id', 'timestamp', 'status', 'wifi_signal', 'uptime', 'box_a_status', 'box_b_status', 'system_state', 'received_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    sub = obj.to_dict(fields=['id'])
    assert set(sub.keys()) == {'id'}

def test_DeviceFirmwareUpdate_to_dict():
    obj = DeviceFirmwareUpdate()
    out = obj.to_dict()
    expected = ['id', 'device_id', 'device_name', 'from_version', 'to_version', 'status', 'started_at', 'completed_at', 'error_message', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    sub = obj.to_dict(fields=['id'])
    assert set(sub.keys()) == {'id'}

# -*- coding: utf-8 -*-
"""D1-f object-level to_dict tests (no DB needed)."""
import pytest
from models.activity import Activity
from models.device_models import PhoneBoxPolicy
from models.nlp_models import NLPRuleUsage
from models.notification_config import NotificationConfig
from models.score_models import WarningConfig



def test_NotificationConfig_to_dict():
    obj = NotificationConfig()
    out = obj.to_dict()
    expected = ['id', 'wechat_appid', 'template_unlock_success', 'template_unlock_failure', 'template_score_change', 'sms_provider', 'sms_access_key_id', 'sms_sign_name', 'sms_template_code', 'enable_wechat_notification', 'enable_sms_notification', 'updated_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    sub = obj.to_dict(fields=['id'])
    assert set(sub.keys()) == {'id'}

def test_PhoneBoxPolicy_to_dict():
    obj = PhoneBoxPolicy()
    out = obj.to_dict()
    expected = ['id', 'class_info_id', 'allow_self_unlock', 'unlock_windows', 'override_until', 'updated_by', 'created_at', 'updated_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    sub = obj.to_dict(fields=['id'])
    assert set(sub.keys()) == {'id'}

def test_NLPRuleUsage_to_dict():
    obj = NLPRuleUsage()
    out = obj.to_dict()
    expected = ['id', 'rule_id', 'student_id', 'input_text', 'matched_keyword', 'score_change', 'is_manual_correction', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    sub = obj.to_dict(fields=['id'])
    assert set(sub.keys()) == {'id'}

def test_WarningConfig_to_dict():
    obj = WarningConfig()
    out = obj.to_dict()
    expected = ['id', 'risk_type', 'threshold_low', 'threshold_medium', 'threshold_high', 'is_active', 'notification_enabled', 'config_key', 'config_value', 'description', 'created_at', 'updated_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    sub = obj.to_dict(fields=['id'])
    assert set(sub.keys()) == {'id'}

def test_Activity_to_dict():
    obj = Activity()
    out = obj.to_dict()
    expected = ['id', 'class_id', 'title', 'description', 'activity_type', 'start_date', 'end_date', 'location', 'organizer', 'is_published', 'created_by', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    sub = obj.to_dict(fields=['id'])
    assert set(sub.keys()) == {'id'}

# -*- coding: utf-8 -*-
"""D1-i object-level to_dict tests."""
import pytest
from models.device_models import MQTTLog
from models.device_models import ProcessedMessage
from models.duty import DutyAssignment
from models.duty import DutyGroup
from models.homework import HomeworkAssignment



def test_MQTTLog_to_dict():
    obj = MQTTLog()
    out = obj.to_dict()
    expected = ['id', 'topic', 'message', 'direction', 'timestamp']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_ProcessedMessage_to_dict():
    obj = ProcessedMessage()
    out = obj.to_dict()
    expected = ['id', 'message_id', 'record_id', 'new_score', 'client_id', 'processed_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_DutyGroup_to_dict():
    obj = DutyGroup()
    out = obj.to_dict()
    expected = ['id', 'class_id', 'name', 'day_of_week', 'area', 'is_active', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_DutyAssignment_to_dict():
    obj = DutyAssignment()
    out = obj.to_dict()
    expected = ['id', 'group_id', 'student_id', 'date', 'task', 'is_completed', 'completed_at', 'checked_by', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_HomeworkAssignment_to_dict():
    obj = HomeworkAssignment()
    out = obj.to_dict()
    expected = ['id', 'class_id', 'subject_id', 'title', 'description', 'assigned_date', 'due_date', 'assigned_by', 'is_completed', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

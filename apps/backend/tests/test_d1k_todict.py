# -*- coding: utf-8 -*-
"""D1-k object-level to_dict tests."""
import pytest
from models.nlp_models import NLPModelTraining
from models.notify_models import NotifyAudit
from models.parent import ContactLog
from models.parent import ParentContact
from models.seating import SeatingChart



def test_NLPModelTraining_to_dict():
    obj = NLPModelTraining()
    out = obj.to_dict()
    expected = ['id', 'model_name', 'status', 'algorithm_type', 'training_data_size', 'accuracy', 'f1_score', 'precision', 'recall', 'results', 'trained_by', 'error_message', 'created_at', 'trained_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_NotifyAudit_to_dict():
    obj = NotifyAudit()
    out = obj.to_dict()
    expected = ['id', 'type', 'target_class_id', 'admin_id', 'payload', 'reason_code', 'reason_message', 'force_send', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_ParentContact_to_dict():
    obj = ParentContact()
    out = obj.to_dict()
    expected = ['id', 'student_id', 'father_name', 'father_phone', 'mother_name', 'mother_phone', 'address', 'email', 'created_at', 'updated_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_ContactLog_to_dict():
    obj = ContactLog()
    out = obj.to_dict()
    expected = ['id', 'parent_id', 'contact_type', 'content', 'contact_time', 'created_by', 'follow_up_needed', 'follow_up_time', 'is_resolved']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_SeatingChart_to_dict():
    obj = SeatingChart()
    out = obj.to_dict()
    expected = ['id', 'class_id', 'name', 'rows', 'columns', 'strategy', 'is_active', 'version', 'created_by', 'created_at', 'updated_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

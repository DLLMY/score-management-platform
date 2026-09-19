# -*- coding: utf-8 -*-
"""D1-g object-level to_dict tests."""
import pytest
from models.activity import ActivityRegistration
from models.alert_models import StudentCluster
from models.archive_models import AttendanceArchive
from models.archive_models import OperationLogArchive
from models.archive_models import ScoreArchive



def test_ActivityRegistration_to_dict():
    obj = ActivityRegistration()
    out = obj.to_dict()
    expected = ['id', 'activity_id', 'student_id', 'status', 'registered_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_StudentCluster_to_dict():
    obj = StudentCluster()
    out = obj.to_dict()
    expected = ['id', 'student_id', 'cluster_label', 'cluster_score', 'features', 'created_at', 'updated_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_ScoreArchive_to_dict():
    obj = ScoreArchive()
    out = obj.to_dict()
    expected = ['id', 'exam_id', 'student_id', 'subject_id', 'score', 'full_score', 'status', 'remark', 'entered_by', 'entered_at', 'updated_at', 'archived_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_AttendanceArchive_to_dict():
    obj = AttendanceArchive()
    out = obj.to_dict()
    expected = ['id', 'class_id', 'student_id', 'date', 'period', 'status', 'arrive_time', 'leave_time', 'recorded_by', 'notes', 'created_at', 'archived_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_OperationLogArchive_to_dict():
    obj = OperationLogArchive()
    out = obj.to_dict()
    expected = ['id', 'original_id', 'admin_id', 'action', 'details', 'archived_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

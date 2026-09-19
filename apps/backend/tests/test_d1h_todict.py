# -*- coding: utf-8 -*-
"""D1-h object-level to_dict tests."""
import pytest
from models.attendance import Attendance
from models.committee import ClassCommittee
from models.committee import CommitteeTerm
from models.culture import CultureItem
from models.culture import CultureRecord



def test_Attendance_to_dict():
    obj = Attendance()
    out = obj.to_dict()
    expected = ['id', 'class_id', 'student_id', 'date', 'period', 'status', 'arrive_time', 'leave_time', 'recorded_by', 'notes', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_ClassCommittee_to_dict():
    obj = ClassCommittee()
    out = obj.to_dict()
    expected = ['id', 'class_id', 'position', 'student_id', 'responsibilities', 'rating', 'term_start', 'term_end', 'is_active', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_CommitteeTerm_to_dict():
    obj = CommitteeTerm()
    out = obj.to_dict()
    expected = ['id', 'class_id', 'term_name', 'start_date', 'end_date', 'is_current', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_CultureRecord_to_dict():
    obj = CultureRecord()
    out = obj.to_dict()
    expected = ['id', 'class_id', 'category', 'title', 'content', 'image_url', 'display_order', 'is_active', 'created_by', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_CultureItem_to_dict():
    obj = CultureItem()
    out = obj.to_dict()
    expected = ['id', 'record_id', 'item_type', 'content', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

# -*- coding: utf-8 -*-
"""D1-l object-level to_dict tests."""
import pytest
from models.seating import SeatingSeat
from models.study_group import StudyGroup
from models.study_group import StudyGroupMember
from models.study_group import StudyGroupScore
from models.study_guide import StudyGuide



def test_SeatingSeat_to_dict():
    obj = SeatingSeat()
    out = obj.to_dict()
    expected = ['id', 'chart_id', 'row', 'col', 'student_id', 'is_aisle', 'is_student_seat', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_StudyGroup_to_dict():
    obj = StudyGroup()
    out = obj.to_dict()
    expected = ['id', 'class_id', 'name', 'leader_id', 'description', 'score', 'is_active', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_StudyGroupMember_to_dict():
    obj = StudyGroupMember()
    out = obj.to_dict()
    expected = ['id', 'group_id', 'student_id', 'joined_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_StudyGroupScore_to_dict():
    obj = StudyGroupScore()
    out = obj.to_dict()
    expected = ['id', 'group_id', 'score_change', 'reason', 'created_by', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_StudyGuide_to_dict():
    obj = StudyGuide()
    out = obj.to_dict()
    expected = ['id', 'class_id', 'title', 'guide_type', 'content', 'target_audience', 'is_published', 'created_by', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

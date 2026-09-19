# -*- coding: utf-8 -*-
"""D1-m object-level to_dict tests."""
import pytest
from models.study_guide import ImprovementPlan
from models.teacher_comment import TeacherComment
from models.user_models import LoginAttempt



def test_ImprovementPlan_to_dict():
    obj = ImprovementPlan()
    out = obj.to_dict()
    expected = ['id', 'student_id', 'plan_type', 'subject_id', 'target_score', 'current_score', 'plan_content', 'start_date', 'end_date', 'progress', 'is_completed', 'created_by', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_TeacherComment_to_dict():
    obj = TeacherComment()
    out = obj.to_dict()
    expected = ['id', 'student_id', 'term', 'comment_type', 'rating', 'content', 'created_by', 'created_at', 'updated_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_LoginAttempt_to_dict():
    obj = LoginAttempt()
    out = obj.to_dict()
    expected = ['id', 'username', 'ip_address', 'attempt_count', 'locked_until', 'last_attempt_at', 'success', 'user_agent', 'details', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

# -*- coding: utf-8 -*-
"""D1-j object-level to_dict tests."""
import pytest
from models.homework import HomeworkSubmission
from models.mental_health import MentalHealthRecord
from models.nlp_models import NLPBehaviorKeyword
from models.nlp_models import NLPMatchResult
from models.nlp_models import NLPScoringRule



def test_HomeworkSubmission_to_dict():
    obj = HomeworkSubmission()
    out = obj.to_dict()
    expected = ['id', 'assignment_id', 'student_id', 'is_submitted', 'submitted_at', 'is_late', 'notes', 'checked_by', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_MentalHealthRecord_to_dict():
    obj = MentalHealthRecord()
    out = obj.to_dict()
    expected = ['id', 'student_id', 'mood_level', 'stress_level', 'sleep_hours', 'notes', 'recorded_by', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_NLPScoringRule_to_dict():
    obj = NLPScoringRule()
    out = obj.to_dict()
    expected = ['id', 'behavior_keyword', 'behavior_description', 'score_value', 'score_type', '_behavior_tags', 'match_pattern', 'priority', 'usage_count', 'accuracy_rate', 'is_active', 'created_by', 'created_at', 'updated_at', 'last_used_at', 'rule_name', 'rule_type', 'condition', 'score_change']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_NLPBehaviorKeyword_to_dict():
    obj = NLPBehaviorKeyword()
    out = obj.to_dict()
    expected = ['id', 'keyword', 'keyword_type', 'score_weight', 'description', 'is_active', 'created_at', 'score_type', 'default_score', '_synonyms', 'behavior_type', 'category', 'weight']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

def test_NLPMatchResult_to_dict():
    obj = NLPMatchResult()
    out = obj.to_dict()
    expected = ['id', 'input_text', 'matched_rule_id', 'matched_keyword', 'intent', 'confidence', 'student_id', 'behavior_description', 'score_change', 'is_manual_correction', 'created_at']
    assert set(out.keys()) == set(expected)
    assert all('secret' not in k and k != 'password' for k in out.keys())
    assert set(obj.to_dict(fields=['id']).keys()) == {'id'}

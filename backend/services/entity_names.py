# -*- coding: utf-8 -*-
"""外键 ID → 可读名称的统一解析器。

背景
----
班主任工作台各模块的列表接口原先只吐 student_id / class_id / subject_id，
前端只能显示「学生 #61」「班级 #1」，页面等于不可用。
前端各页早已写好 `record.student_name || '学生 #' + student_id` 的兜底，
因此后端只要在序列化时补上 *_name 字段即可。

用法
----
    from services.entity_names import names

    names.student(61)      # -> '张三' 或 None
    names.klass(1)         # -> '一年级1班' 或 None
    names.subject(5)       # -> '化学' 或 None

缓存
----
以 flask.g 为作用域做请求级缓存，避免同一请求内对同一 id 反复查库
（列表接口逐行序列化时命中率很高）。无 app context 时退化为无缓存直查。
"""
from flask import g, has_app_context

from models import ClassInfo, Subject, User

_CACHE_KEY = "_entity_name_cache"


def _cache():
    if not has_app_context():
        return None
    store = getattr(g, _CACHE_KEY, None)
    if store is None:
        store = {"student": {}, "class": {}, "subject": {}}
        setattr(g, _CACHE_KEY, store)
    return store


def _lookup(kind, model, obj_id):
    if obj_id in (None, ""):
        return None
    try:
        obj_id = int(obj_id)
    except (TypeError, ValueError):
        return None

    store = _cache()
    if store is not None and obj_id in store[kind]:
        return store[kind][obj_id]

    obj = model.query.get(obj_id)
    name = getattr(obj, "name", None) if obj is not None else None
    if store is not None:
        store[kind][obj_id] = name
    return name


class _Names:
    def student(self, student_id):
        return _lookup("student", User, student_id)

    def klass(self, class_id):
        return _lookup("class", ClassInfo, class_id)

    def subject(self, subject_id):
        return _lookup("subject", Subject, subject_id)

    def prefetch_students(self, ids):
        """批量预热学生姓名缓存，消除列表序列化的 N+1 查询。"""
        store = _cache()
        if store is None:
            return
        want = set()
        for i in ids:
            try:
                i = int(i)
            except (TypeError, ValueError):
                continue
            if i not in store["student"]:
                want.add(i)
        if not want:
            return
        for u in User.query.filter(User.id.in_(want)).all():
            store["student"][u.id] = u.name
        for i in want:
            store["student"].setdefault(i, None)


names = _Names()

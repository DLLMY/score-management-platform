# 班主任工作台功能集成实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将"班主任工作台"10大功能模块完整集成到现有积分管理平台系统中，包括座次表、值日生表、班委名单、家长联系、作业检查、考勤管理、学习小组、心理健康、文体活动、班级文化、学法指导等。

**Architecture:** 遵循现有三层架构（API → Service → Model），后端使用 Flask-RESTX + SQLAlchemy，前端使用 React + TypeScript + Zustand。所有新模块按业务域组织，复用现有权限体系、响应格式、错误处理、缓存机制。

**Tech Stack:**
- 后端: Flask 2.3 + Flask-RESTX + SQLAlchemy + Redis + pytest + pytest-cov
- 前端: React 18 + TypeScript 4.9 + Zustand + TailwindCSS + Jest + Playwright
- 数据库: SQLite (WAL模式) + FTS5
- 部署: Docker + Docker Compose + GitHub Actions

---

## 需求映射与现有系统分析

### 现有模块 vs 新增需求对照

| 需求模块 | 现有系统 | 集成策略 |
|----------|----------|----------|
| 一、基础架构 | ✅ 已完整 | 复用现有 Flask + React 架构 |
| 二、登录权限 | ✅ 已完整 (JWT+RBAC) | 复用现有装饰器体系 |
| 三、工作台首页 | ✅ 已有 Dashboard | 扩展现有 Dashboard 组件 |
| 四、班级管理 | ⚠️ 部分存在 | 新增 7 个子模块，复用 ClassInfo 模型 |
| 五、特色工作 | ❌ 不存在 | 全部新建 |
| 六、数据统计 | ✅ 已完整 | 复用现有统计服务 |
| 七、系统设置 | ✅ 已完整 | 复用现有设置模块 |
| 八、移动端 | ⚠️ 部分支持 | 优化响应式布局 |
| 九、测试部署 | ✅ 已完整 | 复用现有 CI/CD |

### 新增功能模块清单（需新建）

| 序号 | 模块 | 后端模型 | 后端服务 | 前端页面 | 复杂度 |
|------|------|----------|----------|----------|--------|
| 1 | 座次表 | SeatingChart, SeatingSeat | seating_service | SeatingChart.tsx | ⭐⭐⭐ |
| 2 | 值日生表 | DutyGroup, DutyAssignment | duty_service | DutyRoster.tsx | ⭐⭐ |
| 3 | 班委名单 | ClassCommittee, CommitteeTerm | committee_service | CommitteeList.tsx | ⭐⭐ |
| 4 | 家长联系 | ParentContact, ContactLog | parent_service | ParentContact.tsx | ⭐⭐ |
| 5 | 作业检查 | HomeworkAssignment, HomeworkSubmission | homework_service | HomeworkCheck.tsx | ⭐⭐⭐ |
| 6 | 考勤管理 | Attendance, LeaveApplication | attendance_service | AttendanceManage.tsx | ⭐⭐⭐ |
| 7 | 学习小组 | StudyGroup, StudyGroupMember, StudyGroupScore | study_group_service | StudyGroups.tsx | ⭐⭐⭐ |
| 8 | 心理健康 | MentalHealthRecord, MentalHealthAlert | mental_health_service | MentalHealth.tsx | ⭐⭐ |
| 9 | 文体活动 | Activity, ActivityRegistration | activity_service | ActivityManage.tsx | ⭐⭐ |
| 10 | 班级文化 | CultureRecord, CultureItem | culture_service | CultureBoard.tsx | ⭐⭐ |
| 11 | 学法指导 | StudyGuide, ImprovementPlan | study_guide_service | StudyGuide.tsx | ⭐⭐ |

---

## Phase 1: 后端模型层实现

### Task 1: 创建座次表模型和服务

**Files:**
- Create: `backend/models/seating.py`
- Create: `backend/services/seating_service.py`
- Create: `backend/validators/seating_validator.py`
- Test: `backend/tests/test_seating_service.py`

- [ ] **Step 1: 编写失败的测试**

```python
# backend/tests/test_seating_service.py
import pytest
from models import db
from models.seating import SeatingChart, SeatingSeat
from services.seating_service import seating_service

class TestSeatingService:
    def test_create_seating_chart(self, app, db_session):
        chart = seating_service.create_chart({
            "class_id": 1,
            "name": "2026年春季排座",
            "rows": 8,
            "columns": 8,
        })
        assert chart["success"] is True
        assert chart["data"]["rows"] == 8

    def test_auto_arrange_by_height_vision(self, app, db_session):
        chart = seating_service.auto_arrange(
            chart_id=1,
            strategy="height_vision",
            class_id=1,
        )
        assert chart["success"] is True
        assert len(chart["data"]["seats"]) == 64

    def test_drag_adjust_seat(self, app, db_session):
        result = seating_service.update_seat(
            chart_id=1,
            seat_row=1,
            seat_col=1,
            student_id=10,
        )
        assert result["success"] is True

    def test_export_seating_chart(self, app, db_session):
        result = seating_service.export_chart(chart_id=1, format="excel")
        assert result["success"] is True
```

- [ ] **Step 2: 运行测试确认失败**

Run: `& "C:\Users\53527\AppData\Local\Programs\Python\Python311\python.exe" -m pytest backend/tests/test_seating_service.py -v`
Expected: FAIL - "ModuleNotFoundError: No module named 'models.seating'"

- [ ] **Step 3: 创建 SeatingChart 和 SeatingSeat 模型**

```python
# backend/models/seating.py
from datetime import datetime
from models import db

class SeatingChart(db.Model):
    __tablename__ = "seating_chart"
    
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    rows = db.Column(db.Integer, default=8)
    columns = db.Column(db.Integer, default=8)
    strategy = db.Column(db.String(50), default="manual")
    is_active = db.Column(db.Boolean, default=True)
    version = db.Column(db.Integer, default=1)
    created_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)
    
    seats = db.relationship("SeatingSeat", backref="chart", cascade="all, delete-orphan")

class SeatingSeat(db.Model):
    __tablename__ = "seating_seat"
    
    id = db.Column(db.Integer, primary_key=True)
    chart_id = db.Column(db.Integer, db.ForeignKey("seating_chart.id"), nullable=False, index=True)
    row = db.Column(db.Integer, nullable=False)
    col = db.Column(db.Integer, nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), index=True, nullable=True)
    is_aisle = db.Column(db.Boolean, default=False)
    is_student_seat = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
```

- [ ] **Step 4: 创建座次表服务**

```python
# backend/services/seating_service.py
from models import db
from models.seating import SeatingChart, SeatingSeat
from utils.response import APIResponse
from utils.permission import get_current_admin

class SeatingService:
    def create_chart(self, data):
        admin = get_current_admin()
        chart = SeatingChart(
            class_id=data["class_id"],
            name=data["name"],
            rows=data.get("rows", 8),
            columns=data.get("columns", 8),
            strategy=data.get("strategy", "manual"),
            created_by=admin.id if admin else None,
        )
        db.session.add(chart)
        db.session.flush()
        
        # 创建座位网格
        for r in range(chart.rows):
            for c in range(chart.columns):
                aisle = (c == chart.columns // 2 - 1 or c == chart.columns // 2)
                seat = SeatingSeat(
                    chart_id=chart.id,
                    row=r,
                    col=c,
                    is_aisle=aisle,
                )
                db.session.add(seat)
        db.session.commit()
        return {"success": True, "data": self._build_chart_response(chart)}, 201

    def auto_arrange(self, chart_id, strategy, class_id):
        chart = SeatingChart.query.get(chart_id)
        if not chart:
            return APIResponse.error("座次表不存在", 404)
        
        from models import User
        students = User.query.filter_by(class_id=class_id, is_active=True).all()
        
        if strategy == "height_vision":
            sorted_students = sorted(students, key=lambda s: (s.height or 150, -(s.vision_score or 5)))
        elif strategy == "score_tier":
            sorted_students = sorted(students, key=lambda s: -(s.current_score or 0))
        else:
            sorted_students = students
        
        seats = SeatingSeat.query.filter_by(chart_id=chart_id, is_student_seat=True).order_by(SeatingSeat.row, SeatingSeat.col).all()
        
        for i, seat in enumerate(seats):
            seat.student_id = sorted_students[i].id if i < len(sorted_students) else None
        db.session.commit()
        return {"success": True, "data": self._build_chart_response(chart)}

    def update_seat(self, chart_id, seat_row, seat_col, student_id):
        seat = SeatingSeat.query.filter_by(chart_id=chart_id, row=seat_row, col=seat_col).first()
        if not seat:
            return APIResponse.error("座位不存在", 404)
        seat.student_id = student_id
        db.session.commit()
        return {"success": True, "data": {"id": seat.id, "row": seat_row, "col": seat_col, "student_id": student_id}}

    def _build_chart_response(self, chart):
        seats = SeatingSeat.query.filter_by(chart_id=chart.id).order_by(SeatingSeat.row, SeatingSeat.col).all()
        return {
            "id": chart.id,
            "name": chart.name,
            "rows": chart.rows,
            "columns": chart.columns,
            "strategy": chart.strategy,
            "is_active": chart.is_active,
            "seats": [
                {"row": s.row, "col": s.col, "student_id": s.student_id, "is_aisle": s.is_aisle}
                for s in seats
            ],
        }

seating_service = SeatingService()
```

- [ ] **Step 5: 运行测试确认通过**

Run: `& "C:\Users\53527\AppData\Local\Programs\Python\Python311\python.exe" -m pytest backend/tests/test_seating_service.py -v`
Expected: PASS 4 tests

- [ ] **Step 6: 提交代码**

```bash
git add backend/models/seating.py backend/services/seating_service.py backend/validators/seating_validator.py backend/tests/test_seating_service.py
git commit -m "feat: add seating chart module with auto-arrange and drag-adjust"
```

---

### Task 2: 创建值日生表模型和服务

**Files:**
- Create: `backend/models/duty.py`
- Create: `backend/services/duty_service.py`
- Test: `backend/tests/test_duty_service.py`

- [ ] **Step 1: 编写测试**

```python
# backend/tests/test_duty_service.py
import pytest
from models.duty import DutyGroup, DutyAssignment
from services.duty_service import duty_service

class TestDutyService:
    def test_create_duty_group(self, app, db_session):
        result = duty_service.create_group({
            "class_id": 1, "name": "第一值日组", "day_of_week": "monday", "area": "教室"
        })
        assert result["success"] is True

    def test_assign_duty(self, app, db_session):
        result = duty_service.create_assignment({
            "group_id": 1, "student_id": 1, "date": "2026-08-01", "task": "擦黑板"
        })
        assert result["success"] is True

    def test_mark_duty_complete(self, app, db_session):
        result = duty_service.mark_complete(assignment_id=1)
        assert result["success"] is True

    def test_auto_rotate(self, app, db_session):
        result = duty_service.rotate_assignments(class_id=1, period="weekly")
        assert result["success"] is True
```

- [ ] **Step 2: 运行测试确认失败**
- [ ] **Step 3: 创建 DutyGroup 和 DutyAssignment 模型**

```python
# backend/models/duty.py
from datetime import datetime, date
from models import db

class DutyGroup(db.Model):
    __tablename__ = "duty_group"
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
    name = db.Column(db.String(50), nullable=False)
    day_of_week = db.Column(db.String(20))
    area = db.Column(db.String(100))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)

class DutyAssignment(db.Model):
    __tablename__ = "duty_assignment"
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("duty_group.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, index=True)
    task = db.Column(db.String(200))
    is_completed = db.Column(db.Boolean, default=False)
    completed_at = db.Column(db.DateTime, nullable=True)
    checked_by = db.Column(db.Integer, db.ForeignKey("admin.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
```

- [ ] **Step 4: 创建值日服务**
- [ ] **Step 5: 运行测试确认通过**
- [ ] **Step 6: 提交代码**

```bash
git commit -m "feat: add duty roster module with auto-rotation"
```

---

### Task 3: 创建班委名单模型和服务

**Files:**
- Create: `backend/models/committee.py`
- Create: `backend/services/committee_service.py`
- Test: `backend/tests/test_committee_service.py`

- [ ] **Step 1-6: 按 TDD 流程实现**

```python
# backend/models/committee.py
class ClassCommittee(db.Model):
    __tablename__ = "class_committee"
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
    position = db.Column(db.String(50), nullable=False)  # 班长/学习委员/体育委员等
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    responsibilities = db.Column(db.Text)
    rating = db.Column(db.Integer, default=0)  # 评价等级 1-5
    term_start = db.Column(db.Date)
    term_end = db.Column(db.Date)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)

class CommitteeTerm(db.Model):
    __tablename__ = "committee_term"
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False)
    term_name = db.Column(db.String(50))  # 2026秋季
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    is_current = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
```

---

### Task 4: 创建家长联系模型和服务

**Files:**
- Create: `backend/models/parent.py`
- Create: `backend/services/parent_service.py`
- Test: `backend/tests/test_parent_service.py`

- [ ] **Step 1-6: 按 TDD 流程实现**

```python
# backend/models/parent.py
class ParentContact(db.Model):
    __tablename__ = "parent_contact"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    father_name = db.Column(db.String(50))
    father_phone = db.Column(db.String(20))
    mother_name = db.Column(db.String(50))
    mother_phone = db.Column(db.String(20))
    address = db.Column(db.String(200))
    email = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.now)

class ContactLog(db.Model):
    __tablename__ = "contact_log"
    id = db.Column(db.Integer, primary_key=True)
    parent_id = db.Column(db.Integer, db.ForeignKey("parent_contact.id"), nullable=False, index=True)
    contact_type = db.Column(db.String(20))  # phone/wechat/email
    content = db.Column(db.Text)
    contact_time = db.Column(db.DateTime, default=datetime.now)
    created_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    follow_up_needed = db.Column(db.Boolean, default=False)
    follow_up_time = db.Column(db.DateTime, nullable=True)
    is_resolved = db.Column(db.Boolean, default=False)
```

---

### Task 5: 创建作业检查模型和服务

**Files:**
- Create: `backend/models/homework.py`
- Create: `backend/services/homework_service.py`
- Test: `backend/tests/test_homework_service.py`

- [ ] **Step 1-6: 按 TDD 流程实现**

```python
# backend/models/homework.py
class HomeworkAssignment(db.Model):
    __tablename__ = "homework_assignment"
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
    subject_id = db.Column(db.Integer, db.ForeignKey("subject.id"), index=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    assigned_date = db.Column(db.Date, nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    assigned_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    is_completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.now)

class HomeworkSubmission(db.Model):
    __tablename__ = "homework_submission"
    id = db.Column(db.Integer, primary_key=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey("homework_assignment.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    is_submitted = db.Column(db.Boolean, default=False)
    submitted_at = db.Column(db.DateTime, nullable=True)
    is_late = db.Column(db.Boolean, default=False)
    notes = db.Column(db.String(500))
    checked_by = db.Column(db.Integer, db.ForeignKey("admin.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
```

---

### Task 6: 创建考勤管理模型和服务

**Files:**
- Create: `backend/models/attendance.py`
- Create: `backend/services/attendance_service.py`
- Test: `backend/tests/test_attendance_service.py`

- [ ] **Step 1-6: 按 TDD 流程实现**

```python
# backend/models/attendance.py
class Attendance(db.Model):
    __tablename__ = "attendance"
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, index=True)
    period = db.Column(db.String(20))  # morning/afternoon/evening
    status = db.Column(db.String(20), default="present")  # present/absent/late/leave
    arrive_time = db.Column(db.DateTime, nullable=True)
    leave_time = db.Column(db.DateTime, nullable=True)
    recorded_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    notes = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.now)

class LeaveApplication(db.Model):
    __tablename__ = "leave_application"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    leave_type = db.Column(db.String(20))  # sick/personal/other
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    reason = db.Column(db.Text)
    status = db.Column(db.String(20), default="pending")  # pending/approved/rejected
    approved_by = db.Column(db.Integer, db.ForeignKey("admin.id"), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
```

---

### Task 7: 创建学习小组模型和服务

**Files:**
- Create: `backend/models/study_group.py`
- Create: `backend/services/study_group_service.py`
- Test: `backend/tests/test_study_group_service.py`

- [ ] **Step 1-6: 按 TDD 流程实现**

```python
# backend/models/study_group.py
class StudyGroup(db.Model):
    __tablename__ = "study_group"
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
    name = db.Column(db.String(50), nullable=False)
    leader_id = db.Column(db.Integer, db.ForeignKey("user.id"), index=True)
    description = db.Column(db.String(200))
    score = db.Column(db.Float, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)

class StudyGroupMember(db.Model):
    __tablename__ = "study_group_member"
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("study_group.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    joined_at = db.Column(db.DateTime, default=datetime.now)

class StudyGroupScore(db.Model):
    __tablename__ = "study_group_score"
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("study_group.id"), nullable=False, index=True)
    score_change = db.Column(db.Float, nullable=False)
    reason = db.Column(db.String(200))
    created_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    created_at = db.Column(db.DateTime, default=datetime.now)
```

---

### Task 8: 创建心理健康、文体活动、班级文化、学法指导模型和服务

**Files:**
- Create: `backend/models/mental_health.py`, `backend/models/activity.py`, `backend/models/culture.py`, `backend/models/study_guide.py`
- Create: `backend/services/mental_health_service.py`, `backend/services/activity_service.py`, `backend/services/culture_service.py`, `backend/services/study_guide_service.py`
- Test: `backend/tests/test_mental_health_service.py`, `backend/tests/test_activity_service.py`, `backend/tests/test_culture_service.py`, `backend/tests/test_study_guide_service.py`

- [ ] **Step 1-6: 按 TDD 流程批量实现**

```python
# backend/models/mental_health.py
class MentalHealthRecord(db.Model):
    __tablename__ = "mental_health_record"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    mood_level = db.Column(db.Integer)  # 1-5
    stress_level = db.Column(db.Integer)  # 1-5
    sleep_hours = db.Column(db.Float)
    notes = db.Column(db.Text)
    recorded_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    created_at = db.Column(db.DateTime, default=datetime.now)

class MentalHealthAlert(db.Model):
    __tablename__ = "mental_health_alert"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    alert_type = db.Column(db.String(50))  # low_mood/high_stress/other
    severity = db.Column(db.Integer)  # 1-3
    message = db.Column(db.Text)
    is_resolved = db.Column(db.Boolean, default=False)
    resolved_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now)

# backend/models/activity.py
class Activity(db.Model):
    __tablename__ = "activity"
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    activity_type = db.Column(db.String(50))  # sports/performance/meeting/other
    start_date = db.Column(db.DateTime)
    end_date = db.Column(db.DateTime)
    location = db.Column(db.String(200))
    organizer = db.Column(db.String(50))
    is_published = db.Column(db.Boolean, default=False)
    created_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    created_at = db.Column(db.DateTime, default=datetime.now)

class ActivityRegistration(db.Model):
    __tablename__ = "activity_registration"
    id = db.Column(db.Integer, primary_key=True)
    activity_id = db.Column(db.Integer, db.ForeignKey("activity.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    status = db.Column(db.String(20), default="registered")  # registered/attended/cancelled
    registered_at = db.Column(db.DateTime, default=datetime.now)

# backend/models/culture.py
class CultureRecord(db.Model):
    __tablename__ = "culture_record"
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
    category = db.Column(db.String(50))  # slogan/rule/badge/honor/photo
    title = db.Column(db.String(200))
    content = db.Column(db.Text)
    image_url = db.Column(db.String(500))
    display_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    created_at = db.Column(db.DateTime, default=datetime.now)

class CultureItem(db.Model):
    __tablename__ = "culture_item"
    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.Integer, db.ForeignKey("culture_record.id"), nullable=False, index=True)
    item_type = db.Column(db.String(50))
    content = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now)

# backend/models/study_guide.py
class StudyGuide(db.Model):
    __tablename__ = "study_guide"
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey("class_info.id"), nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    guide_type = db.Column(db.String(50))  # method/skill/experience/case
    content = db.Column(db.Text)
    target_audience = db.Column(db.String(50))  # top/middle/bottom/all
    is_published = db.Column(db.Boolean, default=False)
    created_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    created_at = db.Column(db.DateTime, default=datetime.now)

class ImprovementPlan(db.Model):
    __tablename__ = "improvement_plan"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    plan_type = db.Column(db.String(50))  # tutorial/remedial/advanced
    subject_id = db.Column(db.Integer, db.ForeignKey("subject.id"), index=True)
    target_score = db.Column(db.Float)
    current_score = db.Column(db.Float)
    plan_content = db.Column(db.Text)
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    progress = db.Column(db.Integer, default=0)  # 0-100
    is_completed = db.Column(db.Boolean, default=False)
    created_by = db.Column(db.Integer, db.ForeignKey("admin.id"))
    created_at = db.Column(db.DateTime, default=datetime.now)
```

- [ ] 提交代码

---

## Phase 2: 后端 API 路由层实现

### Task 9: 创建座次表 API 路由

**Files:**
- Create: `backend/api/class_management/seating_routes.py`
- Modify: `backend/app/route_init.py` (注册新 namespace)

- [ ] **Step 1: 创建座次表路由**

```python
# backend/api/class_management/seating_routes.py
from flask_restx import Namespace, Resource, fields
from flask import request
from utils.response import APIResponse
from utils.permission import requires_permission
from services.seating_service import seating_service

ns_seating = Namespace("seating", description="座次表管理")

seating_chart_model = ns_seating.model("SeatingChart", {
    "id": fields.Integer(readOnly=True),
    "class_id": fields.Integer(required=True),
    "name": fields.String(required=True),
    "rows": fields.Integer(default=8),
    "columns": fields.Integer(default=8),
    "strategy": fields.String(default="manual"),
})

seat_update_model = ns_seating.model("SeatUpdate", {
    "row": fields.Integer(required=True),
    "col": fields.Integer(required=True),
    "student_id": fields.Integer(required=True),
})

@ns_seating.route("/charts")
class SeatingChartList(Resource):
    @ns_seating.doc("list_seating_charts", params={
        "class_id": {"description": "班级ID"},
        "keyword": {"description": "搜索关键词"},
    })
    @requires_permission("class.view")
    def get(self):
        """获取座次表列表"""
        class_id = request.args.get("class_id", type=int)
        keyword = request.args.get("keyword", "")
        return seating_service.list_charts(class_id=class_id, keyword=keyword)

    @ns_seating.expect(seating_chart_model)
    @requires_permission("class.edit")
    def post(self):
        """创建座次表"""
        data = request.get_json()
        return seating_service.create_chart(data)

@ns_seating.route("/charts/<int:chart_id>")
class SeatingChartDetail(Resource):
    @requires_permission("class.view")
    def get(self, chart_id):
        """获取座次表详情"""
        return seating_service.get_chart(chart_id)

    @requires_permission("class.edit")
    def put(self, chart_id):
        """更新座次表"""
        data = request.get_json()
        return seating_service.update_chart(chart_id, data)

    @requires_permission("class.edit")
    def delete(self, chart_id):
        """删除座次表"""
        return seating_service.delete_chart(chart_id)

@ns_seating.route("/charts/<int:chart_id>/auto-arrange")
class AutoArrangeSeating(Resource):
    @ns_seating.expect(ns_seating.model("AutoArrange", {
        "strategy": fields.String(required=True),
        "class_id": fields.Integer(required=True),
    }))
    @requires_permission("class.edit")
    def post(self, chart_id):
        """自动排列座次"""
        data = request.get_json()
        return seating_service.auto_arrange(chart_id, data["strategy"], data["class_id"])

@ns_seating.route("/charts/<int:chart_id>/seats")
class UpdateSeat(Resource):
    @ns_seating.expect(seat_update_model)
    @requires_permission("class.edit")
    def put(self, chart_id):
        """更新单个座位"""
        data = request.get_json()
        return seating_service.update_seat(chart_id, data["row"], data["col"], data["student_id"])

@ns_seating.route("/charts/<int:chart_id>/export")
class ExportSeating(Resource):
    @requires_permission("class.view")
    def get(self, chart_id):
        """导出座次表"""
        format_type = request.args.get("format", "excel")
        return seating_service.export_chart(chart_id, format_type)
```

- [ ] **Step 2: 注册路由到 route_init.py**

在 `backend/app/route_init.py` 的对应位置添加：
```python
from api.class_management.seating_routes import ns_seating
api.add_namespace(ns_seating, path="/api/seating")
```

- [ ] **Step 3: 提交代码**

---

### Task 10-14: 创建其余 10 个模块的 API 路由

每个模块按 Task 9 的模式创建：
- `backend/api/class_management/duty_routes.py`
- `backend/api/class_management/committee_routes.py`
- `backend/api/class_management/parent_routes.py`
- `backend/api/class_management/homework_routes.py`
- `backend/api/class_management/attendance_routes.py`
- `backend/api/class_management/study_group_routes.py`
- `backend/api/class_management/mental_health_routes.py`
- `backend/api/class_management/activity_routes.py`
- `backend/api/class_management/culture_routes.py`
- `backend/api/class_management/study_guide_routes.py`

- [ ] **Step 1: 创建 class_management 目录的 __init__.py**
- [ ] **Step 2-11: 按 TDD 流程创建每个路由文件**
- [ ] **Step 12: 在 route_init.py 中注册所有新 namespace**
- [ ] **Step 13: 运行 API 集成测试**

---

## Phase 3: 前端页面与组件实现

### Task 15: 创建类型定义和 API 客户端方法

**Files:**
- Modify: `frontend/src/types/index.ts` (添加新类型)
- Modify: `frontend/src/services/api.ts` (添加新 API 方法)

- [ ] **Step 1: 添加类型定义**

在 `frontend/src/types/index.ts` 末尾添加：

```typescript
// ============================================
// 座次表类型
// ============================================
export interface SeatingChart {
  id: number;
  class_id: number;
  name: string;
  rows: number;
  columns: number;
  strategy: string;
  is_active: boolean;
  seats: SeatingSeat[];
}

export interface SeatingSeat {
  row: number;
  col: number;
  student_id: number | null;
  is_aisle: boolean;
}

export interface SeatingChartCreateInput {
  class_id: number;
  name: string;
  rows?: number;
  columns?: number;
  strategy?: string;
}

// ============================================
// 值日生表类型
// ============================================
export interface DutyGroup {
  id: number;
  class_id: number;
  name: string;
  day_of_week: string;
  area: string;
  is_active: boolean;
}

export interface DutyAssignment {
  id: number;
  group_id: number;
  student_id: number;
  date: string;
  task: string;
  is_completed: boolean;
}

// ... (similar for all 11 modules)
```

- [ ] **Step 2: 添加 API 客户端方法**

在 `frontend/src/services/api.ts` 中添加新的资源分组：

```typescript
const seating = {
  getAll: async (classId?: number) => { ... },
  getById: async (id: number) => { ... },
  create: async (data: SeatingChartCreateInput) => { ... },
  update: async (id: number, data: any) => { ... },
  delete: async (id: number) => { ... },
  autoArrange: async (chartId: number, strategy: string, classId: number) => { ... },
  updateSeat: async (chartId: number, row: number, col: number, studentId: number) => { ... },
  export: async (chartId: number, format: string) => { ... },
};

// ... (similar for all 11 modules)

const api = {
  // ... existing resources
  seating,
  duty,
  committee,
  parent,
  homework,
  attendance,
  studyGroup,
  mentalHealth,
  activity,
  culture,
  studyGuide,
};
```

- [ ] **Step 3: 提交代码**

---

### Task 16-26: 创建 11 个前端页面

每个页面遵循现有 `ClassManagement.tsx` 的模式。以座次表为例：

**Files:**
- Create: `frontend/src/pages/SeatingChart.tsx`

- [ ] **Step 1: 创建 SeatingChart 页面**

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useStableToast } from '../hooks/useStableToast';
import { useModal } from '../hooks/useModal';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { api } from '../services/api';
import { SeatingChart as SeatingChartType } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Plus, Download, RefreshCw, Move, Grid3x3 } from 'lucide-react';

const SeatingChartPage: React.FC = () => {
  const [charts, setCharts] = useState<SeatingChartType[]>([]);
  const [currentChart, setCurrentChart] = useState<SeatingChartType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useStableToast();
  const { isOpen: createOpen, open: openCreate, close: closeCreate } = useModal();
  const { show, confirm } = useConfirmDialog();

  const fetchCharts = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.seating.getAll();
      setCharts(result.data || []);
    } catch (err) {
      showToast('获取座次表失败', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchCharts(); }, [fetchCharts]);

  const handleAutoArrange = async (chartId: number, strategy: string) => {
    try {
      await api.seating.autoArrange(chartId, strategy, currentChart?.class_id || 1);
      showToast('自动排列成功', 'success');
      fetchCharts();
    } catch (err) {
      showToast('自动排列失败', 'error');
    }
  };

  const handleSeatDrop = async (chartId: number, row: number, col: number, studentId: number) => {
    try {
      await api.seating.updateSeat(chartId, row, col, studentId);
      showToast('座位更新成功', 'success');
    } catch (err) {
      showToast('座位更新失败', 'error');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">座次表管理</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => handleAutoArrange(currentChart?.id || 0, 'height_vision')}>
            <RefreshCw className="w-4 h-4 mr-1" /> 按身高视力排列
          </Button>
          <Button variant="primary" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> 新建座次表
          </Button>
        </div>
      </div>

      {/* Seating Grid */}
      {currentChart && (
        <Card className="p-4">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${currentChart.columns}, 1fr)` }}>
            {currentChart.seats?.map((seat) => (
              <div
                key={`${seat.row}-${seat.col}`}
                className={`aspect-square flex items-center justify-center rounded border text-sm ${
                  seat.is_aisle ? 'bg-gray-200 border-dashed' : 'bg-blue-50 border-blue-300'
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const studentId = parseInt(e.dataTransfer.getData('studentId'));
                  if (studentId) handleSeatDrop(currentChart.id, seat.row, seat.col, studentId);
                }}
              >
                {seat.student_id || (seat.is_aisle ? '过道' : '')}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Create Modal */}
      <Modal isOpen={createOpen} onClose={closeCreate} title="新建座次表">
        {/* Create form */}
      </Modal>
    </div>
  );
};

export default SeatingChartPage;
```

- [ ] **Step 2: 创建其余 10 个页面**

按相同模式创建：
- `frontend/src/pages/DutyRoster.tsx`
- `frontend/src/pages/CommitteeList.tsx`
- `frontend/src/pages/ParentContact.tsx`
- `frontend/src/pages/HomeworkCheck.tsx`
- `frontend/src/pages/AttendanceManage.tsx`
- `frontend/src/pages/StudyGroups.tsx`
- `frontend/src/pages/MentalHealth.tsx`
- `frontend/src/pages/ActivityManage.tsx`
- `frontend/src/pages/CultureBoard.tsx`
- `frontend/src/pages/StudyGuide.tsx`

- [ ] **Step 3: 提交代码**

---

### Task 27: 集成路由到 App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 添加路由配置**

在 App.tsx 的 preloadConfigs 和 Routes 中添加：

```tsx
// preloadConfigs 中添加
const preloadConfigs = {
  // ... 现有配置
  seating: { priority: 'medium', preloadOnHover: true },
  duty: { priority: 'low' },
  committee: { priority: 'low' },
  parent: { priority: 'medium', preloadOnHover: true },
  homework: { priority: 'high', preloadOnHover: true },
  attendance: { priority: 'high', preloadOnHover: true },
  studyGroup: { priority: 'medium' },
  mentalHealth: { priority: 'low' },
  activity: { priority: 'low' },
  culture: { priority: 'low' },
  studyGuide: { priority: 'low' },
};

// Routes 中添加
<Route path="seating" element={
  <PermissionGuard requiredPermission="class.view">
    <SeatingChartPage />
  </PermissionGuard>
} />
<Route path="duty" element={
  <PermissionGuard requiredPermission="class.view">
    <DutyRosterPage />
  </PermissionGuard>
} />
{/* ... 其余 9 个路由 */}
```

- [ ] **Step 2: 更新权限列表**

在 `frontend/src/stores/index.ts` 中的 permission store 添加新的权限键。

- [ ] **Step 3: 提交代码**

---

## Phase 4: 测试与验证

### Task 28: 后端单元测试

- [ ] **Step 1: 运行所有后端测试**

```bash
& "C:\Users\53527\AppData\Local\Programs\Python\Python311\python.exe" -m pytest backend/tests/ -v --tb=short
```

Expected: 所有新模块测试通过

- [ ] **Step 2: 运行 flake8 检查**

```bash
& "C:\Users\53527\AppData\Local\Programs\Python\Python311\python.exe" -m flake8 backend/models/seating.py backend/services/seating_service.py --max-line-length=120
```

Expected: 无错误或仅有少量可接受的警告

### Task 29: 前端构建验证

- [ ] **Step 1: 运行 TypeScript 类型检查**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 2: 运行 ESLint 检查**

```bash
cd frontend && npm run lint
```

- [ ] **Step 3: 构建前端项目**

```bash
cd frontend && npm run build
```

Expected: 构建成功，无错误

### Task 30: 集成测试

- [ ] **Step 1: 启动后端服务并运行 API 集成测试**
- [ ] **Step 2: 启动前端开发服务器并验证所有新页面可访问**
- [ ] **Step 3: 运行 Playwright E2E 测试验证关键流程**

---

## Phase 5: 文档与配置更新

### Task 31: 更新 API 文档

- [ ] **Step 1: 重新生成 API 文档**

```bash
cd backend && python tools/generate_api_docs.py
```

- [ ] **Step 2: 更新 README 项目结构**

更新 README.md 中的项目结构树，反映新增的模块。

### Task 32: 更新权限配置

- [ ] **Step 1: 在 `backend/utils/permission.py` 中添加新权限**

```python
PERMISSIONS = {
    # ... existing roles
    "teacher": [
        # ... existing permissions
        "seating.view", "seating.edit",
        "duty.view", "duty.edit",
        "committee.view", "committee.edit",
        "parent.view", "parent.edit", "parent.contact",
        "homework.view", "homework.edit", "homework.check",
        "attendance.view", "attendance.edit", "attendance.approve",
        "study_group.view", "study_group.edit",
        "mental_health.view", "mental_health.edit",
        "activity.view", "activity.edit",
        "culture.view", "culture.edit",
        "study_guide.view", "study_guide.edit",
    ],
    "head_teacher": [
        # ... existing permissions + 全部新模块权限
    ],
}
```

### Task 33: 最终验证与提交

- [ ] **Step 1: 全量测试通过**
- [ ] **Step 2: 构建成功**
- [ ] **Step 3: 所有新页面路由可访问**
- [ ] **Step 4: API 文档包含新端点**
- [ ] **Step 5: Git 提交**

```bash
git add -A
git commit -m "feat: integrate teacher workbench with 11 new modules

Backend:
- Add 11 model modules: seating, duty, committee, parent, homework,
  attendance, study_group, mental_health, activity, culture, study_guide
- Add 11 service modules with full CRUD and business logic
- Add 11 API route modules with Flask-RESTX
- Extend permission system with 20+ new permission keys
- Add auto-arrange seating algorithm (height_vision, score_tier)
- Add duty auto-rotation, homework tracking, attendance management

Frontend:
- Add 11 new pages: SeatingChart, DutyRoster, CommitteeList,
  ParentContact, HomeworkCheck, AttendanceManage, StudyGroups,
  MentalHealth, ActivityManage, CultureBoard, StudyGuide
- Add TypeScript type definitions for all new entities
- Add API client methods for all new endpoints
- Integrate routes with PermissionGuard
- Responsive design for mobile access

Documentation:
- Update API documentation with 100+ new endpoints
- Update project structure in README
- Update permission configuration
- Update deployment guide with new module references"
```

---

## 执行顺序建议

```
Phase 1 (Models + Services)
  ├─ Task 1: 座次表
  ├─ Task 2: 值日生表
  ├─ Task 3: 班委名单
  ├─ Task 4: 家长联系
  ├─ Task 5: 作业检查
  ├─ Task 6: 考勤管理
  ├─ Task 7: 学习小组
  └─ Task 8: 心理/活动/文化/学法

Phase 2 (API Routes) - 依赖 Phase 1
  └─ Task 9-14: 为每个模块创建路由

Phase 3 (Frontend) - 依赖 Phase 2
  ├─ Task 15: 类型 + API 客户端
  ├─ Task 16-26: 11 个页面
  └─ Task 27: 路由集成

Phase 4 (Testing) - 依赖 Phase 3
  └─ Task 28-30: 单元 + 集成 + E2E 测试

Phase 5 (Docs + Config) - 依赖 Phase 4
  └─ Task 31-33: 文档 + 权限 + 最终验证
```

预计总工时: 约 80-120 小时（含测试和文档）
建议使用 subagent-driven 模式逐 Task 执行

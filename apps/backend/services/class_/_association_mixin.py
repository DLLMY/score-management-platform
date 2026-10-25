from services.class_ import _shared
"""班级-班主任/管理员关联校验与修复。"""

from datetime import datetime


class _ClassAssociationMixin:
    def validate_associations(self):
        issues = []
        all_classes = _shared.ClassInfo.query.all()
        if not all_classes:
            return {"success": True, "total_classes": 0, "issues_found": 0, "issues": []}

        # R20：批量预取所有班级的 _shared.AdminClass 关联（单次 IN 查询），消除逐班 2 次点查的 N+1
        links = _shared.AdminClass.query.filter(
            _shared.AdminClass.class_info_id.in_([c.id for c in all_classes])
        ).all()
        links_by_class = {}
        for _link in links:
            links_by_class.setdefault(_link.class_info_id, []).append(_link)

        for cls in all_classes:
            head_teacher_id = cls.head_teacher_id

            if head_teacher_id:
                admin_link = next(
                    (
                        _l
                        for _l in links_by_class.get(cls.id, [])
                        if _l.admin_id == head_teacher_id
                    ),
                    None,
                )

                if not admin_link:
                    issues.append(
                        {
                            "type": "missing_link",
                            "class_name": cls.name,
                            "class_id": cls.id,
                            "head_teacher_id": head_teacher_id,
                            "message": (
                                f'班级 "{cls.name}" 的班主任ID({head_teacher_id})'
                                "在AdminClass表中缺少关联记录"
                            ),
                        }
                    )
                elif not admin_link.is_primary:
                    issues.append(
                        {
                            "type": "not_primary",
                            "class_name": cls.name,
                            "class_id": cls.id,
                            "head_teacher_id": head_teacher_id,
                            "message": (f'班级 "{cls.name}" 的班主任关联is_primary未设置为True'),
                        }
                    )

            primary_link = next(
                (_l for _l in links_by_class.get(cls.id, []) if _l.is_primary), None
            )

            if primary_link and cls.head_teacher_id != primary_link.admin_id:
                issues.append(
                    {
                        "type": "mismatch",
                        "class_name": cls.name,
                        "class_id": cls.id,
                        "head_teacher_id": cls.head_teacher_id,
                        "primary_admin_id": primary_link.admin_id,
                        "message": (
                            f'班级 "{cls.name}" 的head_teacher_id('
                            f"{cls.head_teacher_id})与AdminClass主班关联("
                            f"{primary_link.admin_id})不一致"
                        ),
                    }
                )

        return {
            "success": True,
            "total_classes": len(all_classes),
            "issues_found": len(issues),
            "issues": issues,
        }

    def fix_associations(self):
        fixed_count = 0
        issues_fixed = []
        all_classes = _shared.ClassInfo.query.all()

        with _shared.db_session_scope(detach=False):
            for cls in all_classes:
                head_teacher_id = cls.head_teacher_id

                if head_teacher_id:
                    admin_link = _shared.AdminClass.query.filter_by(
                        admin_id=head_teacher_id, class_info_id=cls.id
                    ).first()

                    if not admin_link:
                        new_link = _shared.AdminClass(
                            admin_id=head_teacher_id,
                            class_info_id=cls.id,
                            is_primary=True,
                            assigned_at=datetime.now(),
                        )
                        _shared.db.session.add(new_link)
                        fixed_count += 1
                        issues_fixed.append(
                            {
                                "class_name": cls.name,
                                "action": "created_link",
                                "message": (f'为班级 "{cls.name}" 创建了AdminClass关联记录'),
                            }
                        )
                    elif not admin_link.is_primary:
                        admin_link.is_primary = True
                        fixed_count += 1
                        issues_fixed.append(
                            {
                                "class_name": cls.name,
                                "action": "set_primary",
                                "message": (
                                    f'将班级 "{cls.name}" 的AdminClass关联is_primary设置为True'
                                ),
                            }
                        )

                primary_link = _shared.AdminClass.query.filter_by(
                    class_info_id=cls.id, is_primary=True
                ).first()

                if primary_link and cls.head_teacher_id != primary_link.admin_id:
                    cls.head_teacher_id = primary_link.admin_id
                    fixed_count += 1
                    issues_fixed.append(
                        {
                            "class_name": cls.name,
                            "action": "sync_head_teacher",
                            "message": (
                                f'同步班级 "{cls.name}" 的head_teacher_id为AdminClass主班管理员'
                            ),
                        }
                    )

        return {
            "success": True,
            "fixed_count": fixed_count,
            "issues_fixed": issues_fixed,
        }

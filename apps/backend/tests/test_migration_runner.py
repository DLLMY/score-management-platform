# -*- coding: utf-8 -*-
"""数据库就绪（P0-d）测试：验证 reconcile + seed 鲁棒路径。

取代原先对手写迁移脚本编排器（runner.py）的依赖测试。本测试在独立子进程中通过
`create_app(lightweight=True)` 真实触发 `app/db_init.init_database` 内的
`ensure_database_ready`（reconcile_schema + seed_defaults），并断言：
- 全部模型表落地（schema 完整，无缺表）；
- 关键历史演进列存在（device_secret / risk_score / device_type 等）；
- 默认种子数据补齐（class_periods=12，warning_configs=5）；
- 重复执行幂等（第二次 reconcile 不新增任何表/列/索引）；
- 列补偿分支有效（DROP 一个可空列后 reconcile 能自动加回）。
"""
import json
import os
import subprocess
import sys
import tempfile
import textwrap

BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

_HELPER = textwrap.dedent(
    """
    import os, sys, json
    sys.path.insert(0, sys.argv[2])
    db = sys.argv[1]
    os.environ.setdefault("FLASK_ENV", "development")
    os.environ["FLASK_LIGHTWEIGHT"] = "true"
    os.environ["DATABASE_URI"] = "sqlite:///" + db
    # 触发模块级 get_app(lightweight=True) -> create_app -> init_database ->
    # ensure_database_ready（reconcile + seed）作用于临时库。
    from app import app
    from models import db as model_db
    from sqlalchemy import inspect, text
    from migrations.reconcile import reconcile_schema

    result = {}
    with app.app_context():
        # 幂等：第二次 reconcile 不应新增任何表/列/索引
        t, c, i = reconcile_schema(app, verbose=False)
        result["second_run"] = [t, c, i]

        insp = inspect(model_db.engine)
        existing = set(insp.get_table_names())
        model_tables = set(model_db.metadata.tables.keys())
        result["missing_tables"] = sorted(model_tables - existing)

        def cols(t):
            return {r["name"] for r in insp.get_columns(t)}

        result["has_device_secret"] = "device_secret" in cols("device")
        result["has_risk_score"] = "risk_score" in cols("user")
        result["has_device_type"] = "device_type" in cols("firmware_versions")
        result["has_operation_log_id"] = "operation_log_id" in cols("score_record")
        result["has_class_periods_table"] = "class_periods" in existing

        from models import ClassPeriod, WarningConfig
        result["period_count"] = ClassPeriod.query.count()
        result["warning_count"] = WarningConfig.query.count()

        # 列补偿分支：DROP 一个"安全"列（非 PK / 非索引 / 非唯一 / 非 FK / 可空），
        # 再跑 reconcile 应自动加回。
        from models import User
        tname = User.__tablename__
        fk_cols = set()
        for fk in insp.get_foreign_keys(tname):
            fk_cols.update(fk.get("constrained_columns", []))
        indexed = set()
        for ix in insp.get_indexes(tname):
            indexed.update(ix.get("column_names", []))
        target = None
        for col in insp.get_columns(tname):
            name = col["name"]
            if name == "id" or col.get("primary_key"):
                continue
            if name in indexed or name in fk_cols or col.get("unique"):
                continue
            if col.get("nullable") is not True:
                continue
            target = name
            break
        result["drop_target"] = target
        if target:
            with model_db.engine.connect() as conn:
                conn.execute(text('ALTER TABLE "%s" DROP COLUMN "%s"' % (tname, target)))
                conn.commit()
            t2, c2, i2 = reconcile_schema(app, verbose=False)
            result["after_drop_run"] = [t2, c2, i2]
            insp2 = inspect(model_db.engine)
            result["readded"] = target in {r["name"] for r in insp2.get_columns(tname)}
    print("MIGRESULT:" + json.dumps(result))
    """
)


def _run_helper():
    with tempfile.TemporaryDirectory() as td:
        db_path = os.path.join(td, "recon.db")
        helper = os.path.join(td, "recon_helper.py")
        with open(helper, "w", encoding="utf-8") as f:
            f.write(_HELPER)

        env = dict(os.environ)
        proc = subprocess.run(
            [sys.executable, helper, db_path, BACKEND_ROOT],
            cwd=BACKEND_ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=300,
        )
        if proc.returncode != 0:
            raise AssertionError(
                "reconcile 集成子进程失败:\nSTDOUT:\n%s\nSTDERR:\n%s"
                % (proc.stdout, proc.stderr)
            )

        payload = None
        for line in proc.stdout.splitlines():
            if line.startswith("MIGRESULT:"):
                payload = json.loads(line[len("MIGRESULT:"):])
                break
        assert payload is not None, "未找到 MIGRESULT 输出:\n%s" % proc.stdout
        return payload


def test_resolve_db_path_default(monkeypatch):
    monkeypatch.delenv("DATABASE_URI", raising=False)
    from migrations.reconcile import resolve_db_path

    p = resolve_db_path()
    assert p.endswith(os.path.join("instance", "score_management.db"))


def test_resolve_db_path_from_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URI", "sqlite:///data/prod.db")
    from migrations.reconcile import resolve_db_path

    p = resolve_db_path()
    assert os.path.isabs(p)
    assert p.endswith("prod.db")


def test_reconcile_and_seed_integration():
    payload = _run_helper()

    # 1) 模型表全部落地，无缺表
    assert payload["missing_tables"] == [], payload

    # 2) 关键历史演进列存在
    assert payload["has_device_secret"] is True, payload
    assert payload["has_risk_score"] is True, payload
    assert payload["has_device_type"] is True, payload
    assert payload["has_operation_log_id"] is True, payload
    assert payload["has_class_periods_table"] is True, payload

    # 3) 默认种子数据补齐
    assert payload["period_count"] == 12, payload
    assert payload["warning_count"] == 5, payload

    # 4) 幂等：第二次 reconcile 不新增任何表/列/索引
    assert payload["second_run"] == [0, 0, 0], payload

    # 5) 列补偿分支：DROP 一个安全列后 reconcile 能自动加回
    assert payload["drop_target"] is not None, "未找到可用于补偿测试的安全列: %s" % payload
    assert payload["after_drop_run"][1] == 1, payload  # 恰好加回 1 列
    assert payload["readded"] is True, payload

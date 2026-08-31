"""操作日志写入公共工具（B8 2026-08-23）。

收敛 services 层散落的 `log = OperationLog(...); db.session.add(log); db.session.commit()`
三行样板（firmware_service 6 处、mqtt_service、notification_service 等）。
只封装写入，不改变日志字段语义；operator 缺省沿用既有 "Admin" 占位。

用法：
    write_operation_log("firmware_create", "firmware", firmware.id,
                        f"Created firmware version: {firmware.version}")
"""

from models import db, OperationLog


def write_operation_log(operation_type, target_type, target_id, description, operator="Admin"):
    """写入一条操作日志并提交（与原 add + commit 两次调用语义一致）。返回日志 id。"""
    log = OperationLog(
        operation_type=operation_type,
        target_type=target_type,
        target_id=target_id,
        operator=operator,
        description=description,
    )
    db.session.add(log)
    db.session.commit()
    return log.id

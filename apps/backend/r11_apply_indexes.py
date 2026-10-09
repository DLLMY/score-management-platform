"""R11 应用补丁（修正版）：字节级、保行尾（兼容 \r\n / \r\r\n），给两处 GROUP BY 缺失索引补缺。"""
import os
import re

BACKEND = r"C:\Users\53527\Desktop\自我管理提升\自我管理提升V2.0\平台开发\管理平台设计\apps\backend"

patches = {
    os.path.join(BACKEND, "models", "system_models.py"): [
        # 捕获实际行尾（\r* 兼容 \r\r\n 双回车），原样保留
        (
            rb'(db\.Index\("ix_operation_log_user_created", "user_id", "created_at"\),)(\r*\n)',
            rb'\1\2        db.Index("ix_log_operation_type", "operation_type"),\2',
        ),
    ],
    os.path.join(BACKEND, "models", "user_models.py"): [
        # 同时修复已被误改的 line 393 污染，并正确加 index=True（置于 Column() 内）
        (
            rb'db\.Column\(db\.String\(50\)\)(, index=True)?',
            rb'db.Column(db.String(50), index=True)',
        ),
    ],
}

for fp, plist in patches.items():
    data = open(fp, "rb").read()
    for pat, rep in plist:
        if re.search(pat, data):
            new = re.sub(pat, rep, data, count=1)
            print(f"[{'PATCHED' if new!=data else 'SKIP-NOCHANGE'}] {fp}")
            data = new
        else:
            print(f"[SKIP-NOMATCH] {fp}: {pat!r}")
    open(fp, "wb").write(data)

print("done")

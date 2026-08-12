"""TEMPLATE: 后端真实链路 smoke test（隔离，运行后删除，勿入库）。

用法：
  cd <project_root>
  .venv/Scripts/python backend/smoke_<topic>.py 2>&1 | grep -E "SMOKE_RESULT|..."
复制本文件后，替换 TODO 段为具体服务的驱动逻辑，并：
  - 写路径：建临时行 → 驱动函数 → 读真实列值断言 → 删临时行回滚（db.session.commit）
  - 读/纯函数路径：断言结构 + 已知已修复行为
  - 打印 json.dumps({... "SMOKE_RESULT": "PASS"/"FAIL"})
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
# from models import User, ScoreRecord, db   # TODO: 按需导入
# from services.<module> import <Service>    # TODO: 按需导入


def main():
    app = create_app()
    with app.app_context():
        res = {}

        # ===== TODO: 写路径示例 =====
        # tmp = Model(field=...)
        # db.session.add(tmp); db.session.commit()
        # before = <read real column>
        # out = Service.do_something(tmp.id)
        # after = <read real column again>
        # res["write_ok"] = (after != before) and (out.get("success") is True)
        # db.session.delete(tmp); db.session.commit()   # 还原

        # ===== TODO: 读/纯函数路径示例 =====
        # r = Service.pure_fn(sample)
        # res["pure_ok"] = isinstance(r, list) and len(r) == len(sample)

        ok = (
            res.get("write_ok", True)
            and res.get("pure_ok", True)
        )
        res["SMOKE_RESULT"] = "PASS" if ok else "FAIL"
        print(json.dumps(res, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()

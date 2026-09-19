#!/usr/bin/env python3
"""学生积分管理平台 - 开发环境一键配置脚本（onboarding）。

从「全新克隆」到「本地可运行」的一条命令：
    1. 依赖安装：后端 venv + pip 安装 requirements(.txt / -ml.txt)；前端 npm install
    2. .env 模板：复制 .env.example -> .env（后端 / 前端，已存在则跳过）
    3. DB 初始化：create_app() + db.create_all() 建表；初始化默认管理员

区别于 ops/infra/one_click_deploy.py（生产服务器部署），本脚本面向本地开发机上手。
所有步骤幂等，可通过 --skip-* 跳过任意阶段；默认不自动跑 npm/pip（除非 --install）。

用法：
    python setup_dev.py                 # 仅复制 .env 模板 + 初始化 DB（不联网装依赖）
    python setup_dev.py --install       # 完整：装后端/前端依赖 + 复制 .env + 初始化 DB
    python setup_dev.py --skip-frontend # 跳过前端依赖安装
    python setup_dev.py --check         # 仅检查当前环境是否就绪，不改动
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys

ROOT = os.path.abspath(os.path.dirname(__file__))
BACKEND = os.path.join(ROOT, "apps", "backend")
FRONTEND = os.path.join(ROOT, "apps", "frontend")
VENV_DIR = os.path.join(ROOT, ".venv")


def _step(title: str) -> None:
    print("\n" + "=" * 60)
    print("  " + title)
    print("=" * 60)


def _run(cmd, cwd=None, check=True):
    print("> " + " ".join(cmd))
    try:
        subprocess.run(cmd, cwd=cwd, check=check)
    except subprocess.CalledProcessError as e:
        print(f"[警告] 命令失败（{e}），请检查网络/环境后重试该步骤")
        return False
    return True


def _python_exe() -> str:
    """优先使用仓库 .venv，否则回退当前解释器。"""
    if os.path.isdir(VENV_DIR):
        if os.name == "nt":
            return os.path.join(VENV_DIR, "Scripts", "python.exe")
        return os.path.join(VENV_DIR, "bin", "python")
    return sys.executable


def ensure_venv() -> str:
    """确保后端虚拟环境存在（仅 --install 时新建）。"""
    if os.path.isdir(VENV_DIR):
        print(f"[venv] 复用已存在的 {VENV_DIR}")
        return _python_exe()
    print(f"[venv] 创建虚拟环境 {VENV_DIR}")
    subprocess.run([sys.executable, "-m", "venv", VENV_DIR], check=True)
    return _python_exe()


def install_backend(py: str, with_ml: bool) -> None:
    _step("后端依赖安装")
    req = os.path.join(BACKEND, "requirements.txt")
    if os.path.exists(req):
        _run([py, "-m", "pip", "install", "--upgrade", "pip"])
        _run([py, "-m", "pip", "install", "-r", req])
    if with_ml:
        ml_req = os.path.join(BACKEND, "requirements-ml.txt")
        if os.path.exists(ml_req):
            _run([py, "-m", "pip", "install", "-r", ml_req])


def install_frontend() -> None:
    _step("前端依赖安装")
    if not os.path.isdir(FRONTEND):
        print("[前端] 目录不存在，跳过")
        return
    if shutil.which("npm") is None:
        print("[前端] 未检测到 npm，请先安装 Node.js，跳过 npm install")
        return
    _run(["npm", "install"], cwd=FRONTEND)


def ensure_env_files() -> None:
    _step(".env 模板复制")
    pairs = [
        (os.path.join(BACKEND, ".env.example"), os.path.join(BACKEND, ".env")),
        (os.path.join(FRONTEND, ".env.example"), os.path.join(FRONTEND, ".env")),
    ]
    for src, dst in pairs:
        if not os.path.exists(src):
            print(f"[env] 模板缺失，跳过: {src}")
            continue
        if os.path.exists(dst):
            print(f"[env] 已存在，跳过: {dst}")
            continue
        shutil.copyfile(src, dst)
        print(f"[env] 已复制 {src} -> {dst}（请按需修改其中的密钥/连接串）")


def init_db(py: str) -> None:
    _step("数据库初始化（建表 + 默认管理员）")
    script = (
        "from app import create_app; "
        "from models import db; "
        "app = create_app(lightweight=False); "
        "with app.app_context(): "
        "    db.create_all(); "
        "    print('数据库表创建完成')"
    )
    _run([py, "-c", script], cwd=BACKEND)
    # 初始化默认管理员（幂等：已存在则跳过）
    init_admin = os.path.join(BACKEND, "scripts", "init_admin.py")
    if os.path.exists(init_admin):
        _run([py, init_admin], cwd=BACKEND)


def check_env(py: str) -> None:
    _step("环境就绪检查（不改动）")
    ok = True
    if not os.path.isdir(VENV_DIR):
        print("[✗] 后端虚拟环境缺失：.venv 不存在（运行 --install 创建）")
        ok = False
    else:
        print("[✓] 后端虚拟环境 .venv 存在")
    if not os.path.exists(os.path.join(BACKEND, ".env")):
        print("[✗] 后端 .env 缺失（将 .env.example 复制为 .env）")
        ok = False
    else:
        print("[✓] 后端 .env 存在")
    if not os.path.exists(os.path.join(FRONTEND, "node_modules")):
        print("[!] 前端 node_modules 缺失（运行 --install 安装）")
    else:
        print("[✓] 前端 node_modules 存在")

    # 探测 DB 可连接 + 表已建
    probe = (
        "from app import create_app; "
        "from models import db; "
        "app = create_app(lightweight=False); "
        "with app.app_context(): "
        "    print('表数量:', len(db.metadata.tables))"
    )
    try:
        subprocess.run([py, "-c", probe], cwd=BACKEND, check=True)
    except subprocess.CalledProcessError:
        print("[✗] 数据库初始化探测失败，请运行初始化步骤")
        ok = False
    print("\n结论:", "环境就绪 ✓" if ok else "存在未就绪项，请按上述提示补齐")
    sys.stdout.flush()
    os._exit(0 if ok else 1)


def main() -> None:
    parser = argparse.ArgumentParser(description="开发环境一键配置（onboarding）")
    parser.add_argument("--install", action="store_true", help="联网安装后端/前端依赖（默认仅复制 .env + 初始化 DB）")
    parser.add_argument("--with-ml", action="store_true", help="额外安装 requirements-ml.txt（NLP/算法依赖）")
    parser.add_argument("--skip-backend", action="store_true", help="跳过后端依赖安装")
    parser.add_argument("--skip-frontend", action="store_true", help="跳过前端依赖安装")
    parser.add_argument("--skip-env", action="store_true", help="跳过 .env 模板复制")
    parser.add_argument("--skip-db", action="store_true", help="跳过数据库初始化")
    parser.add_argument("--check", action="store_true", help="仅检查环境就绪状态，不改动")
    args = parser.parse_args()

    if args.check:
        check_env(_python_exe())

    _step("开发环境配置开始")
    py = _python_exe()
    if args.install and not args.skip_backend:
        py = ensure_venv()
        install_backend(py, args.with_ml)
    if args.install and not args.skip_frontend:
        install_frontend()
    if not args.skip_env:
        ensure_env_files()
    if not args.skip_db:
        init_db(py)
    _step("完成")
    print("下一步：")
    print("  后端: cd apps/backend && python run.py --env development")
    print("  前端: cd apps/frontend && npm run dev")
    print("  健康检查: curl -f http://localhost:5000/api/health")


if __name__ == "__main__":
    main()

"""运维脚本：手动压缩历史裸轮转日志并清理超期归档（D-M1）。

典型用法：
    python scripts/archive_logs.py
    python scripts/archive_logs.py --retention-days 60 --dry-run
"""
import argparse
import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from utils.log_archiver import (
    LOG_ARCHIVE_SUBDIR,
    LOG_DIR,
    LOG_RETENTION_DAYS,
    archive_existing_rotated,
    enforce_retention,
)


def main():
    parser = argparse.ArgumentParser(description="日志归档维护：压缩裸轮转 + 清理超期")
    parser.add_argument("--log-dir", default=LOG_DIR)
    parser.add_argument("--archive-subdir", default=LOG_ARCHIVE_SUBDIR)
    parser.add_argument("--retention-days", type=int, default=LOG_RETENTION_DAYS)
    parser.add_argument("--dry-run", action="store_true", help="仅打印将要清理的文件，不删除")
    args = parser.parse_args()

    compressed = archive_existing_rotated(log_dir=args.log_dir, archive_subdir=args.archive_subdir)
    print(f"[archive_logs] 已压缩历史裸轮转 {compressed} 个")

    if args.dry_run:
        cutoff = time.time() - args.retention_days * 86400
        archive_dir = os.path.join(args.log_dir, args.archive_subdir)
        would_remove = []
        if os.path.isdir(archive_dir):
            for name in os.listdir(archive_dir):
                if not name.endswith(".gz"):
                    continue
                p = os.path.join(archive_dir, name)
                if os.getmtime(p) < cutoff:
                    would_remove.append(p)
        print(
            f"[archive_logs] dry-run: 以下 {len(would_remove)} 个文件超期"
            f"（保留 {args.retention_days} 天）："
        )
        for p in would_remove:
            print(f"  - {p}")
        return

    removed = enforce_retention(
        log_dir=args.log_dir,
        retention_days=args.retention_days,
        archive_subdir=args.archive_subdir,
    )
    print(f"[archive_logs] 已清理超期归档 {len(removed)} 个（保留 {args.retention_days} 天）")


if __name__ == "__main__":
    main()

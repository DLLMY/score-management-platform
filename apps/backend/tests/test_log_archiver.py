"""D-M1 日志归档回归测试：Gzip 轮转 / 超期清理 / 历史补压。"""
import gzip as _gzip
import logging
import os
import time

from utils.log_archiver import (
    GzipRotatingFileHandler,
    archive_existing_rotated,
    enforce_retention,
)


def test_gzip_rotation_produces_gz(tmp_path):
    log_dir = tmp_path / "logs"
    base = log_dir / "app.log"
    h = GzipRotatingFileHandler(
        str(base), maxBytes=120, backupCount=3, encoding="utf-8", archive_subdir="archive"
    )
    for _ in range(60):
        h.emit(logging.LogRecord("t", logging.INFO, __file__, 1, "x" * 20, None, None))
    h.close()

    archive = log_dir / "archive"
    gz_files = list(archive.glob("*.gz"))
    assert gz_files, "轮转应至少产生一个 .gz 归档"

    # 校验 .gz 可读且内容非空
    with _gzip.open(str(gz_files[0]), "rt", encoding="utf-8") as f:
        content = f.read()
    assert content.strip()


def test_archive_existing_rotated(tmp_path):
    log_dir = tmp_path / "logs"
    log_dir.mkdir()
    (log_dir / "app.log.1").write_text("old1", encoding="utf-8")
    (log_dir / "app.log.2").write_text("old2", encoding="utf-8")
    (log_dir / "app.log").write_text("current", encoding="utf-8")  # 当前日志须跳过

    n = archive_existing_rotated(log_dir=str(log_dir), archive_subdir="archive")
    assert n == 2

    archive = log_dir / "archive"
    assert (archive / "app.log.1.gz").exists()
    assert (archive / "app.log.2.gz").exists()
    assert not (log_dir / "app.log.1").exists()
    assert (log_dir / "app.log").exists()  # 当前日志未被触碰

    # 校验压缩内容正确
    with _gzip.open(str(archive / "app.log.1.gz"), "rt", encoding="utf-8") as f:
        assert f.read() == "old1"


def test_enforce_retention(tmp_path):
    archive = tmp_path / "archive"
    archive.mkdir()
    old = archive / "app.log.1.gz"
    old.write_bytes(b"x")
    os.utime(str(old), (time.time() - 10 * 86400, time.time() - 10 * 86400))
    fresh = archive / "app.log.2.gz"
    fresh.write_bytes(b"y")

    removed = enforce_retention(
        log_dir=str(tmp_path), retention_days=1, archive_subdir="archive"
    )
    assert str(old) in removed
    assert not old.exists()
    assert fresh.exists()

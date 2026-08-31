"""cache_invalidation 全局钩子 + invalidate_cache 真实 Redis 回归测试。

验证点（对应 2026-08-20 同源遗漏修复）：
  - scores / records / exams 写 → 连带失效派生集合 rank / analysis
  - rbac / admins 写 → 连带失效追加日志 permission-logs
  - exam-import / import_export 批量写 → 失效 scores/records/exams/classes/subjects/students/users
  - 任意写 → 强制失效 ALWAYS_INVALIDATE_ON_WRITE = {operation-logs, permission-logs}

做法：把模块级全局缓存服务 services.redis_cache_service.cache 连上真实 Redis
（独立测试库 db=15，与运行库 db=0 隔离），seed 真实格式的缓存键
（`score_management:api:/api/<seg>:<sha256>`），调用真实 invalidate_cache
（走 cache.flush 的 keys()+delete() glob 删除）断言命中。
Redis 不可用时 Redis 相关用例整体 skip（不污染无 Redis 的 CI）。
mapping 结构断言不依赖 Redis，始终运行。

注意：本测试直接连全局 cache（与用户要求"测试里的全局缓存服务连上真实 Redis"一致），
不 mock；其他测试模块对 get_cache_service 做了独立 monkeypatch，不受影响。
"""

import os
import sys

import pytest
import redis

# 让 services / utils / middleware 可被导入（backend/ 为根）
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import redis_cache_service as rcs  # noqa: E402
from services.redis_cache_service import get_cache_service  # noqa: E402
import middleware.cache_invalidation as ci  # noqa: E402
from utils.api_cache_middleware import invalidate_cache  # noqa: E402

# 独立测试库，避免污染运行环境真实缓存（db=0）
REDIS_TEST_URL = os.environ.get("CACHE_TEST_REDIS_URL", "redis://127.0.0.1:6379/15")

PREFIX = rcs.cache._prefix  # "score_management:"
ALL_SEGS = {
    "scores", "exams", "records", "rank", "analysis", "permission-logs",
    "operation-logs", "classes", "subjects", "students", "users", "rbac",
    "admins", "exam-import", "import_export", "devices",
}


def _patterns_for_write_path(path: str):
    """复刻钩子 register_cache_invalidation 的 pattern 生成（使用真实映射）。"""
    parts = [p for p in path.split("/") if p]
    if len(parts) < 2 or parts[0] != "api":
        return set()
    segment = parts[1]
    patterns = {f"api:/api/{segment}/*"}
    for related in ci.CACHE_RELATED_SEGMENTS.get(segment, ()):
        patterns.add(f"api:/api/{related}/*")
    for always in ci.ALWAYS_INVALIDATE_ON_WRITE:
        patterns.add(f"api:/api/{always}/*")
    return patterns


# ---------------------------------------------------------------------------
# 不依赖 Redis 的映射结构断言（始终运行）
# ---------------------------------------------------------------------------

def test_related_segments_cover_derived_collections():
    """scores/records/exams 必须关联派生集合 rank + analysis。"""
    for seg in ("scores", "records", "exams"):
        rel = ci.CACHE_RELATED_SEGMENTS[seg]
        assert "rank" in rel and "analysis" in rel, f"{seg} 未关联 rank/analysis: {rel}"


def test_rbac_admins_cover_permission_logs():
    assert "permission-logs" in ci.CACHE_RELATED_SEGMENTS["rbac"]
    assert "permission-logs" in ci.CACHE_RELATED_SEGMENTS["admins"]


def test_exam_import_and_import_export_cover_written_collections():
    ei = ci.CACHE_RELATED_SEGMENTS["exam-import"]
    for s in ("scores", "records", "exams"):
        assert s in ei, f"exam-import 未覆盖 {s}: {ei}"
    ie = ci.CACHE_RELATED_SEGMENTS["import_export"]
    for s in ("scores", "records", "exams", "classes", "subjects", "students", "users"):
        assert s in ie, f"import_export 未覆盖 {s}: {ie}"


def test_always_invalidate_on_write_set():
    assert ci.ALWAYS_INVALIDATE_ON_WRITE == {"operation-logs", "permission-logs"}


# ---------------------------------------------------------------------------
# 依赖真实 Redis 的端到端失效测试
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def real_redis():
    """把全局缓存服务连上真实 Redis（测试库）；不可用时 skip。"""
    try:
        ok = rcs.cache._connect(REDIS_TEST_URL)
    except Exception:
        ok = False
    if not ok or get_cache_service().client is None:
        pytest.skip(f"真实 Redis 不可用（测试库 {REDIS_TEST_URL}），跳过端到端失效验证")
    client = get_cache_service().client
    client.flushdb()  # 测试库隔离清场
    yield client
    try:
        client.flushdb()
    except Exception as e:
        pytest.fail(f"测试后 Redis flushdb 清理失败，可能污染测试库 {REDIS_TEST_URL}: {e}")


def _seed_and_invalidate(client, write_path, expect_gone):
    # 清场
    keys = list(client.scan_iter(f"{PREFIX}api:/api/*"))
    if keys:
        client.delete(*keys)
    for s in ALL_SEGS:
        client.set(f"{PREFIX}api:/api/{s}:testhash", "cached-value")
    # 真实失效路径
    for p in _patterns_for_write_path(write_path):
        invalidate_cache(p)
    gone = {s for s in ALL_SEGS if not client.exists(f"{PREFIX}api:/api/{s}:testhash")}
    missing = [s for s in expect_gone if s not in gone]
    return gone, missing


def test_scores_write_invalidates_rank_analysis(real_redis):
    gone, missing = _seed_and_invalidate(
        real_redis, "/api/scores/add",
        {"scores", "exams", "rank", "analysis", "operation-logs", "permission-logs"},
    )
    assert not missing, f"未被失效: {missing}；已失效: {sorted(gone)}"


def test_records_write_invalidates_rank_analysis(real_redis):
    gone, missing = _seed_and_invalidate(
        real_redis, "/api/records/xxx",
        {"records", "rank", "analysis", "operation-logs", "permission-logs"},
    )
    assert not missing, f"未被失效: {missing}；已失效: {sorted(gone)}"


def test_exams_write_invalidates_rank_analysis(real_redis):
    gone, missing = _seed_and_invalidate(
        real_redis, "/api/exams/yyy",
        {"exams", "scores", "rank", "analysis", "operation-logs", "permission-logs"},
    )
    assert not missing, f"未被失效: {missing}；已失效: {sorted(gone)}"


def test_rbac_write_invalidates_permission_logs(real_redis):
    gone, missing = _seed_and_invalidate(
        real_redis, "/api/rbac/assign-roles",
        {"rbac", "admins", "permission-logs", "operation-logs"},
    )
    assert not missing, f"未被失效: {missing}；已失效: {sorted(gone)}"


def test_admins_write_invalidates_permission_logs(real_redis):
    gone, missing = _seed_and_invalidate(
        real_redis, "/api/admins/zzz",
        {"admins", "rbac", "permission-logs", "operation-logs"},
    )
    assert not missing, f"未被失效: {missing}；已失效: {sorted(gone)}"


def test_exam_import_write_invalidates_scored_collections(real_redis):
    gone, missing = _seed_and_invalidate(
        real_redis, "/api/exam-import/execute",
        {"exam-import", "scores", "records", "exams", "classes", "subjects",
         "students", "users", "operation-logs", "permission-logs"},
    )
    assert not missing, f"未被失效: {missing}；已失效: {sorted(gone)}"


def test_import_export_write_invalidates_multi_collections(real_redis):
    gone, missing = _seed_and_invalidate(
        real_redis, "/api/import_export/students",
        {"import_export", "scores", "records", "exams", "classes", "subjects",
         "students", "users", "operation-logs", "permission-logs"},
    )
    assert not missing, f"未被失效: {missing}；已失效: {sorted(gone)}"


def test_any_write_invalidates_append_only_logs(real_redis):
    """ALWAYS_INVALIDATE_ON_WRITE：完全无关的写（devices）也必须清掉两个追加日志段。"""
    gone, missing = _seed_and_invalidate(
        real_redis, "/api/devices/register",
        {"devices", "operation-logs", "permission-logs"},
    )
    assert not missing, f"未被失效: {missing}；已失效: {sorted(gone)}"

"""OTA 灰度规划分组隔离测试（C 灰度分组小改验收）。

验证 _plan_rollout 按 device_type 分组洗牌选样：
① 空输入返回空；② pct=100 全选（各类型全覆盖）；
③ pct<100 时各类型至少保留 1 个（小众类型不被全局洗牌挤出）；
④ 分组计数符合各组 ceil(n*pct/100)；⑤ device_type=None 归并 phonebox 同组；
⑥ 分批错峰延迟按全局 index 计算。
"""
from unittest.mock import MagicMock

from services.ota_negotiation_service import (
    _plan_rollout,
    normalize_device_type,
)


def _mk(device_type, tag):
    d = MagicMock()
    d.device_type = device_type
    d.tag = tag
    fw = MagicMock()
    fw.device_type = device_type
    return d, fw


def _build(n_phonebox, n_doorlock, n_none=0):
    eligible = []
    for i in range(n_phonebox):
        eligible.append(_mk("phonebox", "pb%d" % i))
    for i in range(n_doorlock):
        eligible.append(_mk("doorlock", "dl%d" % i))
    for i in range(n_none):
        eligible.append(_mk(None, "nn%d" % i))
    return eligible


def _tags(planned):
    return [d.tag for d, _fw, _delay in planned]


def _delays(planned):
    return [delay for _d, _fw, delay in planned]


class TestOtaRolloutPlan:
    def test_empty(self):
        assert _plan_rollout([], 50, 10) == []

    def test_full_percent_covers_all_types(self):
        eligible = _build(9, 1)
        planned = _plan_rollout(eligible, 100, 0)
        assert len(planned) == 10
        tags = _tags(planned)
        assert any(t.startswith("pb") for t in tags)
        assert any(t.startswith("dl") for t in tags)

    def test_partial_keeps_minority_type(self):
        # phonebox 9 + doorlock 1, pct=50
        # phonebox 组: ceil(9*0.5)=5; doorlock 组: max(1, ceil(1*0.5))=1 -> 共 6
        eligible = _build(9, 1)
        planned = _plan_rollout(eligible, 50, 0)
        assert len(planned) == 6
        tags = _tags(planned)
        # doorlock 必被保留（分组保证覆盖）
        assert sum(1 for t in tags if t.startswith("dl")) == 1
        # phonebox 组恰好 5（计数确定性）
        assert sum(1 for t in tags if t.startswith("pb")) == 5

    def test_single_type_partial(self):
        eligible = _build(3, 0)
        planned = _plan_rollout(eligible, 50, 0)
        # ceil(3*0.5)=2
        assert len(planned) == 2

    def test_none_device_type_groups_as_phonebox(self):
        # device_type=None 归一为 phonebox，与显式 phonebox 同组
        eligible = _build(2, 0, n_none=2)
        planned = _plan_rollout(eligible, 100, 0)
        assert len(planned) == 4

    def test_batch_delay_by_global_index(self):
        # pct=100 全选，bs=2 -> delay = (i//2)*INTERVAL
        eligible = _build(4, 0)
        planned = _plan_rollout(eligible, 100, 2)
        delays = _delays(planned)
        assert delays[0] == 0 and delays[1] == 0
        assert delays[2] == delays[3] and delays[2] > 0

    def test_zero_percent_schedules_nothing(self):
        # stage_percent=0 必须不推送任何设备（pct<=0 提前 continue）
        eligible = _build(9, 1)
        planned = _plan_rollout(eligible, 0, 0)
        assert planned == []

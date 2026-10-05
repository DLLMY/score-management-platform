#!/usr/bin/env python3
"""E2E 回归数据清理器 — 配合 e2e_suite.js 使用，保证回归可重复执行、零污染。

清理三类副作用：
  1. 各表 E2E_/E2E_SUITE_ 前缀标记行（全库 89 表扫描文本列）
  2. 被编辑类用例改写的既有行字段（score_category.name 还原）
  3. 审批级联产生的 notification —— 精确按 id 阈值删（id > 跑套件前的 max(id)），
     绝不用 created_at 粗阈值（曾因 created_at >= '2026-10-05' 误删 9 条同日历史通知）

用法：
  python cleanup_e2e.py --dry-run
  python cleanup_e2e.py --approve-notif-after-id 38 --approve-ids 5
"""
import argparse
import os
import sqlite3
import sys
import time

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   '..', '..', 'apps', 'backend', 'instance', 'score_management.db')

# 期望基线（notification=19：2026-10-05 清理误删 9 条历史审批通知后的实际值，见 README-说明）
BASELINE = {
    'user': 17, 'class_info': 9, 'class_periods': 15, 'score_category': 9,
    'notification': 19, 'approval': 8, 'phone_box_policy': 2,
    'course_schedules': 8, 'parent_contact': 8, 'score_rule': 10,
}
# 编辑类用例触碰过的既有行：表 -> (id, 列, 原始值)
RESTORE = {
    'score_category': (1, 'name', 'PBT06_qwpu4l'),
}
# 手机箱策略基线班级（测试若选其它班级产生的 policy 行会被清理）
PHONEBOX_BASE_CLASSES = {1, 2}
# 审批级联通知：只删「本次审批 id」在运行后新产生的行。
# 关键教训一：绝不能用 created_at >= 某天 这类粗阈值（会误删同日的历史真实数据）；
#             必须记录审批前 notification 的 max(id)，之后只删 id > 该值的行。
# 关键教训二：SQL LIKE 中 '_' 是单字符通配符，'E2E_%' 不会按字面匹配下划线；
#             必须用 ESCAPE 转义，且 ESCAPE 的反斜杠要用「参数」传（不能写进 SQL 字符串，
#             否则 Python 源码里 '\' 会被吞掉导致 ESCAPE 失效、删除静默为 0 行）。
ESCAPE_CHAR = '\\'
MARKER_PATTERN = r'E2E\_%'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--approve-notif-after-id', type=int, default=None,
                    help='只删 id > 此值的审批通过通知（跑套件前 notification 的 max(id)）')
    ap.add_argument('--approve-ids', type=int, nargs='*', default=None,
                    help='本次被审批的申请 id 列表，清理时还原为 pending')
    args = ap.parse_args()

    if not os.path.exists(DB):
        sys.exit('DB not found: %s' % DB)
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    cur.execute('PRAGMA busy_timeout=20000')

    if not args.dry_run:
        # 顺序要点：必须「先还原被编辑的既有行，再删标记行」。
        # 反序会把「被改名成 E2E_xxx 的既有行」当标记行删掉，导致该行永久丢失。
        # 2) 还原被编辑的既有行
        for t, (rid, col, orig) in RESTORE.items():
            try:
                cur.execute('SELECT "%s" FROM "%s" WHERE id=?' % (col, t), (rid,))
                row = cur.fetchone()
                if row is None:
                    print('  restore %s id=%s: row missing, skipped' % (t, rid))
                elif row[0] != orig:
                    cur.execute('UPDATE "%s" SET "%s"=? WHERE id=?' % (t, col), (orig, rid))
                    print('  restored %s id=%s %s: %r -> %r' % (t, rid, col, row[0], orig))
            except sqlite3.Error as e:
                print('  restore %s skipped: %s' % (t, e))

        # 1) 标记行清理
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cur.fetchall()]
        total = 0
        for t in tables:
            try:
                cur.execute('PRAGMA table_info("%s")' % t)
                cols = [r[1] for r in cur.fetchall()]
            except sqlite3.Error:
                continue
            for col in cols:
                where = '"%s" LIKE ? ESCAPE ?' % col
                try:
                    cur.execute('SELECT COUNT(*) FROM "%s" WHERE %s' % (t, where),
                                (MARKER_PATTERN, ESCAPE_CHAR))
                    n = cur.fetchone()[0]
                except sqlite3.Error:
                    continue
                if n:
                    print('  cleanup %s.%s -> %d row(s)' % (t, col, n))
                    cur.execute('DELETE FROM "%s" WHERE %s' % (t, where),
                                (MARKER_PATTERN, ESCAPE_CHAR))
                    total += cur.rowcount
        print('marked rows deleted: %d' % total)

        # 1b) 手机箱「一键放行」副作用：测试对所选班级写入 phone_box_policy 行。
        #     基线为 class_info_id 1,2 两行；测试选的是其它班级 → 按 class_info_id 精确删。
        if not args.dry_run:
            cur.execute('SELECT class_info_id FROM phone_box_policy ORDER BY id')
            classes = [r[0] for r in cur.fetchall()]
            for cid in classes:
                if cid not in PHONEBOX_BASE_CLASSES:
                    cur.execute('DELETE FROM phone_box_policy WHERE class_info_id=?', (cid,))
                    print('  cleanup phone_box_policy class=%s -> %d row(s)' % (cid, cur.rowcount))

        # 3) 审批级联通知：只删「比运行前 max_id 更新」的审批通过行（精确、不误删历史）
        #    用法：--approve-notif-after-id <N>（N = 跑套件前 notification 的 max(id)）
        if args.approve_notif_after_id is not None:
            cur.execute(
                "DELETE FROM notification WHERE id > ? AND title LIKE '审批通过%'",
                (args.approve_notif_after_id,))
            print('cascade notifications deleted: %d' % cur.rowcount)
            # 同步把被审批的 pending 申请还原
            for aid in (args.approve_ids or []):
                cur.execute('SELECT status FROM approval WHERE id=?', (aid,))
                r = cur.fetchone()
                if r and r[0] == 'approved':
                    cur.execute("UPDATE approval SET status='pending', approve_time=NULL, comment=NULL WHERE id=?",
                                (aid,))
                    print('  approval id=%s restored to pending' % aid)

        conn.commit()

    # 4) 残留复检 + 基线对照
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    leftover = 0
    for (t,) in cur.fetchall():
        try:
            cur.execute('PRAGMA table_info("%s")' % t)
            cols = [r[1] for r in cur.fetchall()]
        except sqlite3.Error:
            continue
        for col in cols:
            try:
                cur.execute('SELECT COUNT(*) FROM "%s" WHERE "%s" LIKE ? ESCAPE ?' % (t, col),
                            (MARKER_PATTERN, ESCAPE_CHAR))
                leftover += cur.fetchone()[0]
            except sqlite3.Error:
                continue
    print('\nE2E marker leftover: %d' % leftover)

    print('\n%-22s %-8s %-8s %s' % ('table', 'count', 'expect', 'ok'))
    allok = True
    for t, exp in BASELINE.items():
        try:
            cur.execute('SELECT COUNT(*) FROM "%s"' % t)
            got = cur.fetchone()[0]
        except sqlite3.Error:
            print('%-22s %-8s %-8s %s' % (t, '-', exp, 'TABLE_MISSING'))
            allok = False
            continue
        ok = 'OK' if got == exp else 'DIFF'
        if got != exp:
            allok = False
        print('%-22s %-8d %-8d %s' % (t, got, exp, ok))
    print('\nRESULT: %s' % ('BASELINE CLEAN' if allok and leftover == 0 else 'NEEDS ATTENTION'))
    conn.close()


if __name__ == '__main__':
    main()

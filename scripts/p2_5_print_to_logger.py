#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""P2-7: 将 backend 运行时代码（api/utils/config/middleware/tasks）残留调试 print 收口为 utils.logger。
规则：
  - 处于 except 块 -> log_warning(exception=<e 或忽略>)
  - 处于 `if __name__ == "__main__"` 块 -> log_debug
  - 显式 override 映射（非 except 的告警 / 逐消息噪音行）
  - 其余 -> log_info
保留原字符串与缩进（含多行 print）。已转换文件再跑会幂等跳过。
注意：print(..., file=sys.stderr) 等带流参数的调用不在本脚本范围（手工处理）。
"""
import ast
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVICES = os.path.join(ROOT, "backend", "services")

# 以 backend/ 开头的按仓库根相对路径；否则视为 services 下文件名
TARGETS = [
    "backend/api/devices/firmware_routes.py",
    "backend/api/scores/approvals_routes.py",
    "backend/api/scores/rules_routes.py",
    "backend/api/system/system_routes.py",
    "backend/config/config_loader.py",
    "backend/middleware/__init__.py",
    "backend/utils/validation_middleware.py",
    "backend/tasks/mqtt_tasks.py",
    "backend/tasks/notification_tasks.py",
    "backend/tasks/scheduled_tasks.py",
    "backend/tasks/scheduler.py",
]

# (文件, 行号) -> ("warning"|"debug", exc_name_or_None)
OVERRIDE = {
    # mqtt_tasks 未匹配处理：逐消息噪音 -> debug
    ("mqtt_tasks.py", 50): ("debug", None),   # 设备消息(未匹配处理)
    ("mqtt_tasks.py", 67): ("debug", None),   # 积分消息(未匹配处理)
    # scheduler 每轮轮询"无超时审批" -> debug（否则周期日志噪音）
    ("scheduler.py", 61): ("debug", None),
}

IMPORT_LINE = "from utils.logger import log_info, log_warning, log_debug"


def max_end_lineno(node):
    if not hasattr(node, "lineno"):
        return 0
    m = getattr(node, "end_lineno", node.lineno) or node.lineno
    for child in ast.iter_child_nodes(node):
        c = max_end_lineno(child)
        if c > m:
            m = c
    return m


def is_main_guard(node):
    t = node.test
    if not isinstance(t, ast.Compare):
        return False
    if not (len(t.ops) == 1 and isinstance(t.ops[0], ast.Eq)):
        return False
    left = t.left
    if not (isinstance(left, ast.Name) and left.id == "__name__"):
        return False
    for comp in t.comparators:
        if isinstance(comp, ast.Constant) and comp.value == "__main__":
            return True
    return False


def transform(path):
    # 二进制读写，精确保留原文件行尾（CRLF/LF），避免整文件翻转
    with open(path, "rb") as f:
        source = f.read().decode("utf-8")
    tree = ast.parse(source, filename=path)

    # 1) 收集 __main__ 块行范围
    main_ranges = []
    for node in ast.walk(tree):
        if isinstance(node, ast.If) and is_main_guard(node):
            start = node.lineno
            end = max_end_lineno(node)
            main_ranges.append((start, end))

    def in_main(lineno):
        return any(s <= lineno <= e for s, e in main_ranges)

    # 2) 遍历，记录每个 Print 节点的 enclosing except 名
    #    用递归，遇到 ExceptHandler 设当前 exc_name
    replacements = []  # (start_offset, end_offset, text)

    class Visitor(ast.NodeVisitor):
        def __init__(self):
            self.exc_stack = []

        def _is_print_call(self, node):
            return (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Name)
                and node.func.id == "print"
            )

        def _handle_print(self, node):
            seg = ast.get_source_segment(source, node)
            if not seg or not seg.startswith("print("):
                return
            # inner = 去掉开头的 print( 与结尾的 )
            inner = seg[6:]
            if inner.endswith(")"):
                inner = inner[:-1]
            lineno = node.lineno
            override = OVERRIDE.get((os.path.basename(path), lineno))
            if override is not None:
                level, exc = override
            elif self.exc_stack:
                level, exc = "warning", self.exc_stack[-1]
            elif in_main(lineno):
                level, exc = "debug", None
            else:
                level, exc = "info", None

            if inner.strip() == "":
                inner = '""'  # 原 print() 空行，避免 log_xxx() 缺参 TypeError
            if level == "info":
                call = f"log_info({inner})"
            elif level == "debug":
                call = f"log_debug({inner})"
            elif level == "warning":
                if exc:
                    call = f"log_warning({inner}, exception={exc})"
                else:
                    call = f"log_warning({inner})"
            else:
                call = f"log_info({inner})"

            start = offset_of(node.lineno, node.col_offset)
            end = offset_of(node.end_lineno, node.end_col_offset)
            replacements.append((start, end, call))

        def generic_visit(self, node):
            if isinstance(node, ast.ExceptHandler):
                name = node.name  # str or None
                self.exc_stack.append(name)
                super().generic_visit(node)
                self.exc_stack.pop()
            elif self._is_print_call(node):
                self._handle_print(node)
                super().generic_visit(node)
            else:
                super().generic_visit(node)

    lines = source.splitlines(keepends=True)

    def offset_of(line, col):
        # ast 的 col_offset/end_col_offset 在本环境按 UTF-8 字节计，
        # 而 len() 按字符计；中文多字节会导致偏移错位。这里把字节列转回字符列。
        o = 0
        for i in range(line - 1):
            o += len(lines[i])
        line_bytes = lines[line - 1].encode("utf-8")
        char_col = len(line_bytes[:col].decode("utf-8"))
        return o + char_col

    v = Visitor()
    v.visit(tree)

    if not replacements:
        print(f"[skip] {os.path.basename(path)}: 无 print")
        return 0

    # 应用替换（从后往前，避免偏移失效）
    replacements.sort(key=lambda r: r[0], reverse=True)
    new_source = source
    for start, end, text in replacements:
        new_source = new_source[:start] + text + new_source[end:]

    # 3) 补顶层 import（模块 docstring 之后、前导 import 段整体结束后插入；
    #    不能以首个 def/class 为锚（可能在模块级 try/except 内或带装饰器），
    #    也不能只看 col0 import 行（多行括号 import 需配平续行））
    if "from utils.logger import log_info" not in new_source:
        new_lines = new_source.splitlines(keepends=True)

        def _bracket_delta(s):
            return (
                s.count("(")
                + s.count("[")
                + s.count("{")
                - s.count(")")
                - s.count("]")
                - s.count("}")
            )

        # 模块 docstring 结束行（若 body[0] 是字符串表达式）→ 1-based；其后行从 0-based 索引 doc_end 开始
        doc_end = 0
        if tree.body and isinstance(tree.body[0], ast.Expr) and isinstance(
            getattr(tree.body[0], "value", None), ast.Constant
        ) and isinstance(tree.body[0].value.value, str):
            doc_end = tree.body[0].end_lineno
        nl = "\r\n" if "\r\n" in source else "\n"  # 按源主行尾注入，避免 CRLF 文件混入 LF → 整文件翻转
        i = doc_end
        head_end = doc_end - 1  # 0-based 最后一行前导 import 段
        while i < len(new_lines):
            ln = new_lines[i]
            s = ln.lstrip()
            if not s or s.startswith("#"):
                i += 1
                continue
            if ln[0] in (" ", "\t"):
                i += 1  # 续行/缩进代码不属于前导段
                continue
            if s.startswith("import ") or s.startswith("from "):
                head_end = i
                bal = _bracket_delta(ln)
                while bal > 0 and i + 1 < len(new_lines):
                    i += 1
                    bal += _bracket_delta(new_lines[i])
                head_end = i
                i += 1
                continue
            break  # 首个非 import 顶层语句，前导段到此为止
        insert_at = head_end + 1
        new_lines.insert(insert_at, IMPORT_LINE + nl)
        new_source = "".join(new_lines)

    # 4) 安全闸：转换后必须能重新解析，否则不写盘
    try:
        ast.parse(new_source, filename=path)
    except SyntaxError as e:
        print(f"[error] {os.path.basename(path)}: 转换后语法错误，已跳过写盘: {e}")
        return 0

    with open(path, "wb") as f:
        f.write(new_source.encode("utf-8"))
    print(f"[ok]   {os.path.basename(path)}: 转换 {len(replacements)} 处")
    return len(replacements)


if __name__ == "__main__":
    total = 0
    for name in TARGETS:
        if name.startswith("backend/"):
            p = os.path.join(ROOT, name)
        else:
            p = os.path.join(SERVICES, name)
        if os.path.exists(p):
            total += transform(p)
        else:
            print(f"[miss] {name}: 文件不存在")
    print(f"合计转换 {total} 处 print")

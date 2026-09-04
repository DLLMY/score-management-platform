#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""P2-6: 将 services 下剩余文件的调试 print 收口为 utils.logger。
规则：
  - 处于 except 块 -> log_warning(exception=<e 或忽略>)
  - 处于 `if __name__ == "__main__"` 块 -> log_debug
  - 显式 override 映射（非 except 的告警 / 缓存调试行）
  - 其余 -> log_info
保留原字符串与缩进（含多行 print）。已转换文件再跑会幂等跳过。
"""
import ast
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVICES = os.path.join(ROOT, "backend", "services")

TARGETS = [
    "class_time_checker.py",
    "composite_score_service.py",
    "mqtt_message_service.py",
    "mqtt_service.py",
    "notification_config_store.py",
    "websocket_service.py",
    "wol_service.py",
]

# (文件, 行号) -> ("warning"|"debug", exc_name_or_None)
OVERRIDE = {
    # websocket 逐连接/订阅事件，高频 -> debug；"处理器已注册"一次性 -> info（默认）
    ("websocket_service.py", 42): ("debug", None),   # Client connected
    ("websocket_service.py", 53): ("debug", None),   # Client disconnected
    ("websocket_service.py", 65): ("debug", None),   # Client subscribed to room
    # composite_score recalc 分支：异常态->warning；常态噪音->debug；结构态 426/446 -> info（默认）
    ("composite_score_service.py", 440): ("warning", None),  # 学生不存在或已停用
    ("composite_score_service.py", 451): ("debug", None),    # 无记录跳过增量（首次需全量）
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

    # 3) 补顶层 import（在首个 def/class 之前）
    if "from utils.logger import log_info" not in new_source:
        new_lines = new_source.splitlines(keepends=True)
        insert_at = len(new_lines)
        for i, ln in enumerate(new_lines):
            s = ln.lstrip()
            if s.startswith("def ") or s.startswith("class "):
                insert_at = i
                break
        new_lines.insert(insert_at, IMPORT_LINE + "\n")
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
        p = os.path.join(SERVICES, name)
        if os.path.exists(p):
            total += transform(p)
        else:
            print(f"[miss] {name}: 文件不存在")
    print(f"合计转换 {total} 处 print")

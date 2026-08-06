"""
批量修复测试文件“局部 import 反模式”。

问题：很多 test_*.py 把 `from services.xxx import Yyy` 写进了某个测试函数内部，
导致同文件其他测试引用 `Yyy` 时 NameError。历史任务 #15「批量修 813 处」未收口。

修复：用 ast 找出所有非模块级（在函数/类/with 等内部）的 import 语句，
去重后提到模块级（插在最后一个顶层 import 之后），并跳过位于 try/if 内的
条件 import（保留其原有语义）。修改前自动备份为 .bak。
"""
import ast
import glob
import os

ROOT = "tests"
files = sorted(glob.glob(os.path.join(ROOT, "**", "test_*.py"), recursive=True))


def collect_local_imports(tree):
    """收集非模块级 import 的规范文本，跳过位于 try/if 内的条件 import。"""
    results = []
    seen = set()

    def walk(node, parent, in_try_or_if):
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.Import, ast.ImportFrom)):
                if not isinstance(parent, ast.Module) and not in_try_or_if:
                    text = ast.unparse(child)
                    if text not in seen:
                        seen.add(text)
                        results.append(text)
            child_in = in_try_or_if or isinstance(child, (ast.Try, ast.If))
            walk(child, child, child_in)

    walk(tree, tree, False)
    return results


def top_level_import_texts(tree):
    texts = set()
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            texts.add(ast.unparse(node))
    return texts


def find_insert_line(tree):
    """返回插入点：最后一个顶层 import 的结束行（1-based），无则 0。"""
    last = 0
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            last = node.end_lineno or node.lineno
    if last == 0:
        # 无顶层 import：插在模块文档字符串之后；否则置顶
        if (
            tree.body
            and isinstance(tree.body[0], ast.Expr)
            and isinstance(tree.body[0].value, ast.Constant)
            and isinstance(tree.body[0].value.value, str)
        ):
            last = tree.body[0].end_lineno or 1
    return last


changed = []
for f in files:
    with open(f, encoding="utf-8") as fh:
        src = fh.read()
    try:
        tree = ast.parse(src)
    except SyntaxError:
        print("SKIP (syntax error):", f)
        continue
    locals_ = collect_local_imports(tree)
    if not locals_:
        continue
    existing = top_level_import_texts(tree)
    to_add = [t for t in locals_ if t not in existing]
    if not to_add:
        continue
    insert_at = find_insert_line(tree)
    # 每个被提升的 import 单独包 try/except ImportError：
    # 有效的照常定义名字（修 NameError）；无效的静默跳过（退化成原行为，绝不破坏集合）。
    block_lines = []
    for t in to_add:
        block_lines.append("try:")
        for bl in t.split("\n"):
            block_lines.append("    " + bl)
        block_lines.append("except ImportError:")
        block_lines.append("    pass")
        block_lines.append("")
    block = "\n".join(block_lines)
    lines = src.splitlines(keepends=True)
    if insert_at == 0:
        new_src = block + "\n" + src
    else:
        new_src = "".join(lines[:insert_at] + [block] + lines[insert_at:])
    with open(f + ".bak", "w", encoding="utf-8") as bf:
        bf.write(src)
    with open(f, "w", encoding="utf-8") as wf:
        wf.write(new_src)
    changed.append((f, len(to_add)))
    print(f"FIX {f}: +{len(to_add)} imports")

print(f"\nTOTAL changed files: {len(changed)}")

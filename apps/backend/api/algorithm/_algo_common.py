"""算法域共享路由装饰器（消除 _alg_part1~6 中重复的 safe_handle 参数）。

算法接口统一以 400 + 固定文案兜底，等价于在各文件重复书写
`@safe_handle(default_status=400, message="算法计算失败，请稍后重试")`。
抽到此处跨 6 个文件复用，行为完全等价。
"""

from utils.decorators import safe_handle


def algo_safe_handle(func):
    """算法域共享路由异常处理装饰器。

    `safe_handle` 是装饰器工厂（首参为 default_status，并非 func），故此处必须用闭包
    显式接收 ``func`` 再转发，而不能用 ``partial``（partial 会把 func 当作首个位置参数
    填入 default_status 槽位，触发 "got multiple values for argument 'default_status'"）。

    等价于在各 _alg_part 文件中重复书写
    ``@safe_handle(default_status=400, message="算法计算失败，请稍后重试")``，行为完全一致。
    """
    # safe_handle 是装饰器工厂（首参为 default_status），须先以参数生成装饰器再作用于 func，
    # 等价于 `@safe_handle(default_status=400, message="...")`。
    return safe_handle(
        default_status=400, message="算法计算失败，请稍后重试"
    )(func)

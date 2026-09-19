# D 战役 · 错误处理规范（H2）

> 单一事实来源：`apps/backend/utils/response.py`、`apps/backend/utils/decorators.py`。
> 任何改动必须以源码为准，本文档为约定说明，不得与源码冲突。

## 1. 统一响应信封（envelope）

后端所有 API 必须返回 `utils/response.py::APIResponse` 构造的标准信封，前端按 `success / code / message / data` 解析。

```jsonc
// 成功
{ "success": true,  "code": 0,      "message": "操作成功", "data": { ... } }
// 失败
{ "success": false, "code": -1,     "message": "资源不存在", "error_code": "NOT_FOUND", "path": "/api/...", "timestamp": "..." }
```

`APIResponse` 提供的方法（源码 line 8–110）：

| 方法 | 语义 | HTTP 状态 |
|------|------|-----------|
| `success(data, message, code=0)` | 通用成功 | 200 |
| `created(data, message)` | 创建成功 | 201 |
| `not_found(message)` | 资源不存在 | 404（`error_code=NOT_FOUND`） |
| `unauthorized(message)` | 未授权 | 401（`UNAUTHORIZED`） |
| `forbidden(message)` | 无权访问 | 403（`FORBIDDEN`） |
| `bad_request(message, errors, error_code="BAD_REQUEST")` | 参数错误 | 400 |
| `server_error(message)` | 服务器内部错误 | 500（`INTERNAL_ERROR`） |
| `rate_limit(message, retry_after)` | 限流 | 429 |
| `pagination(data, page, page_size, total)` | 列表分页 | 200 |
| `list_response(items, page, page_size, total)` | 列表（items 形式） | 200 |

约定：
- `code`：业务码。`0` = 成功；非 `0`/`-1` 为业务细分码；`-1` 为通用失败。
- `error_code`：机器可读错误标识（如 `NOT_FOUND`），仅失败且显式传入时出现在响应体。
- 失败响应自动附加 `path` 与 `timestamp`（构造失败则静默跳过，见 `response.py:36-41`）。

## 2. 路由层统一异常收敛：`safe_handle`

`utils/decorators.py::safe_handle`（源码 line 32）收敛各路由重复的 `try/except → APIResponse.error` 样板：

```python
from utils.decorators import safe_handle

class XResource(Resource):
    @safe_handle()                                   # 默认 500 + 异常文案
    @safe_handle(message="计算失败")                  # 固定错误文案（对齐原 except 分支）
    @safe_handle(message="导出失败", error_code="INTERNAL_ERROR")
    def get(self): ...
```

行为（源码 line 42–64）：
- **透传 `werkzeug.exceptions.HTTPException`**（401/403/404…）→ 交给 Flask 既有错误处理器，维持鉴权中间件语义，绝不吞掉。
- 捕获其它 `Exception` → 返回标准错误信封，`status_code` 取自异常属性或 `default_status`（默认 500）。
- `message` 不传时回退 `异常.message` → 最后回退 `'服务器内部错误'`；**传固定文案可避免 `str(e)` 泄露异常细节**（与既有"不直返异常细节"修复一致）。
- 正常返回路径零侵入（success 响应原样返回）。

迁移原则：路由方法若整段被单一 `try/except Exception` 包裹且统一兜底，应改用 `@safe_handle`；保留业务内的精细分支（如已知的 `HTTPException` 特判）。

## 3. Fail-closed（失败即关闭）原则

- 涉及权限/安全的路由（如 `security_routes`，见 T6 收口）必须 **fail-closed**：鉴权/校验失败时返回拒绝响应，**绝不**降级为放行或返回部分数据。
- 配置/开关类：缺失或解析失败时应失败报错（fail-closed），而非静默采用不安全默认值。
- 与 `safe_handle` 配合：异常路径同样返回标准信封，前端不会因非信封响应而崩溃。

## 4. 前端错误屏蔽（与后端呼应）

前端 `getErrorMessage` 对技术性错误（Python 异常 / SQLAlchemy / 文件名堆栈）做**屏蔽兜底**（`src/services/__tests__/getErrorMessage.test.ts` 已覆盖：技术型错误用状态码兜底，不向用户暴露堆栈）。后端 `safe_handle` 的"固定文案"与之一致——两端都不泄露实现细节。

## 5. 自查清单（新增/修改路由时）

1. 成功路径返回 `APIResponse.success/created/pagination` 之一。
2. 业务失败返回 `bad_request/forbidden/not_found/...` 并带可读 `message`。
3. 含不确定异常的路由加 `@safe_handle`（或保留精细 `HTTPException` 分支）。
4. 安全/权限路径确认 fail-closed，无放行降级。
5. 不返回裸 `dict`/裸 `500`，确保信封结构完整。

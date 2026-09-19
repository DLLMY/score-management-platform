# D 战役 · API 版本迁移指南（H3）

> 单一事实来源：`apps/backend/app/api_versioning.py`（`register_v1_routes` 为路由唯一注册源，line 109）、
> `apps/backend/utils/api_versioning.py`（版本工具与信封）、`apps/backend/utils/response.py`。
> 本文档为约定说明，改动须以源码为准。

## 1. 版本化机制概览

后端通过 `APIVersionManager` + `VersionedBlueprint` 支持多版本共存：

- `utils/api_versioning.py::APIVersionManager`（`current_version = "v2"`，`versions = {"v1", "v2"}`）。
- `VersionedBlueprint`（源码 line 90）：默认 `url_prefix = /api/{version}`，即 **v1 蓝图挂在 `/api/v1`**。
- 路由**唯一注册源** = `app/api_versioning.py::register_v1_routes(api, app)`；历史 `/api`（无版本段）端点由该函数在注册时一并挂载，形成 **`/api` 与 `/api/v1` 双前缀共存**——前端 `src/services/api.ts` 绝大多数调用使用 `/api/...` 无版本段形式。
- 版本选择：`version_required(required_version)`（源码 line 38）读取请求头 `X-API-Version`（默认 `v1`），低于要求版本时返回 400 + `required_version`。
- 响应信封可带 `api_version`（见 `APIVersionResponse`，源码 line 98），供调用方识别。

## 2. 新增一个版本化端点

```python
# 在 register_v1_routes 中
@api.route("/users")                      # 同时暴露 /api/users 与 /api/v1/users
class UserListResource(Resource):
    @safe_handle()
    def get(self):
        return APIResponse.success(data=..., message="成功")
```

要点：
- 端点统一在 `register_v1_routes` 内声明，禁止在其它文件散落 `add_url_rule`。
- 响应走 `APIResponse`（或版本化 `APIVersionResponse`），保持信封 `{success, code, message, data}`。
- 需要版本隔离的业务差异用 `api_version_prefix` / `version_required` 区分，不要复制整份路由。

## 3. 版本迁移（request / response 字段映射）

`utils/api_versioning.py::VersionMigration`（源码 line 141）提供 `migrate_request` / `migrate_response`：

```python
VersionMigration.MIGRATIONS = {
    "v1_to_v2": {
        "user": {"old_field": "student_id", "new_field": "card_id", "transform": lambda x: x},
        "response": {"removed": ["created_date"], "added": ["created_at"],
                     "transform": lambda data: {**data, "created_at": data.pop("created_date", None)}},
    }
}
```

迁移流程：
1. 在 `MIGRATIONS` 注册 `f"{from}_to_{to}"` 映射（字段重命名 + response 增删字段 + transform）。
2. 网关/中间件在跨版本调用前调用 `migrate_request(version_from, version_to, data)`，响应后调用 `migrate_response(...)`。
3. **向后兼容铁律**：旧字段名不得凭空消失；若语义未变（如 `student_id` 仅是改名 `card_id`），保留旧取值映射，绝不做跨语义合并（见 F17 收口经验）。

## 4. 弃用（deprecation）流程

- `register_deprecated(old_endpoint, new_endpoint)` 登记弃用映射。
- `deprecate_warning(old_name, new_name)` 装饰器在响应头写入 `X-Deprecated` / `X-Replacement`，调用方平滑迁移。
- 弃用端点保留至少一个大版本周期后再下线，下线前必须 `grep` 全仓确认无引用（避免沙箱 `grep` 被 SIGTERM 截断造成的"0 引用"误判）。

## 5. 契约校验

前端 `tests/test_api_contract.py` 静态扫描 `api.ts` 的每个调用端点，断言后端存在对应路由。**新增/改名前端端点时必须同步后端路由**，否则契约测试失败（本轮修复的 `exams.import` 孤儿即此例：默认 `/api/exams/import` 无后端路由，已改为真实端点 `/api/exam-import/execute`）。

# API 文档站说明（自我管理提升 V2.0 管理平台）

后端使用 **flask-restx** 自动生成 OpenAPI（Swagger 2.0）规范，文档站提供两种访问形态：

## 1. 在线交互式文档（推荐日常使用）

启动后端后，浏览器直接访问：

```
http://<后端地址>:<端口>/swagger/
```

例如本地开发：`http://127.0.0.1:5000/swagger/`

- 由 `app/config_init.py` 的 `Swagger(app, ...)` 挂载，`specs_route = "/swagger/"`。
- 自带「Try it out」可在线调试每个接口，含双 JWT 鉴权（`persistAuthorization`）。
- 始终与**当前运行代码**一致，**无需刷新**。

## 2. 静态快照（离线 / 对外分发）

目录 `docs/api/`：

| 文件 | 作用 |
|---|---|
| `swagger-ui.html` | Swagger UI 5 页面，加载同目录 `openapi.json` |
| `openapi.json` | OpenAPI 2.0 规范**快照**（最后导出时间见文件内 `info` / 提交记录） |

打开方式（任选）：
- **本地静态托管**（推荐，避免浏览器 CORS / 文件协议限制）：
  ```bash
  python scripts/serve_api_docs.py          # 默认 http://127.0.0.1:8088
  # 浏览器访问 http://127.0.0.1:8088/swagger-ui.html
  ```
- 直接双击 `swagger-ui.html`（部分浏览器因 `file://` 限制无法 fetch `openapi.json`，建议用上面的托管方式）。

> ⚠️ `swagger-ui.html` 的 UI 资源来自 `unpkg.com` CDN，离线查看 UI 需联网；`openapi.json` 本身为本地文件，不受网络影响。如需完全离线，后续可自托管 `swagger-ui-dist` 到本目录。

## 3. 刷新静态快照（代码变更后）

当接口定义变化（新增/修改路由、模型），在线文档会自动更新；但 `openapi.json` 快照需手动刷新：

```bash
# 1) 先启动后端（默认 http://127.0.0.1:5000）
python apps/backend/run.py --env development

# 2) 另开终端导出最新 spec
python scripts/export_openapi.py
#   - 默认从 http://127.0.0.1:5000/swagger.json 抓取
#   - 可覆盖：API_BASE_URL=http://other-host:5000 python scripts/export_openapi.py
#   - 自动写入 docs/api/openapi.json（覆盖旧快照）
```

刷新后建议提交 `docs/api/openapi.json`，保持快照与代码同步（避免文档漂移）。

## 4. CI / 发布

- 在线 `/swagger/` 零维护成本，随代码自动正确。
- 静态快照由人工/发布前 `scripts/export_openapi.py` 刷新并纳入版本控制，作为对外分发的离线文档源。

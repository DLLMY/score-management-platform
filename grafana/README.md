# 监控接入指南（Grafana + Prometheus）

后端已在 `apps/backend/app/metrics_exporter.py` 暴露 **Prometheus 原生 `/metrics`** 端点
（免鉴权、受 `TESTING` 守卫，使用独立 `CollectorRegistry`，`/metrics` 对限流器豁免）。

监控配置的**权威目录为 `ops/infra/`**（Prometheus 抓取、告警规则、Alertmanager、一键监控栈），
本目录 `grafana/` 只提供看板 `dashboard.json`（单源，由监控栈 provisioning 自动加载）。
旧的重复目录 `prometheus/` 已删除。

## 暴露的指标

| 指标 | 类型 | 标签 | 说明 |
|---|---|---|---|
| `flask_http_requests_total` | Counter | method,endpoint,status | HTTP 请求总数 |
| `flask_http_request_duration_seconds` | Histogram | method,endpoint | 请求延迟（自动产生 `_bucket/_count/_sum`） |
| `flask_exceptions_total` | Counter | exception_type | 未捕获异常数 |
| `score_app_info` | Gauge | version | 应用构建信息（恒为 1） |
| `process_*`（`process_resident_memory_bytes` / `process_cpu_seconds_total` 等） | Gauge | — | 进程级资源（ProcessCollector） |
| `ota_updates_total` | Counter | device_type,status | OTA 上报结果（status: started/completed/failed） |
| `ota_negotiations_total` | Counter | result | 版本协商结果（result: no_firmware/up_to_date/skip_too_old/upgrade） |
| `mqtt_connection_state` | Gauge | link | MQTT 链路状态（1 已连 / 0 断开；link: control/telemetry） |
| `mqtt_messages_total` | Counter | direction,link | MQTT 消息（direction: received/published） |
| `score_devices_online` | Gauge | — | 当前在线设备数 |
| `score_devices_total` | Gauge | — | 设备总数 |
| `redis_cache_ops_total` | Counter | operation,result | Redis 缓存操作（operation: get/set/delete；result: hit/miss/ok/err） |

## 1. 一键监控栈（推荐）

监控栈编排见 `ops/infra/docker-compose.monitoring.yml`（Prometheus + Alertmanager + Grafana）。
与主 `docker-compose.yml` 同目录运行以共享默认网络，监控栈即可用服务名 `backend:5000` 抓取：

```bash
cd ops/infra
docker-compose -f docker-compose.yml up -d              # 主栈（若未起）
docker-compose -f docker-compose.monitoring.yml up -d    # 监控栈
```

- Prometheus `http://localhost:9090`（Status → Targets 应见 `score-backend` UP）。
- Alertmanager `http://localhost:9093`。
- Grafana `http://localhost:3001`（默认 `admin` / `${GRAFANA_ADMIN_PASSWORD:-admin}`，登录后改密）。

Grafana 的**数据源与看板经 provisioning 自动加载**（`ops/infra/grafana/provisioning/`），
无需手动添加数据源或导入看板。看板 JSON 单源即本目录 `dashboard.json`。

## 2. 独立运行 Prometheus（不入 compose）

```bash
cd ops/infra
prometheus --config.file=prometheus.yml   # 默认 http://localhost:9090
```

- 抓取目标默认 `backend:5000`（compose 内部服务名）；独立/外部部署改为 `host:5000`。
- 告警规则 `alerting_rules.yml` 已由 `prometheus.yml` 的 `rule_files` 引用；
  分发需配 `alerting:` 指向 Alertmanager（见 `ops/infra/alertmanager.yml`）。

## 3. 手动导入看板（未用 provisioning 时）

任意方式启动 Grafana 后：

1. **添加数据源**：Configuration → Data Sources → Add Prometheus，URL 填 `http://localhost:9090`。
2. **导入看板**：+ → Import → 上传 `grafana/dashboard.json`。
   - 看板内置 `DS_PROMETHEUS` 模板变量，导入时选择上一步的 Prometheus 数据源即可。
3. 看板含 18 个面板：QPS 总览、按 endpoint QPS、P95 延迟、5xx 错误率、异常速率、进程内存、
   进程 CPU、应用存活/版本 + 业务面板（OTA 成功率/速率、版本协商分布、设备在线数/在线率、
   MQTT 连接状态/消息速率、Redis 缓存命中率/操作速率）。

## 4. 告警规则

告警规则见 `ops/infra/alerting_rules.yml`，分两类：

- **HTTP/进程级**：`BackendDown`、`HighHTTPErrorRate`、`HighUncaughtExceptions`、
  `HighRequestLatencyP95`、`ProcessMemoryHigh`、`ProcessCPUHigh`。
- **业务级**：`MQTTLinkDown`（critical）、`OTAFailureRateHigh`、`DevicesMostlyOffline`。

语法校验：`promtool check rules ops/infra/alerting_rules.yml`。
通知渠道（Webhook/邮件/企业微信/钉钉）在 `ops/infra/alertmanager.yml` 填充，凭据经 secret 注入。

## 5. 生产注意事项

- `/metrics` 免鉴权，但**不应暴露到公网**；生产经 nginx 反代时，仅对内网/监控网段开放 `/metrics`。
- 若后端监听非默认端口，同步修改 `ops/infra/prometheus.yml` 的 `targets`。
- 进程级指标 `process_*` 在 Windows 上字段可能少于 Linux（取决于 prometheus_client 平台支持），
  看板会自动隐藏空系列。
- Grafana `3001` 端口避开前端 `3000`；如需与主栈不同网络部署，改 `docker-compose.monitoring.yml`
  并同步 `prometheus.yml` 的 `targets` 为可达地址。

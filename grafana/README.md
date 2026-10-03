# 监控接入指南（Grafana + Prometheus）

后端已在 `apps/backend/app/metrics_exporter.py` 暴露 **Prometheus 原生 `/metrics`** 端点
（免鉴权、受 `TESTING` 守卫，使用独立 `CollectorRegistry`，`/metrics` 对限流器豁免）。
本目录与 `prometheus/` 提供可落地的监控基座（**不部署 Grafana/Prometheus 本身**，仅配置）。

## 暴露的指标

| 指标 | 类型 | 说明 |
|---|---|---|
| `flask_http_requests_total{method,endpoint,status}` | Counter | HTTP 请求总数 |
| `flask_http_request_duration_seconds{method,endpoint}` | Histogram | 请求延迟（自动产生 `_bucket/_count/_sum`） |
| `flask_exceptions_total{exception_type}` | Counter | 未捕获异常数 |
| `score_app_info{version}` | Gauge | 应用构建信息（恒为 1） |
| `process_*`（`process_resident_memory_bytes` / `process_cpu_seconds_total` 等） | Gauge | 进程级资源（ProcessCollector） |

## 1. 启动 Prometheus

```bash
# 在本目录（prometheus/）执行，确保 alert_rules.yml 同目录
prometheus --config.file=prometheus.yml
# 默认 http://localhost:9090
```

- 抓取目标：`localhost:5000/metrics`（后端默认端口；生产经 nginx 反代时改 targets 为 nginx 地址）。
- 告警规则：`rule_files` 已引用 `alert_rules.yml`，需另配 **Alertmanager** 接收通知。

## 2. 启动 Grafana 并导入看板

```bash
# 任意方式启动 Grafana（默认 http://localhost:3000）
```

1. **添加数据源**：Configuration → Data Sources → Add Prometheus，URL 填 `http://localhost:9090`。
2. **导入看板**：+ → Import → 上传 `grafana/dashboard.json`（或粘 JSON）。
   - 看板内置 `DS_PROMETHEUS` 模板变量，导入时选择上一步的 Prometheus 数据源即可。
3. 看板含 8 个面板：QPS 总览、按 endpoint QPS、P95 延迟、5xx 错误率、异常速率、进程内存、进程 CPU、应用存活/版本。

## 3. 告警

- 告警规则见 `prometheus/alert_rules.yml`：TargetDown、5xx 错误率、P95 延迟、异常突增、内存偏高。
- 需在 `prometheus.yml` 同级配置 `alerting:` 段指向 Alertmanager，并在 Alertmanager 配置路由/接收器（邮件/钉钉/Slack 等）。示例略，按团队通知渠道补充。

## 4. 生产注意事项

- `/metrics` 免鉴权，但**不应暴露到公网**；生产经 nginx 反代时，仅对内网/监控网段开放 `/metrics`。
- 若后端监听非 `localhost:5000`，同步修改 `prometheus.yml` 的 `targets` 与 `FLASK_HOST/FLASK_PORT`。
- 进程级指标 `process_*` 在 Windows 上字段可能少于 Linux（取决于 prometheus_client 平台支持），看板会自动隐藏空系列。

# 管理平台设计 — 长期记忆

## 运行 / 测试
- 后端：系统 Python 3.11（带 torch）`python run.py --env development --host 127.0.0.1 --port 5000`；入口 `app/` 包 `get_app()`；顶层 `backend/app.py` 占位死代码勿改；改启动/MQTT 改 `app/service_init.py::init_mqtt`。改后端须强杀全部 python 重启（Flask-SocketIO 不 reload）。
- 前端：Vite dev，proxy /api、/ws → 127.0.0.1:5000；验证 build 用 `node node_modules/vite/bin/vite.js build --logLevel warn`（勿单跑 tsc --noEmit）。
- pytest：3.11 + `-p no:locust --timeout=300`，全量 ~35min / 1633 passed + 9 skipped。前端 vitest 149 passed；e2e 21/21（须 mode:'serial'，后端先起）。

## 架构铁律
- 路由注册唯一源 = `app/api_versioning.py::register_v1_routes`（conftest 用 walk_packages 动态注册 → pytest 永远绿；生产只注册显式列出的，漏列即 404）。新增命名空间须在此补 add_namespace。
- 路由两形态：flask-restx Namespace（被注册）与裸 Blueprint（须 app.register_blueprint 才生效）。
- API 统一信封 {success,code,data}；admin/123456=super_admin。

## RBAC
- 正常启动不 seed；新增权限/角色写幂等增量脚本，禁跑 seed_rbac.py（清库重建）。`scripts/verify_rbac_consistency.py --check-only` 改 RBAC 后必跑。teacher 角色含 class.edit/culture.*/phonebox.unlock.manage/notification.send，无 score.manage。

## 双 JWT 隔离（学生端）
- Admin type=access + requires_permission；学生 type=student + requires_student（置 g.current_student）。`api/student/__init__.py` 必须保留（否则 walk_packages 不递归→404）。

## 功能模块状态（已完成）
- 班主任工作台 12 页、手机箱四态策略（ALLOW_OVERRIDE>ALLOW_WINDOW>BLOCK>DEFER）、上课时间下发互斥、科任批量录分+群发、学期报告导出、积分排行榜、学生端 5 Tab。后端学生 API 全可用，双 JWT 隔离生效。

## 关键坑（勿回退）
- MQTT 双连接：`services/mqtt_manager.py` 控制连接(self._client) 订阅 score/# + phonebox/query + phonebox/unlock/# + phonebox/ota/# + phonebox/points/#（QoS1）；遥测连接(self._telemetry_client) 订阅 phonebox/#（QoS0）。新增控制 topic 加 CONTROL_SUBSCRIPTIONS、遥测加 TELEMETRY_SUBSCRIPTIONS，勿混、勿回退单连接。
- 控制回包 publish_mqtt 默认 qos=1；遥测高频不走此函数。
- score/rules 查询锁竞争：handle_score_rules_query 已加 PRAGMA busy_timeout=5000 + 重试 + logging.error（commit 06e8922，勿在 except 吞成空）。
- score/add 幂等：三分支 add(record) 后须 db.session.flush() 再读 record.id（commit e609259）；否则 undo_code=UNDO_None 致撤销失败。
- MQTT e2e 测试桩须收发分离连接（recv/pub 两条），B predicate 按 result 字符串判定；SUBACK 诊断订阅层。
- StudentPortal.tsx TDZ 白屏已修；前端改动须 playwright 实跑验证（build/lint/vitest 不报）。
- 生产 Broker EMQX（nc5233fc.ala.cn-hangzhou.emqxsl.cn:8883）~5000 msg/s 命中 phonebox/#；干净 e2e 建议本地 Broker（Windows amqtt 不稳，用 Linux）。

## 测试 / 资产 / 约定
- 契约回归 tests/test_api_envelope.py（改端点后必跑）；OpenAPI scripts/verify_openapi_contract.py --update/--strict。
- 不主动 git commit；git push 需代理（本机直连 GitHub 443 不通，DNS 可解析但 TCP 重置）。开代理后 `git -c http.proxy=http://127.0.0.1:<port> push origin main`；勿写全局代理配置。
- 仓库噪音已清理（24 孤儿脚本+12 PNG+21 备份库归档 backend/scripts/archive/，.gitignore 追加）；CI 红已修；裸 Blueprint 已注册；security.py NameError 已修；前端死代码已删；信封拆包 DRY 已抽 unwrapEnvelope。

## 项目规模
- 后端 433 .py / 98k LOC；前端 179 .tsx/.ts / 63k LOC；README/Dockerfile/docker-compose/CI 齐备。

## 🔴 无缝OTA（核心未完成，分阶段）
- 后端 firmware_routes.py 已全：upload/versions/ota/check(REST)/ota/report(REST)/batch-upgrade/ota-upgrade/download/latest/ota-status；mqtt_manager.publish_ota_command 发 phonebox/ota/{device_id}（有 id）或 phonebox/ota（无 id）。
- **P0 已实施（2026-08-15）**：① 固件改订阅 `phonebox/ota/{client_id}`（专属）+ 保留全局 `phonebox/ota` 广播，回调同时处理两 topic（phonebox.ino:445/719）；② 状态回报改发 `phonebox/ota/{client_id}/status`（后端 _process_ota_status 按 payload.device_id 处理）；③ 心跳加 `device_type` + 上电/重连主动发 `phonebox/ota/register`（设备类型上报，phonebox.ino:1061）；④ 后端 `_process_ota_register` 落库（device 表新增 `device_type` 列，迁移脚本 scripts/migrate_add_device_type.py 幂等）+ 心跳处理器也存 device_type + devices API 列表/详情暴露 device_type。→ 手动 OTA 现可精确推到指定设备 + 设备类型可见。
- **P1 已实施（2026-08-15）**：新增 `services/ota_negotiation_service.py`（语义 compare_versions / get_latest_active_firmware / negotiate / can_auto_push / schedule_auto_push（带抖动 Timer 防设备海啸）/ _execute_push 二次校验 / try_auto_negotiate / negotiate_all_devices / build_download_url）。mqtt_manager `_process_ota_register` 与 `_process_heartbeat` 落库后调 try_auto_negotiate；`_process_ota_status` 回写 device.ota_status（upgrading/idle/failed）并成功时写回 fw_version + 清空 last_ota_push_at（闭环自愈）。device 表加 `auto_update`/`ota_status`/`last_ota_push_at`（迁移 scripts/migrate_add_ota_state.py 幂等）。firmware_routes 手动推送改用绝对 `url`（保留 download_url 兼容）+ 新增 `POST /api/firmware/negotiate-all` 全量扫描。
- **连带修复（P1 发现）**：后端原手动 OTA 发 `download_url` 且为相对路径，固件只认 `url` 且需绝对地址 → 手动 OTA 实际也推不到真机。现固件读 `doc["url"] | doc["download_url"]` 且后端发绝对 `url`（由 `OTA_FIRMWARE_BASE_URL` 或 request.host_url 生成）；固件版本比较由字符串 `<=` 改为语义 `cmpVer`（修复 2.10<2.9 误判）。
- **P2 已完成（2026-08-15）**：
  - *固件侧*（phonebox.ino）：① 指令 HMAC-SHA256 验签 `verifyOtaSignature`（msg=`id:version:url`，密钥宏 `OTA_SIGNING_SECRET`，与后端一致；留空则跳过仅告警）；② `Update.setMD5` 完整性校验（后端发32位 md5）；③ 安全回滚——成功置 NVS `pending_validate`，新固件 `setup()` 调 `Update.markAppValidNewPartition()` 提交，否则 Bootloader 自动回滚旧分区；④ 断点续传——下载中连接中断以 HTTP Range(`bytes=N-`) 从偏移续传（最多5次），NVS 存意图供重启后自动恢复（整包重下）；⑤ `Preferences("otaimg")` 持久化 OTA 意图 + loop() 自动恢复。
  - *后端补丁*：三个 OTA 推送 payload（自动/批量/单推）新增 `"id": firmware.id`（签名校验必备）；`sign_ota_command` 用 `f"{id}:{version}:{url}"`。
  - 灰度/分批 + 静默时段（上课/夜间窗口）已在后端 `ota_negotiation_service.py` 落地（P2 前期）。
- **运维必读**：自动推送依赖环境变量 `OTA_FIRMWARE_BASE_URL`（公网可直连的后端地址），未配置则 MQTT 自动推送中止（仅日志告警，不下发坏 URL）；`OTA_AUTO_PUSH_ENABLED`(默认true)/`OTA_PUSH_COOLDOWN_SEC`(600)/`OTA_ROLLOUT_JITTER_SEC`(30) 可调。
- **生产云端 Broker（EMQX Cloud）**：连接地址 `nc5233fc.ala.cn-hangzhou.emqxsl.cn:8883`（MQTT over TLS/SSL）；另见控制台地址 `c5233fc.ala.cn-hangzhou.emqxsl.cn`；WebSocket over TLS `8084`；设备凭据 `phoneboxtest/123456`；CA 证书有效期至 2031-11-10。后端 `config.py` 经 `MQTT_BROKER/MQTT_PORT/MQTT_SSL/MQTT_USERNAME/MQTT_PASSWORD` 接入。`verify_ota_e2e.py` 与 `test_ota_e2e_local_broker.py` 默认即对接该云端 Broker（TLS，insecure 跳过 CA；设 `MQTT_CA_CERT` 可严格校验）；pytest 全链路可用 `OTA_E2E_BROKER=127.0.0.1:1883 OTA_E2E_SSL=false` 切本地。
- **P3 已完成（2026-08-15）**：① `docker-compose.mqtt.yml` + `mosquitto/mosquitto.conf`：匿名 1883 + websockets 9001 的常驻本地 Broker（eclipse-mosquitto:2，含 healthcheck/nc 探测），仅作本地干净环境备选（生产用上方云端 Broker）。② `backend/scripts/verify_ota_e2e.py`：standalone OTA e2e（收发分离+SUBACK 诊断范式），默认对接云端 Broker，对接真实后端 HTTP（登录→ota-upgrade→轮询 ota-status）与模拟设备（HMAC 验签+状态回报闭环），env 驱动 broker。③ `backend/tests/test_ota_e2e_local_broker.py`：pytest 两层——确定性「签名契约」单测（TestOTASignatureContract：签名匹配/缺密钥空串/篡改拒绝，无需 broker，本机 3 passed）+ 全链路 e2e（TestOTAE2ELocalBroker：默认本地 127.0.0.1:1883 不可达则 skip；`OTA_E2E_BROKER=nc5233fc...:8883 OTA_E2E_SSL=true` 对真实云端 Broker 实跑 **4 passed**：publish→设备收包验签 + 设备→broker→后端订阅者返回链路 + 离线验证 `_process_critical_message` 把 status topic 路由到 `_process_ota_status`）。
- **P3 e2e 踩坑（已修）**：① 全链路桩初版用「monkeypatch `_process_ota_status` 捕获」失败——真实处理器在派发顺序里先于回调循环执行，测试上下文抛 DB 异常会中断；且管理器在 pytest 重连后控制连接收不到消息。改为：返回链路用独立「后端侧订阅者」(phonebox/ota/#) 在真实 Broker 上验证 device→broker→后端订阅者，再离线调用 `_process_critical_message` 验证路由。② `be_evt` 会被「指令 topic」抢先置位（`#` 订阅也匹配指令），必须专门等 status topic 出现。③ `phoneboxtest` 并发连接数有限，桩须把设备收/发合一（rec_c 既收指令又发状态），连接数压到 4（rec_c+be_c+manager 控制/遥测）。④ ACL 探针确认云端 Broker 对 `phonebox/ota/#` 订阅授予且能收到嵌套 `phonebox/ota/<id>/status`——返回链路断因是桩本身，非生产 ACL 问题。
- **本机约束**：无 docker / 无 mosquitto / amqtt 不稳 → 全链路 e2e 需在 Linux+docker 跑；pytest 签名契约层在任意环境可跑。
- 注：固件改动需在 Arduino IDE 实编+真机/本地 Broker 验证（本机无 ESP32 工具链，仅做了 C++ 逻辑审阅）；后端改动已 py_compile + 应用启动 + 路由冒烟通过。

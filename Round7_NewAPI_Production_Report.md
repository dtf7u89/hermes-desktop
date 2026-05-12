# Round7 New API 生产部署执行报告

生成时间：2026-05-12 15:28:10 CST

## 1. 本轮目标

按既定生产商业方案，将 VPS 后端路线从 Round6 mock 服务推进到 QuantumNous/new-api：

- New API 作为生产模型网关、额度、兑换码、充值、日志和管理后台基础。
- Hermes Desktop / U 盘客户端不保存真实上游模型 API Key。
- 客户端只连接 VPS：`base_url = https://<domain>/v1`，`api_key = 用户 New API token / 授权 token`。
- 保留 Round6 mock 服务用于回滚和对照，不破坏现有桌面端联调能力。

## 2. 方案文件

已写入方案文件：

```text
/home/seeone/hermes-desktop/Round7_NewAPI_Production_Plan.md
```

方案明确：

- 客户端源码继续使用 `/home/seeone/hermes-desktop`
- 生产后端使用 `https://github.com/QuantumNous/new-api`
- VPS 生产部署目录使用 `/opt/new-api`
- Round6 mock `/opt/hermes-round6-mock` 保留作为回滚
- 如 New API 原生接口不满足桌面端 `/api/license/status`、`/api/quota`，再新增轻量 adapter

## 3. VPS 部署结果

VPS：

```text
43.166.4.133
```

New API 部署目录：

```text
/opt/new-api
```

New API 访问地址：

```text
http://43.166.4.133:3001/
```

New API 状态接口：

```text
http://43.166.4.133:3001/api/status
```

已验证返回：

- Web 首页 HTTP 200
- `/api/status` HTTP 200
- 响应头包含 `X-New-Api-Version: v1.0.0-rc.4`

## 4. Docker Compose 服务

部署使用 Docker Compose。

服务清单：

```text
hermes-new-api           0.0.0.0:3001->3000/tcp
hermes-newapi-postgres   5432/tcp
hermes-newapi-redis      6379/tcp
```

容器状态：

```text
hermes-new-api           Up
hermes-newapi-postgres   Up / healthy
hermes-newapi-redis      Up
```

重启策略：

```text
restart: always
```

持久化：

- PostgreSQL volume：`pg_data`
- Redis volume：`redis_data`
- New API data/logs：`/opt/new-api/data`、`/opt/new-api/logs`

## 5. 配置文件

VPS 上创建：

```text
/opt/new-api/docker-compose.yml
/opt/new-api/.env
```

权限：

```text
chmod 600 docker-compose.yml
chmod 600 .env
```

`.env` 包含 PostgreSQL 密码、Redis 密码和 session secret。报告中全部脱敏：

```text
POSTGRES_PASSWORD=[REDACTED]
REDIS_PASSWORD=[REDACTED]
SESSION_SECRET=[REDACTED]
```

## 6. Round6 Mock 保留情况

Round6 mock 仍在运行，未被破坏：

```text
hermes-round6-mock   0.0.0.0:8096->8096/tcp   Up
```

Mock health 仍可访问：

```text
http://43.166.4.133:8096/health
```

验证结果：HTTP 200。

## 7. 当前 New API 可用状态

已完成：

- New API 镜像拉取
- PostgreSQL 启动并 healthy
- Redis 启动
- New API 启动
- Web 管理页面可访问
- `/api/status` 可访问
- Round6 mock 未受影响

尚未完成：

- 管理员首次初始化/登录
- 上游模型渠道配置
- 创建测试用户/token
- 验证 New API `/v1/chat/completions`
- 验证额度扣减
- 调研并对接 New API 余额/额度查询 API
- HTTPS / 域名配置

## 8. 安全处理

已执行：

- 未在报告中写入 VPS root 密码。
- 未写入 New API 数据库密码、Redis 密码、session secret。
- 未配置真实上游模型 API key，因此无上游 key 泄露风险。
- Round6 mock 和 New API 分端口部署，互不覆盖。

必须尽快执行：

- 轮换本次聊天中曾出现过的 VPS root 密码。
- 改用 SSH key 登录。
- 禁用 root 密码登录或至少限制来源 IP。
- 生产环境绑定域名并启用 HTTPS。

## 9. 运维命令

进入目录：

```bash
cd /opt/new-api
```

查看容器：

```bash
docker ps --filter name=hermes-new
```

查看日志：

```bash
docker logs -f hermes-new-api
```

重启：

```bash
cd /opt/new-api
docker compose restart
```

停止：

```bash
cd /opt/new-api
docker compose down
```

升级：

```bash
cd /opt/new-api
docker compose pull
docker compose up -d
```

## 10. 下一步建议

### Round7-B：New API 初始化与真实模型渠道配置

需要用户通过浏览器访问：

```text
http://43.166.4.133:3001/
```

完成：

1. 初始化管理员账号。
2. 登录后台。
3. 配置一个真实上游模型渠道，例如 DeepSeek、OpenRouter 或 OpenAI。
4. 创建测试用户。
5. 创建测试 token。
6. 设置测试额度。
7. 验证 New API `/v1/chat/completions`。

### Round7-C：Hermes Desktop 适配 New API 额度接口

需要调研 New API 的用户余额/额度 API 后决定：

- 桌面端直接改 `src/main/quota.ts` 对接 New API 原生 API；或
- 新建 `/opt/hermes-newapi-adapter`，保留现有桌面端 `/api/quota`、`/api/license/status` 协议。

## 11. 当前结论

Round7 基础部署已完成：

- 生产路线方案已保存为 MD。
- New API 已部署到 VPS `/opt/new-api`。
- Web 页面和状态接口可访问。
- PostgreSQL/Redis 已随 Docker Compose 启动。
- Round6 mock 服务保留且可用。

该环境目前是 **生产后端基础设施已启动**，但还不是最终生产可售状态。还需要完成管理员初始化、真实上游渠道、用户 token、额度扣减、HTTPS 和桌面端 Billing 适配。

# Round7 New API 生产部署与 Hermes Desktop 适配方案

## 0. 目标

按既定商业方案，将生产商业后端从 Round6 mock 服务升级为 **QuantumNous/new-api**：

- Hermes Desktop / USB 客户端不直连 OpenAI、Claude、OpenRouter、DeepSeek 等上游模型。
- Hermes Desktop 只连接用户自己的 VPS 网关。
- Hermes Desktop 模型配置为：

```yaml
model:
  provider: custom
  base_url: https://<your-domain>/v1
  api_key: <user-new-api-token-or-license-key>
```

- 真实上游模型 API Key 只存放在 VPS 的 New API 后台/环境中，不进入 U 盘或桌面客户端。
- New API 负责多模型分发、用户 API Key、token 统计、额度、兑换码、充值、日志和管理后台。
- Hermes Desktop 负责 License/Token 保存、Billing 展示、续费入口、模型配置自动化和打包交付。

## 1. 当前状态

已完成：

- Round3 License 页面与 `data/license.json`
- Round4 Billing / Quota 页面
- Round5 Model Config 自动化
- Round6 Model Proxy Test
- VPS Round6 mock 后端：`/opt/hermes-round6-mock`，端口 `8096`

注意：Round6 mock 仅用于联调，不能作为生产商业后端。

## 2. 生产源码选择

### 客户端源码

继续使用：

```text
/home/seeone/hermes-desktop
```

职责：

- 桌面 UI
- License / New API token 保存
- Billing / 额度展示
- Model Config 自动配置
- Model Proxy Test
- Windows / Portable 打包

### 生产后端源码

使用：

```text
https://github.com/QuantumNous/new-api
```

VPS 部署目录：

```text
/opt/new-api
```

### 可选适配层

如果 New API 原生接口不能直接满足桌面端现有 `/api/license/status`、`/api/quota`，再新增轻量 adapter：

```text
/opt/hermes-newapi-adapter
```

职责：

- `GET /api/license/status` → 转换/查询 New API token 状态
- `GET /api/quota` → 转换/查询 New API 用户余额/额度
- `POST /v1/chat/completions` → 反代 New API `/v1/chat/completions`

优先原则：能直接适配 New API 原生 API 就不加 adapter；若桌面端改动太大，则加 adapter 保持客户端稳定。

## 3. VPS 部署原则

- 不删除、不覆盖 `/opt/hermes-round6-mock`，保留回滚。
- New API 单独部署到 `/opt/new-api`。
- 优先使用 Docker Compose。
- 先用 IP + 端口验证；生产最终应绑定域名并启用 HTTPS。
- 不在报告、日志、代码中写入真实上游 API key、admin token、用户 token、密码。
- 所有敏感值统一写 `[REDACTED]`。

## 4. New API 生产能力

New API 负责：

- 多模型渠道配置
- OpenAI-compatible `/v1/chat/completions`
- 用户 token / API key
- token 统计
- 余额 / 额度
- 兑换码
- 充值
- 日志
- 管理后台

## 5. Hermes Desktop 适配策略

当前桌面端已经支持：

- 用户填写 `vps_base_url`
- 用户填写 `license_key`
- 自动设置：
  - `base_url = {vps_base_url}/v1`
  - `api_key = license_key`
- Billing 页面请求 quota
- Model Proxy Test 请求 `/v1/chat/completions`

生产方案中：

```text
license_key ≈ New API 用户 token / API key
vps_base_url ≈ New API 部署域名或 adapter 域名
```

## 6. Round7 执行步骤

1. 调研 New API 官方 Docker Compose 部署方式。
2. 在 VPS 创建 `/opt/new-api`。
3. 部署 New API，不影响 Round6 mock。
4. 启动 New API 管理后台。
5. 记录访问地址和默认初始化步骤。
6. 若可用，创建测试管理员、测试用户、测试 token。
7. 验证 `/v1/chat/completions` 基础连通性。
8. 调研额度/用户信息 API 是否能满足桌面端 Billing。
9. 判断是否需要 `/opt/hermes-newapi-adapter`。
10. 写入 Round7 执行报告。

## 7. 当前验收标准

本轮先完成 New API 部署基础，不要求立即接入真实上游 API key，除非用户明确提供测试上游 key。

必须完成：

- `/opt/new-api` 存在
- New API Docker 容器启动
- New API Web 管理页面可访问
- 不破坏 `/opt/hermes-round6-mock`
- 记录部署命令、端口、后续初始化步骤
- 写入 `Round7_NewAPI_Production_Report.md`

如果缺少域名、HTTPS 或真实上游 key，则在报告中列为待办，不阻塞本轮基础部署。

## 8. 后续生产化待办

- 配置域名，例如 `api.example.com`
- 配置 HTTPS
- 配置真实上游模型渠道：DeepSeek / OpenRouter / OpenAI / Anthropic 等
- 创建正式用户 token
- 确认 New API 余额查询接口
- 必要时开发 Hermes New API Adapter
- 将 Hermes Desktop 默认文案从 license_key 逐步转向“授权 Token / New API Token”
- Windows 打包 / Portable 验证

## 9. 安全要求

- 不输出真实 root 密码、API key、token、credential、connection string。
- New API 初始化密钥、管理员密码、上游 key 只写 VPS 文件或后台，不写报告。
- 报告中敏感字段统一写 `[REDACTED]`。
- 当前聊天中出现过的 VPS root 密码应在部署后尽快轮换。

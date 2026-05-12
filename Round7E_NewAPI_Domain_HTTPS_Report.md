# Round7-E New API 域名与 HTTPS 配置报告

生成时间：2026-05-12

## 1. 目标

为 VPS 上的 New API 生产网关配置域名与 HTTPS：

```text
apitokenhub.dpdns.org
```

目标生产 Base URL：

```text
https://apitokenhub.dpdns.org
```

## 2. DNS 验证

域名解析已生效：

```text
apitokenhub.dpdns.org -> 43.166.4.133
```

## 3. VPS 当前服务

New API 原服务：

```text
http://43.166.4.133:3001
```

Round6 mock 服务保留：

```text
http://43.166.4.133:8096
```

## 4. 反向代理方案

使用 Caddy 自动 HTTPS。

部署目录：

```text
/opt/new-api-caddy
```

Docker 容器：

```text
hermes-newapi-caddy
```

Caddyfile：

```caddyfile
apitokenhub.dpdns.org {
    encode gzip zstd
    reverse_proxy 127.0.0.1:3001
}
```

使用 `network_mode: host` 监听 80/443，并反代到本机 `127.0.0.1:3001`。

## 5. HTTPS 证书

Caddy 已自动向 Let's Encrypt 申请证书。

日志显示：

```text
certificate obtained successfully
identifier: apitokenhub.dpdns.org
issuer: acme-v02.api.letsencrypt.org-directory
```

## 6. 验证结果

### Web 首页

```text
GET https://apitokenhub.dpdns.org/
```

结果：HTTP 200。

### 状态接口

```text
GET https://apitokenhub.dpdns.org/api/status
```

结果：HTTP 200。

New API 版本：

```text
v1.0.0-rc.4
```

### 模型列表

```text
GET https://apitokenhub.dpdns.org/v1/models
Authorization: Bearer [REDACTED]
```

结果：成功返回模型列表，包含：

```text
gpt-5.5-fast
gpt-5.5
gpt-5.4-mini-fast
...
```

### Chat Completions

```text
POST https://apitokenhub.dpdns.org/v1/chat/completions
Authorization: Bearer [REDACTED]
Content-Type: application/json
```

测试模型：

```text
gpt-5.5-fast
```

结果：成功。

返回内容：

```text
Hermes domain OK
```

响应包含 OpenAI-compatible `usage.total_tokens`。

## 7. 桌面端填写方式

Hermes Desktop License 页面现在应填写：

```text
VPS URL:
https://apitokenhub.dpdns.org

License Key:
New API 用户 token
```

Model Proxy Test 区域：

```text
Test model:
gpt-5.5-fast
```

或留空并启用自动选择。

## 8. 运维命令

查看 Caddy：

```bash
cd /opt/new-api-caddy
docker-compose ps
docker logs -f hermes-newapi-caddy
```

重启 Caddy：

```bash
cd /opt/new-api-caddy
docker-compose restart
```

停止 Caddy：

```bash
cd /opt/new-api-caddy
docker-compose down
```

New API 本体：

```bash
cd /opt/new-api
docker-compose ps
docker logs -f hermes-new-api
```

## 9. 安全处理

- 报告未记录 New API token 原文。
- 未记录上游模型 API key。
- 未记录 VPS root 密码。
- HTTPS 已启用。

## 10. 风险点

1. 之前用于联调的 New API token 已在聊天中出现过，建议联调完成后删除或轮换。
2. VPS root 密码也曾在聊天中出现过，建议尽快改为 SSH key 登录并禁用密码登录。
3. 当前 `http://43.166.4.133:3001` 仍直接暴露，可考虑后续仅允许本机访问，公网只暴露 443。
4. 需要继续完成 Billing / 额度适配和支付闭环。

## 11. 当前结论

New API 域名与 HTTPS 已配置完成，生产模型网关可通过：

```text
https://apitokenhub.dpdns.org/v1
```

访问。

Hermes Desktop 的生产 `vps_base_url` 应切换为：

```text
https://apitokenhub.dpdns.org
```

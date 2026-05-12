# Round7-B New API 渠道与模型代理联调报告

生成时间：2026-05-12

## 1. 本轮目标

验证已初始化的 New API 生产后端是否能够作为 Hermes Desktop 的真实模型网关使用：

- 使用 New API 测试 token 调用 `/v1/models`
- 使用 New API 测试 token 调用 `/v1/chat/completions`
- 判断桌面端 Round6 默认模型 `default` 是否可直接使用
- 记录后续桌面端适配建议

## 2. 服务信息

New API Base URL：

```text
http://43.166.4.133:3001
```

New API 版本：

```text
v1.0.0-rc.4
```

测试 token：

```text
[REDACTED]
```

## 3. /v1/models 验证

请求：

```text
GET /v1/models
Authorization: Bearer [REDACTED]
```

结果：成功。

返回可用模型包含：

```text
gpt-5.5-fast
gpt-5.5
gpt-5.4-mini-fast
gpt-5.4-mini
gpt-5.2-fast
gpt-5.4
gpt-5.3-codex
...
```

说明：New API token 已可访问模型列表，模型渠道已生效。

## 4. /v1/chat/completions 验证

测试请求：

```json
{
  "model": "gpt-5.5-fast",
  "messages": [
    {
      "role": "user",
      "content": "Reply with exactly: Hermes New API OK"
    }
  ],
  "max_tokens": 32,
  "temperature": 0
}
```

请求头：

```text
Authorization: Bearer [REDACTED]
Content-Type: application/json
```

结果：成功。

返回内容：

```text
Hermes New API OK
```

成功验证的模型：

```text
gpt-5.5-fast
gpt-5.5
gpt-5.4-mini-fast
gpt-5.4-mini
gpt-5.2-fast
```

响应均为 OpenAI-compatible `chat.completion` 格式，并包含 `usage.total_tokens`。

## 5. 当前失败项

以下模型仍不可用：

```text
default
deepseek-chat
deepseek-reasoner
```

错误：

```text
model_not_found
No available channel for model <model> under group vip
```

说明：New API 目前没有为 `vip` 分组配置这些模型名。

## 6. 对 Hermes Desktop 的影响

当前 Hermes Desktop Round6 `testModelProxy()` 默认请求：

```json
{
  "model": "default"
}
```

但 New API 当前不支持 `default`，所以桌面端 Test Model Proxy 如果直接连 New API 会失败。

## 7. 建议修复方案

### 方案 A：New API 后台增加 `default` 模型映射

在 New API 后台为 `vip` 分组增加模型名：

```text
default
```

并映射/指向实际可用模型，例如：

```text
gpt-5.5-fast
```

优点：桌面端无需改代码。

### 方案 B：桌面端支持可配置测试模型

修改 Hermes Desktop：

- 在 License / Model Gateway 区域增加 `test_model` 配置
- 默认值可设为 `gpt-5.5-fast` 或从 New API `/v1/models` 获取第一个可用模型
- `src/main/model-proxy-test.ts` 不再硬编码 `default`

优点：更适合生产，支持多渠道/多模型。

推荐：短期使用方案 A 快速打通；生产版做方案 B。

## 8. Billing / 额度下一步

New API 已返回 `usage.total_tokens` 并可记录请求日志，但 Hermes Desktop 当前 Billing 请求：

```text
GET {vps_base_url}/api/quota
```

New API 原生不一定提供同名接口。

下一步需要：

1. 调研 New API 用户余额/额度接口。
2. 如果可直接读取，则修改 `src/main/quota.ts` 兼容 New API。
3. 如果不能直接读取，新增轻量 adapter：

```text
/opt/hermes-newapi-adapter
```

提供：

```text
GET /api/license/status
GET /api/quota
POST /v1/chat/completions
```

## 9. 安全处理

- 测试 token 已在报告中脱敏为 `[REDACTED]`。
- 没有写入真实上游模型 API key。
- curl 输出已做 token 脱敏。
- 建议联调完成后轮换或删除本次测试 token。

## 10. 当前结论

New API 模型代理主链路已可用：

```text
Hermes Desktop / client token -> New API /v1/chat/completions -> 上游模型 -> OpenAI-compatible response
```

当前 blocker 不是 New API 服务，而是 Hermes Desktop 默认使用 `model: default`。需要在 New API 后台添加 `default` 映射，或在 Hermes Desktop 中加入测试模型配置。

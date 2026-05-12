# Round7-B New API 初始化后配置与桌面端联调任务

## 0. 当前状态

New API 已部署并完成首次管理员初始化。

访问地址：

```text
http://43.166.4.133:3001/
```

状态接口：

```text
http://43.166.4.133:3001/api/status
```

已验证：

- Web 首页 HTTP 200
- `/api/status` HTTP 200
- New API 版本：`v1.0.0-rc.4`

Round6 mock 仍保留：

```text
http://43.166.4.133:8096/
```

## 1. 本轮目标

将 New API 从“已部署”推进到“可用于 Hermes Desktop 真实联调”：

1. 在 New API 后台配置至少一个真实上游模型渠道。
2. 创建测试用户或测试 token。
3. 为测试 token 分配额度。
4. 验证 New API OpenAI-compatible 接口：
   - `POST http://43.166.4.133:3001/v1/chat/completions`
5. 用该 token 作为 Hermes Desktop 的 `license_key`。
6. 验证 Hermes Desktop Round5/Round6：
   - Model Config 应用到 `{vps_base_url}/v1`
   - Test Model Proxy 成功
7. 调研 New API 余额/额度接口，决定 Billing 页面下一步适配方式。

## 2. 需要用户准备的信息

如果要完成真实模型请求，必须在 New API 后台配置一个上游渠道。

推荐选择之一：

- DeepSeek
- OpenRouter
- OpenAI
- Anthropic Claude via compatible gateway
- 自建 OpenAI-compatible vLLM

敏感值处理规则：

- 不要把真实上游 API Key 写入报告。
- 不要把真实上游 API Key 发给第三方模型。
- 最安全方式：用户自己在 New API Web 后台填写上游 API Key。
- 报告中统一写 `[REDACTED]`。

## 3. New API 后台配置步骤

请在浏览器打开：

```text
http://43.166.4.133:3001/
```

登录管理员账号后执行：

1. 进入渠道/模型渠道管理。
2. 新增一个渠道。
3. 填写上游供应商 base URL 和 API Key。
4. 配置可用模型名称，例如：
   - `deepseek-chat`
   - `gpt-4o-mini`
   - `openrouter/auto`
5. 保存并测试渠道。
6. 创建普通测试用户或直接创建测试 token。
7. 给测试 token 分配额度。
8. 记录：
   - New API Base URL：`http://43.166.4.133:3001`
   - 测试 token：只保存在本地/后台，不写报告原文
   - 可用模型名

## 4. New API /v1/chat/completions 验证命令

在本地或 VPS 上验证：

```bash
curl -sS http://43.166.4.133:3001/v1/chat/completions \
  -H 'Authorization: Bearer [REDACTED]' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "deepseek-chat",
    "messages": [
      {"role": "user", "content": "Reply with exactly: Hermes New API OK"}
    ],
    "max_tokens": 32,
    "temperature": 0
  }'
```

成功标准：

- HTTP 200
- 返回 OpenAI-compatible response
- `choices[0].message.content` 有内容
- New API 后台日志能看到调用记录
- 额度/余额发生扣减或用量记录增加

## 5. Hermes Desktop 联调填写方式

License 页面填写：

```text
VPS URL:
http://43.166.4.133:3001

License Key:
<New API 测试 token>
```

然后测试：

1. 保存 License。
2. Apply Model Config。
3. Test Model Proxy。

预期：

```text
POST http://43.166.4.133:3001/v1/chat/completions
Authorization: Bearer [REDACTED]
```

返回成功结果。

## 6. 当前桌面端 Billing 适配注意

现有 Round4 Billing 默认请求：

```text
GET {vps_base_url}/api/quota
```

New API 原生余额/额度接口可能不是 `/api/quota`。

因此本轮需要调研 New API 是否有可用接口，例如：

- 用户自身信息 API
- token 详情 API
- quota / amount / used_quota 字段
- dashboard / usage 统计 API

根据调研结果选择：

### 方案 A：直接改桌面端 `src/main/quota.ts`

优点：少一层服务。

缺点：桌面端绑定 New API 原生接口。

### 方案 B：新增轻量 Adapter

部署：

```text
/opt/hermes-newapi-adapter
```

对桌面端保持：

```text
GET /api/license/status
GET /api/quota
POST /v1/chat/completions
```

内部转发/查询 New API。

优点：桌面端协议稳定，后续可替换后端。

推荐优先 B，除非 New API 原生接口刚好完全满足桌面端。

## 7. 验收标准

- New API 至少配置一个真实上游渠道。
- 创建测试 token。
- `POST /v1/chat/completions` 使用测试 token 成功。
- New API 后台日志可见请求。
- 额度/用量有记录。
- Hermes Desktop `Test Model Proxy` 可连通 New API。
- 明确 Billing 下一步适配方案：直接适配或 adapter。
- 写入 `Round7B_NewAPI_Channel_Desktop_Link_Report.md`。

## 8. 安全要求

- 不在任何报告中写真实 token / API key。
- 不在聊天中发送生产上游 API key。
- 若需要我执行 curl，请只提供测试 token，且建议之后轮换。
- VPS root 密码已在聊天中出现过，建议尽快轮换并改 SSH key 登录。

# Round7-C 方案 B：Hermes Desktop 可配置 New API 测试模型实施报告

生成时间：2026-05-12

## 1. 背景

Round7-B 已验证 New API 生产模型代理链路可用，但 Hermes Desktop Round6 的模型代理测试硬编码：

```json
{
  "model": "default"
}
```

当前 New API 可用模型包括：

```text
gpt-5.5-fast
gpt-5.5
gpt-5.4-mini-fast
gpt-5.4-mini
gpt-5.2-fast
```

而 `default` 不存在，因此选择生产更好的方案 B：让桌面端支持可配置测试模型，并支持留空时自动读取 `/v1/models` 选择第一个可用模型。

## 2. 修改文件

- `src/main/model-proxy-test.ts`
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`
- `src/renderer/src/screens/License/License.tsx`
- `src/shared/i18n/locales/en/model-proxy.ts`
- `src/shared/i18n/locales/zh-CN/model-proxy.ts`
- `src/shared/i18n/locales/es/model-proxy.ts`
- `src/shared/i18n/locales/pt-BR/model-proxy.ts`
- `tests/model-proxy-test.test.ts`

## 3. TDD 记录

先新增失败测试：

1. `uses the provided test model instead of hardcoded default`
2. `auto-selects the first /v1/models model when requested model is blank`

初次运行：

```bash
npm test -- tests/model-proxy-test.test.ts
```

结果：按预期失败。

失败原因：

- 请求体仍使用 `model: default`
- 没有请求 `/v1/models`

随后实现生产代码，再次运行后通过。

## 4. 主进程能力

`testModelProxy()` 新增 options：

```ts
export interface ModelProxyTestOptions {
  model?: string;
  autoSelectModel?: boolean;
}
```

调用方式：

```ts
testModelProxy({
  model: "gpt-5.5-fast",
  autoSelectModel: true,
});
```

行为：

- 如果 `model` 非空，直接使用该模型。
- 如果 `model` 为空且 `autoSelectModel: true`，先请求：

```text
GET {vps_base_url}/v1/models
```

选择 `data[0].id` 作为测试模型，再请求：

```text
POST {vps_base_url}/v1/chat/completions
```

- 如果自动选择失败，则回退到 `default`，保持兼容旧 mock。

## 5. IPC / Preload

IPC：

```text
model-proxy:test
```

现在支持传参：

```ts
ipcRenderer.invoke("model-proxy:test", {
  model: "gpt-5.5-fast",
  autoSelectModel: true,
});
```

Preload：

```ts
testModelProxy(options?: {
  model?: string;
  autoSelectModel?: boolean;
})
```

## 6. UI 入口

License 页面 Model Proxy Test 区域新增：

- Test model 输入框
- 默认值：`gpt-5.5-fast`
- Auto-select first available model when blank 复选框

用户可在生产 New API 中填写实际可用模型，例如：

```text
gpt-5.5-fast
```

或留空并启用自动选择。

## 7. i18n

已覆盖：

- `en`
- `zh-CN`
- `es`
- `pt-BR`

新增 key：

```text
modelProxy.testModel
modelProxy.testModelHint
modelProxy.autoSelectModel
```

## 8. 安全处理

- `license_key` / New API token 仍只通过 Authorization header 发送。
- 不放 query 参数。
- 报告中 token 统一写 `[REDACTED]`。
- `/v1/models` 请求同样使用 Authorization header。
- Renderer 只收到受控结果，不暴露原始 token。

## 9. 测试结果

### 单测

```bash
npm test -- tests/model-proxy-test.test.ts
```

结果：

```text
Test Files  1 passed
Tests       34 passed
```

### 完整测试

```bash
npm test
```

结果：

```text
Test Files  14 passed
Tests       328 passed
```

### 构建

```bash
npm run build
```

结果：通过。

关键输出：

```text
out/main/index.js 334.86 kB
out/preload/index.js 13.31 kB
✓ 2905 modules transformed.
✓ built in 3.31s
```

## 10. New API 实测

使用 New API 测试 token `[REDACTED]` 和模型：

```text
gpt-5.5-fast
```

请求：

```text
POST http://43.166.4.133:3001/v1/chat/completions
```

结果：成功。

返回内容：

```text
Hermes production model config OK
```

响应包含 OpenAI-compatible `usage.total_tokens`。

## 11. 当前结论

方案 B 已完成：Hermes Desktop 不再被 `default` 模型名卡住，生产 New API 可以使用实际模型名进行模型代理测试。

当前生产链路状态：

```text
Hermes Desktop License 页面
→ New API token
→ 可配置测试模型 gpt-5.5-fast
→ New API /v1/chat/completions
→ 上游模型
→ OpenAI-compatible response
```

已打通。

## 12. 下一步建议

继续 Round7-D：New API Billing / 额度适配。

目标：让 Hermes Desktop Billing 页面不要再依赖 mock `/api/quota`，而是适配 New API 的真实用户额度/余额接口；若 New API 原生接口不适合客户端直连，则部署轻量 adapter。

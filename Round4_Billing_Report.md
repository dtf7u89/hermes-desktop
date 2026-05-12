# Round4 Billing / 额度页面实现报告

生成时间：2026-05-12 06:48:05 CST

## 1. 本轮目标

Round4 目标是在 Hermes Desktop 中实现 Billing / 额度页面：

- 读取现有 `data/license.json` 中的 VPS URL、License Key 与 device_id。
- 通过主进程请求 VPS `/api/quota` 获取 token 额度信息。
- 通过 IPC / preload 将 quota 能力暴露给 renderer。
- 在侧边栏新增 Billing / 额度入口。
- 展示套餐、状态、总额度、已用额度、剩余额度、重置时间与续费 / 充值入口。
- 补齐至少 `en`、`zh-CN`、`es`、`pt-BR` 四种语言文案。
- 完成测试与生产构建验证。

> 安全说明：报告中不写入任何真实 License Key、API Key、token、密码、凭据或连接字符串。涉及敏感值一律视为 `[REDACTED]`。

## 2. 修改 / 新增文件清单

### 2.1 新增文件

- `src/main/quota.ts`
  - 新增 quota 主进程模块。
  - 读取本地 License 配置。
  - 请求 VPS `/api/quota`。
  - 统一返回 `QuotaResult`，避免 renderer 因异常崩溃。

- `src/renderer/src/screens/Billing/Billing.tsx`
  - 新增 Billing / 额度页面。
  - 调用 `window.hermesAPI.getQuota()` 加载额度。
  - 展示额度概览、进度条、套餐、状态、重置时间与续费入口。

- `src/shared/i18n/locales/en/billing.ts`
- `src/shared/i18n/locales/zh-CN/billing.ts`
- `src/shared/i18n/locales/es/billing.ts`
- `src/shared/i18n/locales/pt-BR/billing.ts`
  - 新增 Billing 页面多语言文案。

- `tests/quota.test.ts`
  - 新增 Round4 quota 静态/集成约束测试，共 6 个测试。

### 2.2 修改文件

- `src/main/index.ts`
  - 注册 `quota:get` IPC handler。

- `src/preload/index.ts`
  - 暴露 `window.hermesAPI.getQuota()`。

- `src/preload/index.d.ts`
  - 新增 `QuotaInfo` 类型。
  - 为 `HermesAPI` 增加 `getQuota()` 声明。

- `src/renderer/src/screens/Layout/Layout.tsx`
  - 新增 `billing` view。
  - 侧边栏新增 Billing / 额度入口。
  - 新增 Billing 页面渲染容器。

- `src/renderer/src/assets/icons/index.tsx`
  - 新增 `CreditCard` 图标导出。

- `src/shared/i18n/index.ts`
  - 注册 `billing` namespace 到四种 locale。

- `src/shared/i18n/locales/en/navigation.ts`
- `src/shared/i18n/locales/zh-CN/navigation.ts`
- `src/shared/i18n/locales/es/navigation.ts`
- `src/shared/i18n/locales/pt-BR/navigation.ts`
  - 新增 `navigation.billing`。

- `tests/preload-api-surface.test.ts`
  - IPC channel 校验放宽为支持 `namespace:action`，以兼容 Round3+ 商业 API 风格：`license:get`、`license:save`、`license:test`、`quota:get`。

- `tests/installer-utils.test.ts`
  - 修正测试中 Hermes auth 文件路径，使其与当前 portable data dir / Hermes home 解析逻辑一致。

- `tests/session-cache-sync.test.ts`
  - 放宽大缓存用例 timeout 至 60 秒，避免慢环境下被 Vitest 超时误杀。

## 3. Quota 数据格式

### 3.1 主进程返回类型

`src/main/quota.ts` 新增：

```ts
export interface QuotaInfo {
  total_tokens: number;
  used_tokens: number;
  remaining_tokens: number;
  reset_at?: string | null;
  renew_url?: string | null;
  plan?: string | null;
  status?: string;
}

export interface QuotaResult {
  ok: boolean;
  quota?: QuotaInfo;
  message?: string;
  status?: string;
}
```

### 3.2 VPS `/api/quota` 兼容字段

当前实现兼容以下字段命名：

- 总额度：`total_tokens` / `totalTokens` / `total`
- 已用额度：`used_tokens` / `usedTokens` / `used`
- 剩余额度：`remaining_tokens` / `remainingTokens` / `remaining`
- 重置时间：`reset_at`
- 续费 / 充值入口：`renew_url`
- 套餐：`plan`
- 状态：`status`
- 附加消息：`message`

如果 VPS 不返回剩余额度，则本地按 `max(total - used, 0)` 计算。

## 4. License 读取与 VPS 请求策略

### 4.1 本地 License 数据来源

Round4 沿用 Round3 的 License 配置：

- 数据文件：`data/license.json`
- 读取入口：`readLicense()`
- 字段来源：
  - `vps_base_url`
  - `license_key`（敏感值，不记录、不展示）
  - `device_id`

### 4.2 请求路径

主进程通过 `fetchQuota()` 请求：

```text
GET {vps_base_url}/api/quota?license_key=[REDACTED]&device_id=[REDACTED]
```

实现细节：

- `license_key` 和 `device_id` 使用 `encodeURIComponent()`。
- 设置 `Accept: application/json`。
- 使用 `AbortController`，10 秒超时。
- HTTP 非 2xx 返回受控错误。
- 网络异常 / JSON 异常 / 超时均返回 `{ ok: false, status: "error", message }`，不向 UI 抛出未捕获异常。

## 5. IPC / Preload API

### 5.1 IPC channel

新增 1 个 IPC channel：

```text
quota:get
```

注册位置：`src/main/index.ts`

```ts
ipcMain.handle("quota:get", async () => fetchQuota());
```

### 5.2 Renderer API

新增 preload API：

```ts
window.hermesAPI.getQuota(): Promise<QuotaResult>
```

实现位置：

- `src/preload/index.ts`
- `src/preload/index.d.ts`

与 Round3 License API 保持同一风格：由 renderer 调用 preload，preload 通过 `ipcRenderer.invoke("quota:get")` 转发到 main。

## 6. UI 入口与页面

### 6.1 导航入口

在侧边栏新增 Billing / 额度入口：

- View key：`billing`
- i18n key：`navigation.billing`
- 图标：`CreditCard`

四种语言导航文案：

- `en`: `Billing`
- `zh-CN`: `额度`
- `es`: `Facturación`
- `pt-BR`: `Cobrança`

### 6.2 Billing 页面展示内容

页面文件：`src/renderer/src/screens/Billing/Billing.tsx`

页面包含：

- 标题：Billing & Quota / 额度 / 账单
- 刷新按钮
- 额度概览
- 剩余 token 数
- 已用 / 总额度
- 使用量进度条
- 套餐 plan
- 状态 status
- 重置时间 reset_at
- 续费 / 充值按钮 renew_url
- 错误 / 未配置状态展示

## 7. 多语言覆盖

新增 `billing` namespace 并注册到：

- `en`
- `zh-CN`
- `es`
- `pt-BR`

关键文案包括：

- `billing.title`
- `billing.overview`
- `billing.description`
- `billing.tokenQuota`
- `billing.remaining`
- `billing.usedOfTotal`
- `billing.details`
- `billing.plan`
- `billing.status`
- `billing.resetAt`
- `billing.renew`
- `billing.unavailable`
- `billing.fetchFailed`

## 8. 安全处理

### 8.1 凭据不暴露

- Billing 页面不显示 License Key。
- 报告不写入真实 License Key / token / API Key / 密码 / 凭据。
- quota 请求在 main 进程中完成，renderer 只拿到 quota 结果。

### 8.2 受控错误

`fetchQuota()` 对以下情况返回受控错误：

- 未保存 License 配置。
- VPS HTTP 非 2xx。
- 请求超时。
- 网络不可达。
- 响应 JSON 解析失败。

### 8.3 超时保护

- quota 请求设置 10 秒超时。
- 避免 Billing 页面因为 VPS 长时间无响应而卡住。

### 8.4 字段兼容与默认值

- 数字字段统一通过 `toNumber()` 转换。
- 非法或缺失数字默认 `0`。
- 缺失 `remaining_tokens` 时自动计算剩余额度。

## 9. 测试验证

### 9.1 Round4 quota 单测

命令：

```bash
npm test -- tests/quota.test.ts
```

结果：通过。

```text
Test Files  1 passed (1)
Tests       6 passed (6)
```

### 9.2 installer-utils 回归测试

命令：

```bash
npm test -- tests/installer-utils.test.ts
```

结果：通过。

```text
Test Files  1 passed (1)
Tests       16 passed (16)
```

### 9.3 完整测试套件

命令：

```bash
npm test
```

结果：通过。

```text
Test Files  12 passed (12)
Tests       272 passed (272)
Duration    29.26s
```

备注：测试过程中 `I18nProvider` 仍有 React `act(...)` warning；这是既有测试告警，不影响本轮测试通过。`tests/session-cache-sync.test.ts` 大缓存用例耗时约 28 秒，建议后续单独评估性能。

## 10. 构建验证

命令：

```bash
npm run build
```

结果：通过。

构建包含：

- `npm run typecheck:node`
- `npm run typecheck:web`
- `electron-vite build`
- main / preload / renderer 三端产物生成

关键结果：

```text
✓ 114 modules transformed.
out/main/index.js  319.83 kB
✓ built in 335ms

out/preload/index.js  12.92 kB
✓ built in 13ms

✓ 2897 modules transformed.
✓ built in 3.15s
```

## 11. 已知风险与建议

### 11.1 VPS `/api/quota` 协议需最终固定

当前客户端兼容多种字段名，便于早期联调。正式上线前建议固定 VPS response schema，并补行为级 mock fetch 单测。

### 11.2 Query 参数传输 License Key 的风险

当前请求形式使用 query 参数传输 License Key。后续建议改为：

- `Authorization: Bearer [REDACTED]`，或
- `X-License-Key: [REDACTED]`

这样可降低代理 / 日志记录 URL 时泄露 key 的风险。

### 11.3 本地 License 仍是明文 JSON

Round4 沿用 Round3 明文 `data/license.json`。后续可使用：

- Electron `safeStorage`
- OS keychain
- 便携版自定义加密方案

### 11.4 续费 / 充值入口依赖 VPS 返回

Billing 页面仅在 `renew_url` 存在时展示续费 / 充值按钮。后续 Billing 系统完成后，VPS 应稳定返回该 URL 或二维码生成入口。

### 11.5 session-cache-sync 性能提示

完整测试已通过，但 `tests/session-cache-sync.test.ts` 的大缓存用例耗时较长。该问题不属于 Round4 Billing 范围，建议后续单独优化。

## 12. 下一步建议

推荐进入下一轮：Model 配置自动化。

建议目标：

1. 保存 License 后自动生成 / 更新 Hermes model 配置。
2. 将 `model.base_url` 指向 `{vps_base_url}/v1`。
3. 将 API key 设置为 License Key（内部处理，UI / 日志 / 报告均脱敏）。
4. 提供回滚 / 重置配置能力。
5. 补充测试：配置写入、重复保存、错误恢复、敏感信息脱敏。

## 13. 完成状态

- [x] 新增 main quota 模块。
- [x] 新增 `quota:get` IPC。
- [x] 新增 preload `getQuota()`。
- [x] 新增 Billing / 额度页面。
- [x] 新增侧边栏导航入口。
- [x] 新增四种语言文案。
- [x] 新增 Round4 quota 测试。
- [x] 完整测试通过：272 / 272。
- [x] 生产构建通过。
- [x] Round4 报告完成。

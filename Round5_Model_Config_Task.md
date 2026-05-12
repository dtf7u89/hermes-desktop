# Round5 Model Config 自动化任务

## 0. 背景

当前项目路径：

```text
/home/seeone/hermes-desktop
```

已完成前几轮：

- Round2：Portable paths / 便携路径
- Round3：License 页面与 `data/license.json`
- Round4：Billing / 额度页面，读取 `data/license.json` 后请求 VPS `/api/quota`

相关报告：

- `Round3_License_Report.md`
- `Round4_Billing_Report.md`

当前已存在能力：

- 本地 license 数据：`data/license.json`
- License 主进程模块：`src/main/license.ts`
- Quota 主进程模块：`src/main/quota.ts`
- License IPC：`license:get`、`license:save`、`license:clear`、`license:test`
- Quota IPC：`quota:get`
- License UI：`src/renderer/src/screens/License/License.tsx`
- Billing UI：`src/renderer/src/screens/Billing/Billing.tsx`

本轮目标是让商业授权真正驱动 Hermes 模型调用配置。

---

## 1. Round5 目标

实现“Model Config 自动化”：

当用户保存 License 后，可以将 Hermes 模型配置自动切换到用户 VPS 代理：

```text
model.base_url = {vps_base_url}/v1
model.api_key  = license_key
```

要求：

1. 从现有 `data/license.json` 读取 `license_key`、`vps_base_url`、`device_id`。
2. 生成 Hermes 模型代理配置。
3. 不在 UI、日志、测试快照、报告中泄露真实 `license_key`。
4. 提供 IPC / preload API 供 renderer 调用。
5. 在 License 页面或新增设置区域中提供：
   - 应用模型配置
   - 查看当前模型配置状态
   - 重置 / 清除商业模型配置
6. 完成测试、构建验证。
7. 写入 `Round5_Model_Config_Report.md`。

---

## 2. 强制安全规则

绝对不要输出、记录、提交任何真实敏感值：

- API Key
- License Key
- token
- password
- credential
- connection string
- auth.json 中的凭据

如果报告、日志、UI 或测试说明中需要展示敏感字段，一律使用：

```text
[REDACTED]
```

尤其注意：

- `license_key` 只能作为内部配置值写入配置文件或通过主进程处理。
- UI 只能展示脱敏值，例如 `sk-****abcd`，或直接显示“已配置”。
- 测试 fixture 中如果需要 key，使用明显假值，例如 `test-license-key`，但报告仍不要写真实 key。

---

## 3. 推荐实现范围

### 3.1 新增主进程模块

建议新增：

```text
src/main/model-config.ts
```

职责：

- 读取 License：复用 `readLicense()`。
- 构造目标配置：
  - `base_url = ${vps_base_url}/v1`
  - `api_key = license_key`
- 写入 Hermes Desktop 使用的 Hermes 配置位置。
- 返回受控结果，不向 renderer 抛未捕获异常。
- 提供脱敏状态查询。

建议导出类型：

```ts
export interface ModelConfigStatus {
  configured: boolean;
  base_url?: string;
  api_key_masked?: string;
  source?: "license" | "manual" | "unknown";
  message?: string;
}

export interface ModelConfigResult {
  ok: boolean;
  status?: ModelConfigStatus;
  message?: string;
}
```

建议导出函数：

```ts
export async function getModelConfigStatus(): Promise<ModelConfigResult>;
export async function applyLicenseModelConfig(): Promise<ModelConfigResult>;
export async function resetLicenseModelConfig(): Promise<ModelConfigResult>;
```

> 注意：具体 Hermes 配置文件路径必须先在代码中确认，不要猜。优先搜索现有 Hermes config / model / provider / base_url / api_key 相关代码。

---

### 3.2 IPC channels

新增 namespace:action 风格 IPC：

```text
model-config:get
model-config:apply
model-config:reset
```

在 `src/main/index.ts` 注册：

```ts
ipcMain.handle("model-config:get", async () => getModelConfigStatus());
ipcMain.handle("model-config:apply", async () => applyLicenseModelConfig());
ipcMain.handle("model-config:reset", async () => resetLicenseModelConfig());
```

---

### 3.3 Preload API

在 `src/preload/index.ts` 暴露：

```ts
getModelConfigStatus(): Promise<ModelConfigResult>;
applyLicenseModelConfig(): Promise<ModelConfigResult>;
resetLicenseModelConfig(): Promise<ModelConfigResult>;
```

并在 `src/preload/index.d.ts` 中补齐类型。

---

### 3.4 Renderer UI

优先方案：直接增强现有 License 页面：

```text
src/renderer/src/screens/License/License.tsx
```

新增一个 section，例如：

```text
Model Gateway / 模型网关配置
```

展示：

- 当前是否已应用商业模型配置
- 当前 `base_url`，例如 `https://example.com/v1`
- API key 状态：只显示“已配置”或脱敏字符串，不显示原文
- 按钮：
  - “应用模型配置”
  - “重置模型配置”
  - “刷新状态”

如果缺少 License：

- 显示受控提示：请先保存 License。
- 禁用“应用模型配置”按钮或点击后返回友好错误。

---

### 3.5 i18n

至少覆盖现有 locale：

- `en`
- `zh-CN`
- `es`
- `pt-BR`

可以新增 `modelConfig` namespace，或放入现有 `license` namespace。推荐新增独立 namespace：

```text
src/shared/i18n/locales/en/model-config.ts
src/shared/i18n/locales/zh-CN/model-config.ts
src/shared/i18n/locales/es/model-config.ts
src/shared/i18n/locales/pt-BR/model-config.ts
```

并在 `src/shared/i18n/index.ts` 注册。

建议 key：

```ts
modelConfig: {
  title: "Model Gateway",
  description: "Use the saved license to route Hermes model calls through your VPS.",
  status: "Status",
  configured: "Configured",
  notConfigured: "Not configured",
  baseUrl: "Base URL",
  apiKey: "API key",
  apiKeyConfigured: "Configured ([REDACTED])",
  apply: "Apply model config",
  reset: "Reset model config",
  refresh: "Refresh status",
  missingLicense: "Save a license before applying model config.",
  applySuccess: "Model config applied.",
  resetSuccess: "Model config reset.",
  failed: "Model config operation failed."
}
```

---

## 4. 配置写入策略要求

### 4.1 必须先调查现有配置路径

实现前先搜索：

```bash
model.base_url
base_url
api_key
provider
config.yaml
HERMES_HOME
HERMES_DESKTOP_DATA_DIR
portable
```

重点文件可能包括：

- `src/main/hermes.ts`
- `src/main/installer.ts`
- `src/main/portable-paths.ts`
- `src/main/constants.ts`
- `src/main/config*`
- 任何读取 / 写入 Hermes config 的模块

### 4.2 不要破坏用户现有配置

要求：

- 写入前尽量读取原配置。
- 只修改本轮需要的模型相关字段。
- 其他配置保持原样。
- 如果 reset，需要只清除或恢复本功能写入的字段，不要误删用户其他配置。

建议在配置中加一个来源标记（如果项目配置结构允许）：

```yaml
commercial:
  model_config_source: license
```

或使用独立 marker 文件记录本功能是否应用过配置。

如果现有配置结构不适合新增字段，请在报告中说明采取的替代策略。

### 4.3 URL 规范化

保存模型配置时：

- `vps_base_url` 去除末尾 `/`
- `base_url` 统一为 `${vps_base_url}/v1`
- 不要生成 `//v1`

### 4.4 敏感值脱敏

新增工具函数，例如：

```ts
function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "[REDACTED]";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
```

UI / 报告 / 错误消息只允许使用脱敏值或 `[REDACTED]`。

---

## 5. 测试要求：必须 TDD

必须先写失败测试，再实现功能。

建议新增：

```text
tests/model-config.test.ts
```

至少覆盖：

1. **缺少 License 时 apply 返回受控错误**
   - 不抛异常
   - `ok: false`
   - status/message 可读

2. **有 License 时生成正确 base_url**
   - 输入 `https://api.example.com`
   - 输出或写入 `https://api.example.com/v1`

3. **vps_base_url 末尾 slash 处理**
   - 输入 `https://api.example.com/`
   - 输出 `https://api.example.com/v1`

4. **api_key 不泄露到 status/message**
   - 任何返回给 renderer 的 message/status 不能包含原始 license key。

5. **IPC 注册完整**
   - `model-config:get`
   - `model-config:apply`
   - `model-config:reset`

6. **preload API 完整**
   - `getModelConfigStatus`
   - `applyLicenseModelConfig`
   - `resetLicenseModelConfig`

7. **UI 接入完整**
   - License 页面包含 model config section
   - 包含 apply/reset/refresh 操作入口

8. **i18n 完整**
   - 四种语言均注册 modelConfig namespace 或 license 中相应 keys。

运行顺序：

```bash
npm test -- tests/model-config.test.ts
npm test
npm run build
```

最终必须全绿或明确记录非本轮问题。但优先修到全绿。

---

## 6. 验收标准

本轮完成时必须满足：

- [ ] 新增 Model Config 主进程逻辑。
- [ ] 新增 `model-config:get` IPC。
- [ ] 新增 `model-config:apply` IPC。
- [ ] 新增 `model-config:reset` IPC。
- [ ] preload 暴露三项 API。
- [ ] `index.d.ts` 类型完整。
- [ ] License UI 可查看 / 应用 / 重置模型配置。
- [ ] 四种语言文案完整。
- [ ] 不泄露真实 license key。
- [ ] 缺少 license、坏配置、写入失败均返回受控错误。
- [ ] `npm test -- tests/model-config.test.ts` 通过。
- [ ] `npm test` 通过。
- [ ] `npm run build` 通过。
- [ ] 写入 `Round5_Model_Config_Report.md`。

---

## 7. Round5 报告要求

最终写入：

```text
/home/seeone/hermes-desktop/Round5_Model_Config_Report.md
```

报告必须包含：

1. 修改文件清单。
2. Model config 数据格式。
3. 目标配置路径与写入策略。
4. IPC API 说明。
5. Preload API 说明。
6. UI 入口说明。
7. i18n 覆盖说明。
8. 安全处理：
   - License Key 脱敏
   - 不写日志
   - 错误消息不含敏感值
   - reset 不误删用户其他配置
9. 测试结果：
   - `npm test -- tests/model-config.test.ts`
   - `npm test`
10. 构建结果：
   - `npm run build`
11. 风险点。
12. 下一步建议。

报告中所有敏感值必须写为 `[REDACTED]`。

---

## 8. 推荐下一轮方向

Round5 完成后，建议 Round6 做：

```text
VPS 后端联调 / 模型代理真实请求验证
```

可能包括：

- 验证 `/v1/chat/completions` 代理可用。
- license 过期 / 额度不足时模型请求返回友好错误。
- Billing 页面可实时刷新额度。
- 充值后额度更新。
- 统一错误码。

---

## 9. 给执行模型的特别提醒

- 不要跳过测试。
- 不要只写 UI，必须打通 main → IPC → preload → renderer。
- 不要把 model config 写死到 renderer。
- 不要把 License Key 暴露给 renderer 状态、toast、console 或报告。
- 不要破坏 Round3 / Round4 已有功能。
- 如果发现现有路径或配置结构和任务假设不一致，以代码实际结构为准，并在报告中说明。

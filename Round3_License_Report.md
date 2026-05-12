# Hermes Desktop 商业 U盘版 — 第三轮任务报告：License 激活页 + data/license.json

## A. 修改文件清单

### 新增文件 (5)

| 文件 | 说明 |
|------|------|
| `src/main/license.ts` | License 核心模块（读/写/清除/测试连接） |
| `src/renderer/src/screens/License/License.tsx` | License 设置页 UI 组件 |
| `src/shared/i18n/locales/en/license.ts` | 英文 License 翻译 |
| `src/shared/i18n/locales/es/license.ts` | 西班牙语 License 翻译 |
| `src/shared/i18n/locales/zh-CN/license.ts` | 中文 License 翻译 |
| `src/shared/i18n/locales/pt-BR/license.ts` | 葡萄牙语 License 翻译 |

### 修改文件 (11)

| 文件 | 变更说明 |
|------|---------|
| `src/main/index.ts` | 新增 4 个 License IPC handler (`license:get/save/clear/test`) + import |
| `src/main/installer.ts` | Round 2 遗留修改（便携路径回归） |
| `src/main/hermes.ts` | Round 2 遗留修改（环境变量合并） |
| `src/preload/index.ts` | 暴露 `getLicense/saveLicense/clearLicense/testLicense` API |
| `src/preload/index.d.ts` | 新增 License API TypeScript 类型定义 |
| `src/renderer/src/screens/Layout/Layout.tsx` | 新增 `license` 视图、导航项、图标、渲染区域 |
| `src/shared/i18n/index.ts` | 注册 license 翻译模块（4 语言） |
| `src/shared/i18n/locales/en/navigation.ts` | 添加 `license: "License"` 导航条目 |
| `src/shared/i18n/locales/es/navigation.ts` | 添加 `license: "Licencia"` |
| `src/shared/i18n/locales/zh-CN/navigation.ts` | 添加 `license: "授权"` |
| `src/shared/i18n/locales/pt-BR/navigation.ts` | 添加 `license: "Licença"` |

**总计：6 个新文件，11 个修改文件，+121 / -7 行。**

---

## B. License 数据格式

`data/license.json` 格式（存储在便携数据目录下）：

```json
{
  "license_key": "sk-user-demo",
  "vps_base_url": "https://api.example.com",
  "device_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "created_at": "2026-05-11T00:00:00.000Z",
  "updated_at": "2026-05-11T00:00:00.000Z",
  "status": "unknown"
}
```

字段说明：

- `license_key`: 用户授权 key，明文存储（后续可加密）
- `vps_base_url`: VPS 服务地址，保存时自动去除末尾 `/`
- `device_id`: 自动生成，首次创建后稳定不变
- `created_at`: 首次创建时间（ISO 8601）
- `updated_at`: 最近更新时间（ISO 8601）
- `status`: `unknown` | `active` | `invalid` | `error`

---

## C. device_id 策略

- **生成方式**: 使用 Node.js `crypto.randomUUID()` 生成 UUID v4
- **fallback**: 如果 `randomUUID` 不可用（极旧 Node），使用时间戳 + 随机数组合
- **保留规则**:
  - 首次保存时自动生成
  - 后续更新 `license_key` 或 `vps_base_url` 时，复用已有 `device_id`（不变）
  - 保留原有 `created_at` 时间戳
- **何时变化**: 仅在 `clearLicense()` 删除整个文件后重新保存时，才会生成新 `device_id`

---

## D. IPC API

| Channel | 方向 | 参数 | 返回值 |
|---------|------|------|--------|
| `license:get` | renderer → main | 无 | `LicenseConfig \| null` |
| `license:save` | renderer → main | `{ license_key, vps_base_url }` | `LicenseConfig` |
| `license:clear` | renderer → main | 无 | `{ success: true }` |
| `license:test` | renderer → main | 无 | `{ ok, status?, message? }` |

**Renderer 调用方式** (通过 `window.hermesAPI`)：

```ts
window.hermesAPI.getLicense()       // Promise<LicenseConfig | null>
window.hermesAPI.saveLicense(input) // Promise<LicenseConfig>
window.hermesAPI.clearLicense()     // Promise<{ success: boolean }>
window.hermesAPI.testLicense()      // Promise<{ ok, status?, message? }>
```

---

## E. UI 入口

用户在左侧导航栏点击 **"License"（授权）** 图标（Globe 地球图标），进入 License 设置页面。

页面包含：

1. **VPS 服务地址** — 文本输入框，placeholder `https://api.example.com`
2. **License Key** — 密码输入框（默认隐藏），可切换显示/隐藏
3. **Device ID** — 只读文本框（仅在有配置时显示）
4. **状态** — 显示当前授权状态（unknown/active/invalid/error/未配置）
5. **操作按钮**：
   - **[保存授权]** — 保存到 `data/license.json`
   - **[测试连接]** — 调用 VPS `/api/license/status` 接口
   - **[清除授权]** — 需要二次确认，删除 license 文件

---

## F. 安全处理

| 安全项 | 处理方式 |
|--------|---------|
| License Key 脱敏 | UI 默认使用 `password` 类型输入框；主进程 `maskLicenseKey()` 可用于后续日志脱敏 |
| 避免日志输出 key | `saveLicense()` 只写文件名到日志，不写 key 内容；`readLicense()` 仅 warn 文件名 |
| URL 校验 | 保存前校验 `vps_base_url` 必须以 `http://` 或 `https://` 开头 |
| 输入校验 | `license_key` 不可为空，`vps_base_url` 不可为空；IPC 端主动校验 `validateLicenseInput()` |
| JSON 损坏处理 | `readLicense()` 捕获 JSON 解析异常，返回 `null`，不抛异常导致 App 崩溃 |
| 文件不存在处理 | `readLicense()` 返回 `null`（UI 显示"未配置"），不创建空文件 |
| VPS 连接超时 | 10 秒超时 + AbortController，超时/网络不可达返回 mock 错误消息，不阻塞 UI |

---

## G. 构建结果

```
npm run build: 成功 ✓ (exit code 0)
```

- **TypeScript 类型检查**: 通过（node + web 双 check）
- **主进程**: 109 模块 → `out/main/index.js` (315.51 kB, 389ms)
- **预加载**: 1 模块 → `out/preload/index.js` (12.84 kB, 15ms)
- **渲染进程**: 2892 模块 → `out/renderer/` (3.25s)

---

## H. 风险点

1. **license_key 明文存储风险**: 当前以明文 JSON 存储在 `data/license.json`，如果 U 盘丢失，key 暴露。后续可考虑使用 `safeStorage` (Electron) 或 AES 加密。
2. **VPS 接口未真实接入**: `testLicenseConnection()` 目前为 mock 实现——如果 VPS 不可达返回友好错误，不阻塞。后续接真实 VPS 时需实现完整的激活流程（签名验证、时间戳校验、防重放）。
3. **UI 入口可能需产品化优化**: 当前 License 为独立导航项，后续可能与 Settings 页面合并或增加更明显的激活引导。
4. **device_id 基于本地随机 UUID**: 如果用户复制整个 `data/` 目录到另一台机器，device_id 也会被拷贝。后续可结合硬件指纹（MAC、主板序列号）增强唯一性。
5. **未集成 Hermes model config**: 本轮明确不做——保存 license 后不会自动配置 `model.base_url` 或 `api_key`，留到第五轮。

---

## I. 下一步建议

按照任务文件规划：

| 轮次 | 内容 |
|------|------|
| **第四轮** | Billing / 额度页面，读取 `license.json` 调用 VPS `/api/quota` |
| **第五轮** | 保存 license 后自动配置 Hermes `model.base_url={vps_base_url}/v1`，`api_key={license_key}` |
| **第六轮** | `quota_exceeded` / HTTP 402 弹窗 |
| **第七轮** | Windows portable 打包和真实 U 盘测试 |

---

## 验收标准核对

- [x] `data/license.json` 能被创建、读取、更新、清除
- [x] `device_id` 能自动生成并稳定保存
- [x] UI 能输入和保存 `license_key` + `vps_base_url`
- [x] preload/IPC 不破坏现有 API
- [x] `npm run build` 通过
- [x] 不做 Billing/VPS/支付/二维码等越界功能

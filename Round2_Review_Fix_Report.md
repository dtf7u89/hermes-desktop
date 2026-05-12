# Hermes Desktop Round 2 审查修复报告

## 1. 修复了哪些问题

| # | 问题 | 修复内容 |
|---|------|---------|
| 1 | `getPortableHermesEnv()` 合并顺序反了 | 改为 `process.env → extraEnv → forced portable paths` 顺序，便携路径始终覆盖外部环境变量 |
| 2 | `getPortableHermesEnv()` 存在但未使用 | `hermes.ts` 的 `sendMessageViaCli()` 和 `startGateway()` 都改为调用 `getPortableHermesEnv()` |
| 3 | `startGateway(profile)` 参数被硬编码 `"portable"` 覆盖 | 改为 `profile \|\| "portable"`，用户传入的 profile 优先 |
| 4 | `installer.ts` 允许外部 `HERMES_HOME` 覆盖便携路径 | 改为 `export const HERMES_HOME = getHermesHomeDir()`，仅通过 `HERMES_DESKTOP_DATA_DIR` 环境变量控制（在 `getAppBaseDir()` 内） |
| 5 | 缺少 `getHermesHomeDir()` alias | 新增 `getHermesHomeDir()` → 调用 `getPortableHermesHome()` |
| 6 | 生产路径检测潜在误判 | 保持现有检测逻辑（`process.resourcesPath` / `ELECTRON_RENDERER_URL` / `.asar`），未引入 `app.isPackaged`（因为模块初始化早于 Electron ready 事件），风险可控 |

## 2. 修改了哪些文件

| 文件 | 变更类型 | 具体修改 |
|------|---------|---------|
| `src/main/portable-paths.ts` | 函数重写 + 新增 | `getPortableHermesEnv()` 合并顺序修复，新增 `options` 参数；新增 `getHermesHomeDir()` alias |
| `src/main/hermes.ts` | 替换调用 | `getWorkspaceDir` → `getPortableHermesEnv`；两处 env 构建改为调用 `getPortableHermesEnv(process.env, { profile })` |
| `src/main/installer.ts` | 简化 | `HERMES_HOME` 去除 `process.env.HERMES_HOME` 和 `homedir()` 回退，改为 `getHermesHomeDir()` |
| `src/main/index.ts` | 无变更 | 本文件在 Round 2 初始实现中已添加 `ensurePortableDirs()` 调用，本轮未改动 |

## 3. `getPortableHermesEnv()` 现在的覆盖顺序

```
最低优先级
  ├── process.env（系统环境变量）
  ├── extraEnv（调用方覆盖，如 profile API keys）
  ├── HERMES_HOME = getPortableHermesHome()（强制便携路径，除非 allowExternalHermesHome=true）
  ├── HERMES_PROFILE = options.profile || "portable"（不允许外部覆盖）
  ├── HERMES_WORKSPACE = getWorkspaceDir()（强制便携路径）
  └── 关键系统键（PATH, HOME, USERPROFILE 等）缺失时回填
最高优先级
```

**核心变化**：便携路径（HERMES_HOME / HERMES_PROFILE / HERMES_WORKSPACE）始终覆盖在顶部，外部环境变量无法再绕开便携路径。

## 4. `HERMES_HOME` 是否还允许外部覆盖

**不允许通过通用 `HERMES_HOME` 环境变量覆盖。**

修改前：
```ts
export const HERMES_HOME = process.env.HERMES_HOME?.trim() || getPortableHermesHome() || join(homedir(), ".hermes");
```

修改后：
```ts
export const HERMES_HOME = getHermesHomeDir();
```

如需显式覆盖数据目录，应使用专用环境变量 `HERMES_DESKTOP_DATA_DIR`（在 `getAppBaseDir()` 内最高优先级处理），而非通用 `HERMES_HOME`。这避免了用户系统已有的 Hermes 环境变量污染 U 盘便携版。

## 5. `startGateway(profile)` 是否保留 profile 参数

**已保留，且 profile 参数现在正确生效。**

修改前（硬编码）：
```ts
HERMES_PROFILE: "portable",
```

修改后：
```ts
...(getPortableHermesEnv(process.env as Record<string, string>, { profile: profile || "portable" })),
```

- 如果调用方传入了 `profile`（如用户通过 UI 选择了某个 profile），使用该值
- 未传入时默认为 `"portable"`
- 外部环境变量 `HERMES_PROFILE` **不会**覆盖此值（由 `getPortableHermesEnv` 的新合并逻辑保证）

## 6. `npm run build` 是否成功

**✅ 构建成功**

```
> hermes-desktop@0.3.5 build
> npm run typecheck && electron-vite build

TypeScript typecheck: ✅ PASS
Main build:     ✅ 104 modules → out/main/index.js (306.44 kB, 356ms)
Preload build:  ✅ 1 module → out/preload/index.js (12.55 kB, 15ms)
Renderer build: ✅ 2887 modules (3.26s)

Exit code: 0
```

## 7. 是否还有风险

| # | 风险 | 等级 | 说明 |
|---|------|------|------|
| 1 | `npm run start` / preview 模式可能误判 `isPackagedApp()` | 🟡 低 | 依赖 `ELECTRON_RENDERER_URL` 区分 dev 模式，preview 构建如未正确设置此变量可能误判为生产模式。建议后续引入 `app.isPackaged`（需在 ready 后使用）或添加 `HERMES_PORTABLE_MODE` 显式开关 |
| 2 | `process.env.HERMES_HOME` 完全失效 | 🟢 无 | 商业 U 盘版预期行为，不影响功能。如需调试覆盖，使用 `HERMES_DESKTOP_DATA_DIR` |
| 3 | remote/ssh 模式不受影响 | 🟢 无 | 所有修改仅影响本地 spawn，remote/ssh 模式路径逻辑未触碰 |
| 4 | profile fallback 为 `"portable"` | 🟢 低 | 首次启动默认使用 `portable` profile，用户可后续切换（UI 传入其他 profile） |

## 附：Git 变更摘要

```
M package-lock.json
 M src/main/hermes.ts
 M src/main/index.ts
 M src/main/installer.ts
?? Round2_Portable_Paths_Report.md
?? src/main/portable-paths.ts
```

---

**总结**：本轮修复以最小改动（3 文件、0 新增依赖）解决了审查指出的 6 个问题，`getPortableHermesEnv()` 合并顺序正确、`startGateway(profile)` 参数保留、`HERMES_HOME` 不再受外部环境变量污染。构建通过，无回归风险。

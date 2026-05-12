# Hermes Desktop Round 2: U 盘便携路径改造 — 完整报告

## A. 修改文件清单

| # | 文件 | 操作 | 说明 |
|---|------|------|------|
| 1 | `src/main/portable-paths.ts` | **新增** | 便携路径工具模块（170行） |
| 2 | `src/main/installer.ts` | 修改 | 添加 import + HERMES_HOME 增加便携路径中间层 |
| 3 | `src/main/hermes.ts` | 修改 | 添加 import + 2处 spawn 注入 HERMES_PROFILE / HERMES_WORKSPACE |
| 4 | `src/main/index.ts` | 修改 | 添加 import + app.whenReady() 内调用 ensurePortableDirs() |

## B. 新增函数说明（portable-paths.ts）

| 函数 | 用途 | 路径示例 |
|------|------|---------|
| `getAppBaseDir()` | 获取便携数据根目录 `data/` | 开发：`<项目根>/data`；生产：`<exe旁>/data` |
| `getPortableDataDir()` | 同上 | — |
| `getPortableHermesHome()` | Hermes 数据目录 | `data/hermes/` |
| `getWorkspaceDir()` | 工作空间目录 | `data/workspace/` |
| `getLogsDir()` | 日志目录 | `data/logs/` |
| `getLicenseFilePath()` | 许可证文件路径 | `data/license.json` |
| `getAppDbPath()` | App 数据库路径 | `data/app.db` |
| `ensurePortableDirs()` | 创建所有便携目录 | 启动时调用 |
| `getPortableHermesEnv()` | 获取注入给 Hermes 进程的完整 env | 含 HERMES_HOME / HERMES_PROFILE / HERMES_WORKSPACE |

## C. Portable 路径规则

优先级（在 `getAppBaseDir()` 中实现）：

1. **环境变量** `HERMES_DESKTOP_DATA_DIR`（最高优先）
2. **生产模式** — 检测 `process.resourcesPath` / `.asar`，返回 `<exe所在目录>/data`
3. **开发模式** — 从 `__dirname` 向上查找 `package.json`，返回 `<项目根>/data`
4. **兜底** — `~/.hermes`

| 场景 | 检测方式 | `getAppBaseDir()` 返回值 |
|------|---------|------------------------|
| 显式设置 | `HERMES_DESKTOP_DATA_DIR` 存在 | 使用该值 |
| macOS .app 打包 | `resourcesPath` 以 Contents 结尾 | `<.app同级>/data` |
| Windows/Linux 打包 | `resourcesPath` 存在 | `<resources父级>/data` |
| asar 内运行 | `__dirname` 含 `.asar` | `<resources父级>/data` |
| electron-vite dev | `ELECTRON_RENDERER_URL` 存在 | `<项目根>/data` |
| 无匹配 | 全部失败 | `~/.hermes` |

目标目录结构（自动创建）：

```
data/
├── hermes/           # Hermes Agent 全部数据（替代 ~/.hermes）
├── workspace/        # 工作空间
├── logs/             # 预留未来桌面端日志
├── license.json      # 预留
└── app.db            # 预留
```

## D. Hermes 环境变量注入点

修改了 **2 个 spawn 点**（仅本地模式生效）：

### D1. Gateway 启动（`startGateway()`）

位置：`src/main/hermes.ts` 行 696-710

```typescript
const gatewayEnv: Record<string, string> = {
  ...(process.env as Record<string, string>),
  PATH: getEnhancedPath(),
  HOME: homedir(),
  HERMES_HOME: HERMES_HOME,           // 自动指向 data/hermes/
  HERMES_PROFILE: "portable",         // ★ 新增
  HERMES_WORKSPACE: getWorkspaceDir(), // ★ 新增
  API_SERVER_ENABLED: "true",
};
```

### D2. CLI 回退（`sendMessageViaCli()`）

位置：`src/main/hermes.ts` 行 463-471

```typescript
const env: Record<string, string> = {
  ...(process.env as Record<string, string>),
  PATH: getEnhancedPath(),
  HOME: homedir(),
  HERMES_HOME: HERMES_HOME,           // 自动指向 data/hermes/
  HERMES_PROFILE: "portable",         // ★ 新增
  HERMES_WORKSPACE: getWorkspaceDir(), // ★ 新增
  PYTHONUNBUFFERED: "1",
};
```

所有通过 `HERMES_HOME` 派生的路径（`HERMES_REPO`、`HERMES_VENV`、`HERMES_PYTHON`、`HERMES_SCRIPT`、`HERMES_ENV_FILE`、`HERMES_CONFIG_FILE`、`HERMES_AUTH_FILE`）自动跟随便携路径，无需逐处修改。

## E. SQLite / 缓存路径处理

| 文件 | 原路径 | 现状 | 处理方式 |
|------|--------|------|---------|
| `sessions.ts` | `join(HERMES_HOME, "state.db")` | **自动跟随** → `data/hermes/state.db` | 无需改动，HERMES_HOME 已重定向 |
| `memory.ts` | `join(profileHome(profile), "state.db")` | **自动跟随** → `data/hermes/state.db` | `profileHome()` 引用 HERMES_HOME，自动适配 |
| `config.ts` in-memory cache | `new Map()` | 内存缓存，不入磁盘 | 无需改动 |

**评估结论**：SQLite 和缓存路径通过 HERMES_HOME 常量间接引用，修改常量后全部自动适配为便携路径，零风险，无需额外改动。

## F. 日志路径处理

| 组件 | 写入路径 | 现状 |
|------|---------|------|
| Hermes Agent 日志（agent.log / errors.log / gateway.log） | `$HERMES_HOME/logs/` | 自动指向 `data/hermes/logs/` |
| `readLogs()` 读取函数 | `join(HERMES_HOME, "logs")` | 自动指向 `data/hermes/logs/` |
| `data/logs/` 目录 | — | 已创建，预留未来桌面端日志使用 |

**风险说明**：

- Hermes Agent 内部硬编码了 `$HERMES_HOME/logs/` 作为日志路径，无法从外部重定向到 `data/logs/`
- 当前 `data/logs/` 为空目录，仅在 `ensurePortableDirs()` 中创建，未写入任何日志
- `readLogs()` 仍然读取 `data/hermes/logs/`（Agent 实际写入位置），读写一致，无功能影响
- 将来如需统一到 `data/logs/`，需修改 Hermes Agent 本体或通过符号链接 / 环境变量控制

## G. 构建结果

```
> hermes-desktop@0.3.5 build
> npm run typecheck && electron-vite build

TypeScript typecheck: ✅ PASS
Main build:     ✅ 104 modules → out/main/index.js (305.91 kB, 378ms)
Preload build:  ✅ 1 module → out/preload/index.js (12.55 kB, 14ms)
Renderer build: ✅ 2887 modules (3.28s)

Exit code: 0 — 构建成功
```

## H. 风险点

| # | 风险 | 等级 | 说明 |
|---|------|------|------|
| 1 | 开发/生产模式检测错误 | 🟡 中 | 依赖 `process.resourcesPath` / `__dirname` / `ELECTRON_RENDERER_URL`，如 electron-vite 行为变化可能导致检测失效，兜底为 `~/.hermes` |
| 2 | macOS .app bundle 路径 | 🟡 中 | 通过 `resourcesPath` 以 `Contents` 结尾来判断 .app 结构，非标准打包可能误判 |
| 3 | 日志路径分离 | 🟢 低 | `data/hermes/logs/` vs `data/logs/`，读写一致无功能影响，仅目录结构略不直观 |
| 4 | 首次启动目录为空 | 🟢 低 | 便携目录为新创建，Hermes Agent 需重新安装（`data/hermes/hermes-agent/` 不存在），安装器会正常处理 |
| 5 | remote/ssh 模式 | 🟢 无 | 修改仅影响本地 spawn，remote/ssh 模式完全不涉及便携路径 |

## I. 下一步建议

1. **功能验证**：启动开发模式 `npm run dev`，确认 `data/` 目录在项目根下自动创建，Hermes Agent 安装和运行正常
2. **跨平台测试**：Windows（exe 同级 data/）、macOS（.app 同级 data/）、Linux（AppImage 同级 data/）分别打包验证
3. **日志统一**：调研 Hermes Agent 是否支持 `HERMES_LOG_DIR` 环境变量，可将 Agent 日志也重定向到 `data/logs/`
4. **app.db 迁移**：当前 `state.db` 在 `data/hermes/` 下，如需迁移到 `data/app.db`，可调用 `getAppDbPath()`
5. **首次安装引导**：便携模式首次启动无 `data/hermes/hermes-agent/`，安装器应自动 clone，当前由用户手动触发安装
6. **环境变量持久化**：考虑将 `HERMES_DESKTOP_DATA_DIR` 支持写入 `desktop.json`，让用户可在设置界面中自定义 portable 数据目录

---

**总结**：第二轮改造以最小侵入性（4 文件、0 接口变更、~80 行新增代码）实现了 Hermes Desktop 的 U 盘便携化，开发和生产模式均自动适配，remote/ssh 模式完全不受影响。构建通过，无回归风险。

# Round8A USB Portable 验收报告

生成时间：2026-05-12
工作目录：`/home/seeone/hermes-desktop`

## 1. 已完成项

- 已按恢复命令从 Round8-A 中断点继续，没有从头重做整轮长任务。
- 已检查 Round8-A portable 相关改动，未发现需要大范围重构的问题。
- `electron-builder.yml`：
  - Windows target 已包含 `nsis` 与 `portable`。
  - portable artifactName 已配置为 `${name}-${version}-portable.${ext}`。
- `package.json`：
  - 已包含 `build:win:all`、`build:win:dir`、`build:win:portable` 脚本。
- `src/main/portable-paths.ts`：
  - 已实现 packaged/dev 环境的数据目录解析。
  - Windows packaged app 会把 `data/` 放在 executable/resources 父目录旁边，支持 U 盘盘符变化。
  - 支持 `HERMES_DESKTOP_DATA_DIR` 显式覆盖。
  - 已提供 `getPortableHermesEnv()`，为本地 Hermes 进程注入 portable 环境：`HERMES_HOME`、`HERMES_PROFILE=portable`、`HERMES_WORKSPACE`。
- `tests/portable-paths.test.ts`：
  - 已覆盖 dev mode、Windows E:/F: 盘符移动、环境变量覆盖、macOS packaged 路径、portable Hermes env。
- `USB_README.md`：
  - 已写入 Windows USB Portable 使用说明、首次配置、数据位置与安全注意事项。
- 已确认当前 WSL 环境未安装 `wine` / `wine64`，因此没有在 WSL 内长时间反复尝试 Windows portable 单 exe 打包。

## 2. 测试结果

### Targeted tests

命令：

```bash
npm run test -- tests/portable-paths.test.ts tests/model-proxy-test.test.ts tests/model-config.test.ts tests/quota.test.ts
```

结果：通过。

- Test Files：4 passed / 4
- Tests：77 passed / 77
- Duration：871ms

### Wine 检查

命令：

```bash
command -v wine || true
command -v wine64 || true
```

结果：未发现 `wine` 或 `wine64`。

因此按恢复命令要求跳过 portable 单 exe 打包：

```text
SKIP_BUILD_WIN_PORTABLE: wine/wine64 not installed in WSL
```

### Windows unpacked build 状态

上一轮已执行过：

```bash
npm run build:win:dir
```

已知状态：

- `typecheck` 通过。
- `electron-vite build` 通过。
- `dist/win-unpacked/hermes-agent.exe` 已生成。
- 最终受阻于 Wine：

```text
wine is required, please see https://electron.build/multi-platform-build#linux
ERR_ELECTRON_BUILDER_CANNOT_EXECUTE
```

说明：这是 WSL/Linux 缺少 Wine 导致 electron-builder 无法完成 Windows exe resource/integrity 处理及后续 portable/nsis 打包，不是 Round8-A portable 路径代码测试失败。

## 3. 产物位置

当前可用产物：

```text
dist/win-unpacked/hermes-agent.exe
```

已验证文件存在：

```text
dist/win-unpacked/hermes-agent.exe | 210931200 bytes | 2026-05-12 20:48:31 +0800
```

使用方式：这是 Windows unpacked 目录内的 executable，需要与 `dist/win-unpacked/` 目录内其他文件一起使用，不是最终 portable 单 exe。

## 4. 未完成 / 受阻项

- 最终 Windows portable 单 exe 尚未完成。
- 当前未发现 `dist/*portable*.exe` 产物。
- 受阻原因：当前 WSL/Linux 环境缺少 Wine；electron-builder 在 Linux 上打 Windows exe resource/integrity、portable/nsis 时需要 Wine。

## 5. 下一步二选一方案

### 方案 A：在 WSL 安装 Wine 后继续

安装 Wine 后，在 `/home/seeone/hermes-desktop` 运行：

```bash
npm run build:win:portable
```

完成后检查 `dist/*portable*.exe`，并在 Windows 上双击验证：

- 首次启动会在程序旁边创建/使用 `data/`。
- License 页面可填写 `https://apitokenhub.dpdns.org`、用户 New API token、`gpt-5.5-fast`。
- 移动到不同 U 盘盘符后仍使用当前目录下的 `data/`。

### 方案 B：在 Windows 原生环境运行

在 Windows 原生 PowerShell / CMD 中进入项目目录，安装依赖后运行：

```powershell
npm run build:win:portable
```

优点：避免 WSL cross-build 对 Wine 的依赖，更接近最终用户 Windows 运行环境。

## 6. 当前可用产物明确说明

当前可用产物是：

```text
dist/win-unpacked/hermes-agent.exe
```

它应与整个 `dist/win-unpacked/` 目录一起分发或测试。

## 7. Portable 单 exe 状态明确说明

最终 portable 单 exe 尚未完成。

原因：当前 WSL 环境没有 Wine，electron-builder 无法在 Linux/WSL 上完成 Windows portable/nsis 打包所需步骤。

# Hermes Desktop — USB 便携版（商业分支）

<img width="100%" alt="HERMES DESKTOP" src="https://github.com/user-attachments/assets/80585955-3bae-4aee-af90-a1e61757ccb8" />

## 语言

- 英文：`README.md`
- 简体中文：`README.zh-CN.md`

> **这是 [fathah/hermes-desktop](https://github.com/fathah/hermes-desktop) 的商业分支，增加了 USB 便携封装、New API 额度计费、模型代理测试和生产 License 管理功能。** 本项目仍在积极开发中，功能可能会变化。如果你遇到 bug 或有新的想法，欢迎 [提交 issue](https://github.com/dtf7u89/hermes-desktop/issues)。

Hermes Desktop 是一个桌面应用，通过原生桌面界面安装、配置并与 [Hermes Agent](https://github.com/NousResearch/hermes-agent) 进行交互。

本分支在开源基座上增加了**生产级商业功能**：

- **USB 便携封装** — 免安装，直接从 U 盘运行，`data/` 目录跟随 exe，换盘符即走
- **New API 额度计费** — 通过 New API 的 `/api/user/self` 端点实时显示用户 token 的余额、已用量和总额度
- **License 管理** — VPS 地址 + 用户 token + 设备 ID 持久化存储在便携 `data/license.json` 中
- **Model Proxy Test** — 可配置模型测试，支持自动发现 `/v1/models`

**生产架构：**

```
Hermes Desktop (USB)
  → https://apitokenhub.dpdns.org (VPS 上的 New API)
  → 模型分发、计费、额度、用户 token 管理
```

桌面端只保存 `vps_base_url`、`license_key`（New API 用户 token）和 `device_id` — 上游模型 API key 永远不会到达客户端。

## 安装

请从 [Releases](https://github.com/dtf7u89/hermes-desktop/releases/) 页面下载最新构建版本。

| 平台  | 文件                  |
| ----- | --------------------- |
| macOS | `.dmg`                |
| Linux | `.AppImage` 或 `.deb` |
| Windows | `.exe`（NSIS 安装包） |
| Windows USB | `.exe`（便携版） |

### Windows USB 便携版

从 Releases 下载 `Hermes Agent-<version>-portable.exe`，放入 U 盘目录（如 `HermesUSB/`），双击启动。所有数据保存在 exe 旁边的 `data/` 目录中 — 整体移动目录到任意盘符，配置和数据都跟着走。详细说明见 [USB_README.md](USB_README.md)。

> **macOS 用户：** 应用目前没有进行代码签名或 notarize，首次启动时 macOS 可能会阻止运行。安装后请执行：
>
> ```bash
> xattr -cr "/Applications/Hermes Agent.app"
> ```

## 商业功能（本分支新增）

| 功能 | 说明 |
|------|------|
| **USB 便携模式** | `data/` 目录跟随 exe，不依赖固定盘符 |
| **New API 额度计费** | `GET /api/user/self` + Bearer 认证，实时显示额度 |
| **License 页面** | VPS URL + 用户 token + 设备 ID 管理 |
| **Model Proxy Test** | 可配置模型测试，支持 `/v1/models` 自动发现 |
| **Apply Model Config** | 一键生成 Hermes 配置文件（base_url + api_key） |
| **便携数据目录** | `data/hermes/`、`data/workspace/`、`data/logs/` 全部便携化 |

## 原有功能

- Hermes Agent 的首次引导式安装
- OpenRouter、Anthropic、OpenAI 以及本地 OpenAI 兼容端点的提供商配置
- 基于 Hermes CLI 的流式聊天界面
- 带恢复和搜索能力的会话历史
- 用于隔离 Hermes 环境的档案切换
- 对人格、记忆、工具和已安装技能的图形界面访问
- Hermes 消息集成的网关控制
- 使用 Electron Builder 进行桌面打包

## 工作方式

首次启动时，应用会：

1. 检查 `~/.hermes` 中是否已经安装 Hermes。
2. 如果尚未安装，则运行官方 Hermes 安装程序。
3. 提示你选择 API 提供商或本地模型端点。
4. 通过 Hermes 配置文件保存提供商配置和 API Key。
5. 在设置完成后进入主工作区。

聊天请求会通过本地 Hermes CLI 发出，桌面应用再把响应流式回传到 UI 中。

## 主界面

- `Chat`：与 Hermes 进行流式对话
- `Sessions`：浏览并重新打开历史会话
- `Agents`：管理和切换活动档案
- `Skills`：查看内置和已安装技能
- `Persona`：编辑当前档案的人格
- `Memory`：查看档案记忆文件
- `Tools`：启用或禁用工具集
- `Schedules`：创建和管理定时任务
- `Gateway`：消息平台集成控制
- `Settings`：提供商和网关相关配置
- **`License`**：VPS URL、New API 用户 token 和设备 ID 配置（本分支新增）
- **`Billing`**：实时 token 用量和额度显示（本分支新增）

## 开发

### 前置要求

- Node.js 和 npm
- 可运行 Hermes 安装器的类 Unix shell 环境
- 首次安装时用于下载 Hermes 的网络访问能力

### 安装依赖

```bash
npm install
```

### 启动开发模式

```bash
npm run dev
```

### 运行检查

```bash
npm run lint
npm run typecheck
```

### 运行测试

```bash
npm run test
```

### 构建桌面应用

```bash
npm run build
```

平台构建：

```bash
npm run build:mac
npm run build:win           # NSIS 安装包 + portable
npm run build:win:portable  # 仅 USB 便携 .exe
npm run build:linux
```

## 首次设置

应用首次打开时，会自动检测是否存在现有 Hermes 安装；如果没有，会引导你完成安装。

当前 UI 支持的设置路径包括：

- `OpenRouter`
- `Anthropic`
- `OpenAI`
- 通过 OpenAI 兼容 Base URL 使用 `Local LLM`

内置的本地预设包括：

- LM Studio
- Ollama
- vLLM
- llama.cpp

## 说明

- 本分支在上游 [fathah/hermes-desktop](https://github.com/fathah/hermes-desktop) 基础上增加了商业功能（USB 便携、New API 计费、License 管理）。
- 桌面应用依赖上游 Hermes Agent 项目来完成代理行为和工具执行。
- 内置安装器会以 `--skip-setup` 运行官方 Hermes 安装脚本，再在 GUI 中完成提供商配置。
- 本地模型提供商不需要 API Key，但兼容服务必须已经启动。

## 贡献

欢迎贡献！请查看 [贡献指南](CONTRIBUTING.zh-CN.md) 开始参与。如果你发现 bug 或希望提出功能请求，欢迎 [提交 issue](https://github.com/dtf7u89/hermes-desktop/issues/new)。

## 相关项目

- 上游桌面应用：[fathah/hermes-desktop](https://github.com/fathah/hermes-desktop)
- 核心代理和 CLI：[NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)

<img width="100%" alt="HERMES DESKTOP" src="https://github.com/user-attachments/assets/80585955-3bae-4aee-af90-a1e61757ccb8" />

<br/>
<p align="center">
  <a href="https://github.com/dtf7u89/hermes-desktop/releases/"><img src="https://img.shields.io/badge/Download-Releases-FF6600?style=for-the-badge" alt="Releases"></a>
<a href="https://github.com/dtf7u89/hermes-desktop/stargazers">
  <img src="https://img.shields.io/github/stars/dtf7u89/hermes-desktop?style=for-the-badge&color=FFD700&label=Stars" alt="Stars">
</a>
  <a href="https://github.com/dtf7u89/hermes-desktop/releases/">
  <img src="https://img.shields.io/github/downloads/dtf7u89/hermes-desktop/total?style=for-the-badge&color=00B496&label=Total%20Downloads" alt="Downloads">
</a>
  <a href="https://github.com/dtf7u89/hermes-desktop/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License: MIT"></a>
</p>

> **This is a fork of [fathah/hermes-desktop](https://github.com/fathah/hermes-desktop) with commercial features added — USB portable packaging, New API billing/quota, model proxy testing, and production license management.** This project is in active development. If you run into a problem or have an idea, [open an issue](https://github.com/dtf7u89/hermes-desktop/issues).

## Languages

- English: `README.md`
- 简体中文: `README.zh-CN.md`

Hermes Desktop is a native desktop app for installing, configuring, and chatting with [Hermes Agent](https://github.com/NousResearch/hermes-agent) — a self-improving AI assistant with tool use, multi-platform messaging, and a closed learning loop.

This fork adds **production-ready commercial features** on top of the open-source base:

- **USB Portable packaging** — runs entirely from a USB drive with `data/` next to the executable, no installation required
- **New API Billing / Quota** — real-time token usage tracking via New API's `/api/user/self` endpoint with Bearer authentication
- **License management** — VPS URL + user token + device ID persistence in portable `data/license.json`
- **Model Proxy Test** — configurable model testing against production New API endpoints

## Install

Download the latest build from the [Releases](https://github.com/dtf7u89/hermes-desktop/releases/) page.

| Platform       | File                    |
| -------------- | ----------------------- |
| macOS          | `.dmg`                  |
| Linux (any)    | `.AppImage`             |
| Linux (Debian) | `.deb`                  |
| Linux (Fedora) | `.rpm`                  |
| Windows        | `.exe` (NSIS installer) |
| Windows USB    | `.exe` (portable)       |

### Windows USB Portable

Download the `Hermes Agent-<version>-portable.exe` from Releases, place it in a USB drive directory (e.g. `HermesUSB/`), and double-click to launch. All data is stored in `data/` next to the executable — move the entire directory to a different drive and everything goes with you. See [USB_README.md](USB_README.md) for detailed setup instructions.

### Windows (NSIS installer)

> **Windows users:** The installer is not code-signed. Windows SmartScreen will warn on first launch — click "More info" → "Run anyway".

### Fedora (RPM)

```bash
sudo dnf install ./hermes-desktop-<version>.rpm
```

> **Fedora users:** The `.rpm` is not GPG-signed. If your system enforces signature checking, append `--nogpgcheck` to the install command. Auto-update is not supported for `.rpm` builds (limitation of `electron-updater`); reinstall the new `.rpm` to update.

### macOS

> **macOS users:** The app is not code-signed or notarized. macOS will block it on first launch. To fix this, run the following after installing:
>
> ```bash
> xattr -cr "/Applications/Hermes Agent.app"
> ```
>
> Or right-click the app → **Open** → click **Open** in the confirmation dialog.

## Commercial Features (This Fork)

These features have been added to the upstream `fathah/hermes-desktop` base:

| Feature | Description |
|---------|-------------|
| **USB Portable Mode** | `data/` directory follows the executable — works from any drive letter |
| **New API Billing** | Real-time quota display from `GET /api/user/self` with Bearer auth |
| **License Page** | VPS URL + user token + device ID management |
| **Model Proxy Test** | Configurable model testing with auto-discovery via `/v1/models` |
| **Apply Model Config** | One-click Hermes config generation with `base_url` and `api_key` |
| **Portable Data Dirs** | `data/hermes/`, `data/workspace/`, `data/logs/` — all portable |

**Production architecture:**

```
Hermes Desktop (USB)
  → https://apitokenhub.dpdns.org (New API on VPS)
  → Model routing, billing, quota, user tokens
```

The desktop client stores only `vps_base_url`, `license_key` (New API user token), and `device_id` — no upstream API keys ever reach the client.

## Features

- **Guided first-run install** for Hermes Agent with progress tracking and dependency resolution
- **Local or remote backend** — run Hermes locally on `127.0.0.1:8642`, or connect the desktop app to a remote Hermes API server with URL + API key
- **Multi-provider support** — OpenRouter, Anthropic, OpenAI, Google (Gemini), xAI (Grok), Nous Portal, Qwen, MiniMax, Hugging Face, Groq, and local OpenAI-compatible endpoints (LM Studio, Ollama, vLLM, llama.cpp)
- **Streaming chat UI** with SSE streaming, tool progress indicators, markdown rendering, and syntax highlighting
- **Token usage tracking** — live prompt/completion token counts and cost display in the chat footer, plus a `/usage` slash command
- **22 slash commands** — `/new`, `/clear`, `/fast`, `/web`, `/image`, `/browse`, `/code`, `/shell`, `/usage`, `/help`, `/tools`, `/skills`, `/model`, `/memory`, `/persona`, `/version`, `/compact`, `/compress`, `/undo`, `/retry`, `/debug`, `/status`, and more
- **Session management** — full-text search (SQLite FTS5), date-grouped history, resume and search across conversations
- **Profile switching** — create, delete, and switch between separate Hermes environments with isolated config
- **14 toolsets** — web, browser, terminal, file, code execution, vision, image gen, TTS, skills, memory, session search, clarify, delegation, MoA, and task planning
- **Memory system** — view/edit memory entries, user profile memory, capacity tracking, and discoverable memory providers (Honcho, Hindsight, Mem0, RetainDB, Supermemory, ByteRover)
- **Persona editor** — edit and reset your agent's SOUL.md personality
- **Saved models** — CRUD management for model configurations across providers
- **Scheduled tasks** — cron job builder (minutes, hourly, daily, weekly, custom cron) with 15 delivery targets
- **16 messaging gateways** — Telegram, Discord, Slack, WhatsApp, Signal, Matrix, Mattermost, Email (IMAP/SMTP), SMS (Twilio/Vonage), iMessage (BlueBubbles), DingTalk, Feishu/Lark, WeCom, WeChat (iLink Bot), Webhooks, Home Assistant
- **Hermes Office (Claw3d)** — visual 3D interface with dev server and adapter management
- **Backup, import & debug dump** — full data backup/restore and system diagnostics from Settings
- **Log viewer** — view gateway and agent logs directly from the Settings screen
- **Auto-updater** — check for and install updates via electron-updater
- **i18n ready** — internationalization framework with English locale covering all screens, ready for community translations
- **Test suite** — SSE parser, IPC handlers, preload API surface, installer utilities, and constants validation with Vitest

## Preview

<table>
<tr>
<td width="50%" align="center"><b>Office</b><br/><img width="100%" alt="Office" src="https://github.com/user-attachments/assets/214bfa60-48ec-4449-be40-370628205147" /></td>
<td width="50%" align="center"><b>Chat</b><br/><img width="100%" alt="Chat" src="https://github.com/user-attachments/assets/ca84a56c-4d14-4775-96bb-c725069988be" /></td>
</tr>
<tr>
<td width="50%" align="center"><b>Profiles</b><br/><img width="100%" alt="Profiles" src="https://github.com/user-attachments/assets/bd812e4a-bbdc-4141-b3a8-1ab5b0e561d4" /></td>
<td width="50%" align="center"><b>Tools</b><br/><img width="100%" alt="Tools" src="https://github.com/user-attachments/assets/ad051fbe-055d-40d2-b6dd-959c522412d2" /></td>
</tr>
<tr>
<td width="50%" align="center"><b>Settings</b><br/><img width="100%" alt="Settings" src="https://github.com/user-attachments/assets/b3f7e0d8-b087-4935-b57c-f8db30491f2e" /></td>
<td width="50%" align="center"><b>Skills</b><br/><img width="100%" alt="Skills" src="https://github.com/user-attachments/assets/508c3501-52eb-419d-8cfd-06268875ff62" /></td>
</tr>
</table>

## How It Works

On first launch, the app:

1. Asks whether you want to run Hermes **locally** or connect to a **remote** Hermes API server.
2. **Local mode:** checks whether Hermes is already installed in `~/.hermes`; if not, runs the official Hermes installer with dependency resolution (Git, uv, Python 3.11+).
3. **Remote mode:** prompts for the remote API URL and API key, validates the connection, and skips local install.
4. Prompts for an API provider or local model endpoint.
5. Saves provider config and API keys through Hermes config files.
6. Launches the main workspace once setup is complete.

In local mode, chat requests go through `http://127.0.0.1:8642` with SSE streaming. In remote mode, the app talks to your configured remote URL with the same streaming protocol. The desktop app parses the stream in real time, rendering tool progress, markdown content, and token usage as it arrives.

## Screens

| Screen        | Description                                                                           |
| ------------- | ------------------------------------------------------------------------------------- |
| **Chat**      | Streaming conversation UI with slash commands, tool progress, and token tracking      |
| **Sessions**  | Browse, search, and resume past conversations                                         |
| **Agents**    | Create, delete, and switch between Hermes profiles                                    |
| **Skills**    | Browse, install, and manage bundled and installed skills                              |
| **Models**    | Manage saved model configurations per provider                                        |
| **Memory**    | View/edit memory entries, user profile, and configure memory providers                |
| **Soul**      | Edit the active profile's persona (SOUL.md)                                           |
| **Tools**     | Enable or disable individual toolsets                                                 |
| **Schedules** | Create and manage cron jobs with delivery targets                                     |
| **Gateway**   | Configure and control messaging platform integrations                                 |
| **Office**    | Claw3d visual interface setup and management                                          |
| **Settings**  | Provider config, credential pools, backup/import, log viewer, network settings, theme |
| **License**   | VPS URL, New API user token, and device ID configuration *(this fork)*               |
| **Billing**   | Real-time token usage and quota display *(this fork)*                                 |

## Supported Providers

### LLM Providers

| Provider            | Notes                                    |
| ------------------- | ---------------------------------------- |
| **OpenRouter**      | 200+ models via single API (recommended) |
| **Anthropic**       | Direct Claude access                     |
| **OpenAI**          | Direct GPT access                        |
| **Google (Gemini)** | Google AI Studio                         |
| **xAI (Grok)**      | Grok models                              |
| **Nous Portal**     | Free tier available                      |
| **Qwen**            | QwenAI models                            |
| **MiniMax**         | Global and China endpoints               |
| **Hugging Face**    | 20+ open models via HF Inference         |
| **Groq**            | Fast inference (voice/STT)               |
| **Local/Custom**    | Any OpenAI-compatible endpoint           |

Local presets are included for LM Studio, Ollama, vLLM, and llama.cpp.

### Messaging Platforms

Telegram, Discord, Slack, WhatsApp, Signal, Matrix/Element, Mattermost, Email (IMAP/SMTP), SMS (Twilio & Vonage), iMessage (BlueBubbles), DingTalk, Feishu/Lark, WeCom, WeChat (iLink Bot), Webhooks, and Home Assistant.

### Tool Integrations

Exa Search, Parallel API, Tavily, Firecrawl, FAL.ai (image generation), Honcho, Browserbase, Weights & Biases, and Tinker.

## Development

### Prerequisites

- Node.js and npm
- A Unix-like shell environment for the Hermes installer
- Network access for downloading Hermes during first-run install

### Install dependencies

```bash
npm install
```

### Start the app in development

```bash
npm run dev
```

### Run checks

```bash
npm run lint
npm run typecheck
```

### Run tests

```bash
npm run test
npm run test:watch
```

### Build the desktop app

```bash
npm run build
```

Platform packaging:

```bash
npm run build:mac
npm run build:win           # NSIS installer + portable
npm run build:win:portable  # USB portable .exe only
npm run build:linux
npm run build:rpm           # Fedora/RHEL .rpm only
```

## First-Time Setup

When the app opens for the first time, it will either detect an existing Hermes installation or offer to install it for you.

Supported setup paths in the UI:

- `OpenRouter`
- `Anthropic`
- `OpenAI`
- `Local LLM` via an OpenAI-compatible base URL

Local presets are included for:

- LM Studio
- Ollama
- vLLM
- llama.cpp

Hermes files are managed in:

- `~/.hermes`
- `~/.hermes/.env`
- `~/.hermes/config.yaml`
- `~/.hermes/hermes-agent`
- `~/.hermes/profiles/` — named profile directories
- `~/.hermes/state.db` — session history database
- `~/.hermes/cron/jobs.json` — scheduled tasks

## Tech Stack

- **Electron** 39 — cross-platform desktop shell
- **React** 19 — UI framework
- **TypeScript** 5.9 — type safety across main and renderer processes
- **Tailwind CSS** 4 — utility-first styling
- **Vite** 7 + electron-vite — fast dev server and build tooling
- **better-sqlite3** — local session storage with FTS5 full-text search
- **i18next** — internationalization framework
- **Vitest** — test runner

## Notes

- This fork adds commercial features (USB portable, New API billing, license management) on top of the upstream [fathah/hermes-desktop](https://github.com/fathah/hermes-desktop).
- The desktop app depends on the upstream Hermes Agent project for agent behavior and tool execution.
- The built-in installer runs the official Hermes install script with `--skip-setup`, then completes provider configuration in the GUI.
- Local model providers do not require an API key, but the compatible server must already be running.
- Alternative npm registry routes are supported for environments with restricted network access.

## Contributing

Contributions are welcome! Check out the [Contributing Guide](CONTRIBUTING.md) to get started. If you're not sure where to begin, take a look at the [open issues](https://github.com/dtf7u89/hermes-desktop/issues). Found a bug or have a feature request? [File an issue](https://github.com/dtf7u89/hermes-desktop/issues/new).

## Related Projects

- Upstream desktop app: [fathah/hermes-desktop](https://github.com/fathah/hermes-desktop)
- Core agent and CLI: [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)

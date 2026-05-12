# Round8-A：Windows USB Portable 封装与验收任务

> 任务来源：pihermestwo session `20260512_190113_bf670f` 最近生成的 Round8-A 完整任务命令。  
> 使用方式：让 DeepSeek 4 Pro / `pihermestwo` 在**新会话**中读取本文件并执行，避免旧会话 10 万 token 上下文导致 custom stream timeout。

---

请执行 Round8-A：Windows USB Portable 封装与验收。

项目路径：

/home/seeone/hermes-desktop

## 0. 当前背景

这是 Hermes Desktop 商业化 USB / Windows Portable 产品封装阶段。

生产商业架构已经确定：

Hermes Desktop / USB 客户端
→ 连接 VPS 上的 QuantumNous/new-api
→ New API 负责模型分发、用户 API Key、token 统计、额度、兑换码、充值、日志和管理后台
→ 桌面端只保存：
  - vps_base_url
  - New API 用户 token，也就是当前代码里的 license_key
  - device_id

生产 New API 域名：

https://apitokenhub.dpdns.org

OpenAI-compatible Base URL 应为：

https://apitokenhub.dpdns.org/v1

测试模型：

gpt-5.5-fast

当前已完成：

1. Round3 License
   - `/home/seeone/hermes-desktop/Round3_License_Report.md`
   - License 页面
   - `data/license.json`
   - device_id UUID v4 稳定保留

2. Round4 Billing
   - `/home/seeone/hermes-desktop/Round4_Billing_Report.md`
   - Billing / 额度页面

3. Round5 Model Config
   - `/home/seeone/hermes-desktop/Round5_Model_Config_Report.md`
   - 自动写入 Hermes model config
   - `provider=custom`
   - `base_url={vps_base_url}/v1`
   - `api_key=license_key`

4. Round6 Model Proxy Test
   - `/home/seeone/hermes-desktop/Round6_VPS_Model_Proxy_Report.md`
   - 模型代理测试

5. Round7 New API Production
   - `/home/seeone/hermes-desktop/Round7_NewAPI_Production_Plan.md`
   - `/home/seeone/hermes-desktop/Round7_NewAPI_Production_Report.md`
   - New API 部署完成

6. Round7-B Channel Link
   - `/home/seeone/hermes-desktop/Round7B_NewAPI_Channel_Desktop_Link_Report.md`
   - New API 渠道与模型可用

7. Round7-C Configurable Model Proxy
   - `/home/seeone/hermes-desktop/Round7C_Model_Proxy_Configurable_Model_Report.md`
   - Model Proxy Test 不再硬编码 `default`
   - 支持 `gpt-5.5-fast`
   - 支持自动读取 `/v1/models`

8. Round7-D Billing / Quota
   - `/home/seeone/hermes-desktop/Round7D_NewAPI_Billing_Quota_Report.md`
   - Billing / Quota 适配生产 New API：
     `GET https://apitokenhub.dpdns.org/api/user/self`
   - 保留 legacy mock `/api/quota`

9. Round7-E Domain / HTTPS
   - `/home/seeone/hermes-desktop/Round7E_NewAPI_Domain_HTTPS_Report.md`
   - HTTPS 域名已配置完成：
     `https://apitokenhub.dpdns.org`

当前验证状态：

- `npm test -- tests/installer-utils.test.ts tests/model-config.test.ts tests/model-proxy-test.test.ts tests/quota.test.ts` 已通过，87 tests passed
- `npm run build` 已通过
- New API `/v1/models` 和 `/v1/chat/completions` 已通过域名实测

## 1. 本轮目标

将 Hermes Desktop 推进到 Windows USB Portable 封装验收阶段。

目标不是最终大规模商业发布，而是生成可在 Windows / U 盘路径运行的 Portable 验收包。

本轮必须完成：

1. 检查并修正 Electron Builder Windows portable 配置。
2. 保留 NSIS 安装包能力。
3. 增加 Windows portable target。
4. 增加或修正 package scripts，例如：
   - `build:win`
   - `build:win:portable`
   - `build:win:dir`
5. 生成或准备 Windows portable 产物。
6. 准备 `HermesUSB/` 目录结构。
7. 验证 portable 数据目录逻辑：
   - `data/license.json`
   - `data/hermes`
   - `data/workspace`
   - `data/logs`
8. 验证不能依赖固定盘符。
9. 验证生产域名和 New API token 流程：
   - License
   - Apply Model Config
   - Billing
   - Model Proxy Test
10. 写入完整验收报告。

## 2. 重要原则

### 2.1 不要把真实密钥打进包里

严禁把任何真实 token / API key / root 密码 / admin token 写入：

- 源码
- `electron-builder.yml`
- package scripts
- report
- build artifacts
- `data/license.json` 模板

U 盘包可以预置：

```text
vps_base_url=https://apitokenhub.dpdns.org
```

但不要预置：

```text
license_key
New API token
上游模型 API key
admin token
```

用户第一次启动后应自己输入 New API 用户 token / license_key。

### 2.2 不要破坏现有功能

必须保留：

- NSIS installer 构建
- dev 模式
- Linux/mac 配置不要无关改坏
- Round6 mock fallback
- Round7 New API 生产路径

### 2.3 Portable 优先级

Windows USB portable 应满足：

```text
HermesUSB/
  Hermes Agent.exe 或 hermes-agent.exe
  data/
    license.json
    hermes/
    workspace/
    logs/
```

打包后从不同路径运行都应使用 app 旁边的 `data/`，不要写入用户 home 的 `.hermes`。

## 3. 必须先阅读的文件

请先阅读：

- `/home/seeone/hermes-desktop/package.json`
- `/home/seeone/hermes-desktop/electron-builder.yml`
- `/home/seeone/hermes-desktop/src/main/portable-paths.ts`
- `/home/seeone/hermes-desktop/src/main/license.ts`
- `/home/seeone/hermes-desktop/src/main/model-config.ts`
- `/home/seeone/hermes-desktop/src/main/quota.ts`
- `/home/seeone/hermes-desktop/src/main/model-proxy-test.ts`
- `/home/seeone/hermes-desktop/src/main/installer.ts`
- `/home/seeone/hermes-desktop/tests/installer-utils.test.ts`
- `/home/seeone/hermes-desktop/tests/model-config.test.ts`
- `/home/seeone/hermes-desktop/tests/model-proxy-test.test.ts`
- `/home/seeone/hermes-desktop/tests/quota.test.ts`
- `/home/seeone/hermes-desktop/Round7E_NewAPI_Domain_HTTPS_Report.md`

## 4. Electron Builder 要求

当前 `electron-builder.yml` 里 Windows 配置可能主要是 NSIS：

```yaml
win:
  executableName: hermes-agent
nsis:
  artifactName: ${name}-${version}-setup.${ext}
```

需要调整为同时支持：

```yaml
win:
  executableName: hermes-agent
  target:
    - target: nsis
      arch:
        - x64
    - target: portable
      arch:
        - x64
```

并设置 portable artifactName，例如：

```yaml
portable:
  artifactName: ${name}-${version}-portable.${ext}
```

或者采用 electron-builder 当前版本支持的等价配置。

要求：

- 不删除 NSIS。
- portable 产物名字要清晰，例如：
  `hermes-desktop-0.3.5-portable.exe`
- 如 Electron Builder schema 对 `portable` 配置位置有限制，请按实际版本修正。
- 不要引入会破坏 Linux/mac build 的配置。

## 5. package scripts 要求

建议增加：

```json
"build:win:dir": "npm run build && electron-builder --win --dir",
"build:win:portable": "npm run build && electron-builder --win portable",
"build:win:all": "npm run build && electron-builder --win"
```

或根据 electron-builder 实际 CLI 语法调整。

现有：

```json
"build:win": "npm run build && electron-builder --win"
```

可以保留或改为 `build:win:all`，但不要让现有使用者失效。

## 6. Portable 数据目录验收

必须确认 `src/main/portable-paths.ts` 的 packaged 模式路径正确。

当前逻辑预期：

- packaged app:
  - `process.resourcesPath = <app>/resources`
  - app data dir = `<app>/data`
- macOS `.app` 特殊处理
- dev mode 使用项目根 `data/`

本轮需要新增或加强测试，覆盖：

1. dev mode:
   - `ELECTRON_RENDERER_URL` 存在时，不应误判 packaged
   - data dir 在项目 `data/`

2. Windows packaged mode:
   - mock `process.resourcesPath = "E:\\HermesUSB\\resources"`
   - app base dir 应为：
     `E:\\HermesUSB\\data`

3. 换盘符:
   - `F:\\HermesUSB\\resources`
   - app base dir 应为：
     `F:\\HermesUSB\\data`

4. 环境变量 override:
   - `HERMES_DESKTOP_DATA_DIR` 优先级最高

5. portable Hermes env:
   - `HERMES_HOME = <data>/hermes`
   - `HERMES_PROFILE = portable`
   - `HERMES_WORKSPACE = <data>/workspace`

如当前测试不易 mock `process.resourcesPath`，可以重构出纯函数，例如：

```ts
resolveAppBaseDir({
  electronRendererUrl,
  dirname,
  resourcesPath,
  cwd,
  envDataDir,
})
```

然后用纯函数测试，不要依赖真实 Electron runtime。

## 7. 生产默认域名

请检查 License 页面是否有默认 VPS URL。

如果目前为空，建议加入生产默认值：

```text
https://apitokenhub.dpdns.org
```

要求：

- 只预填 `vps_base_url`
- 不预填 `license_key`
- 如果已有 `data/license.json`，应优先显示用户保存的值
- 测试覆盖：默认 URL 存在，但 token 不存在

如果你判断不应在代码里默认域名，请在报告中说明原因，并至少提供 `USB_README.md` 指导用户输入：

```text
VPS URL:
https://apitokenhub.dpdns.org

Test model:
gpt-5.5-fast
```

## 8. USB_README 要求

建议新增：

```text
USB_README.md
```

内容包括：

1. 如何启动 portable 版。
2. 首次使用填写：
   - VPS URL: `https://apitokenhub.dpdns.org`
   - License Key: 用户 New API token
   - Test model: `gpt-5.5-fast`
3. 数据保存位置：
   - `data/license.json`
   - `data/hermes`
   - `data/workspace`
   - `data/logs`
4. 不要删除 `data/`，否则会丢失本地配置。
5. 不要把 U 盘借给别人，因为里面可能保存用户 token。
6. 如果 token 泄露，到 New API 后台重置。
7. 不包含上游模型 API key，真实 key 在 VPS。
8. 常见问题：
   - 无法连接：检查网络和 HTTPS 域名
   - 额度不显示：检查 token 是否有效
   - 模型测试失败：检查 New API 模型名是否为 `gpt-5.5-fast` 或启用自动选择

## 9. 构建要求

在 WSL/Linux 环境下，Windows 构建可能需要 Wine / mono / electron-builder cache。

请先尝试：

```bash
npm run build:win:portable
```

如果环境缺少 Wine 或无法产出 Windows exe，不要硬编假结果。

应执行：

```bash
npm run build
npm run build:unpack
```

并在报告中说明：

- 当前环境能否直接生成 Windows portable exe
- 如果不能，缺少什么依赖
- 在 Windows 主机上应执行什么命令

建议给出 Windows PowerShell 命令：

```powershell
cd C:\path\to\hermes-desktop
npm install
npm run build:win:portable
```

如果 WSL 能成功产出 portable exe，请记录产物路径，例如：

```text
dist/hermes-desktop-0.3.5-portable.exe
```

## 10. 实机验收清单

报告中必须提供人工验收清单：

### 10.1 U 盘目录

```text
HermesUSB/
  hermes-agent.exe
  data/
```

或 portable exe 位置按 electron-builder 实际产物说明。

### 10.2 首次启动

检查：

- `data/` 自动生成
- `data/hermes/` 自动生成
- `data/workspace/` 自动生成
- `data/logs/` 自动生成
- `data/license.json` 在保存 license 后生成

### 10.3 License 流程

输入：

```text
VPS URL:
https://apitokenhub.dpdns.org

License Key:
用户 New API token
```

点击保存。

确认：

- device_id 稳定生成
- 重启后 license 仍存在

### 10.4 Model Config

点击 Apply Model Config。

确认 Hermes config 中：

```yaml
model:
  provider: custom
  base_url: https://apitokenhub.dpdns.org/v1
  api_key: <用户 New API token>
```

### 10.5 Billing

打开 Billing 页面。

确认：

- 能调用 `/api/user/self`
- 显示 plan/group
- 显示 remaining/used/total

### 10.6 Model Proxy Test

测试模型：

```text
gpt-5.5-fast
```

或留空启用自动选择。

确认返回模型响应。

### 10.7 换盘符

把整个目录复制到不同盘符，例如：

```text
E:\HermesUSB
F:\HermesUSB
```

确认：

- 仍使用当前目录下 `data/`
- 不写入 `C:\Users\<user>\.hermes`
- license / device_id 可随 U 盘保留

## 11. 测试要求

必须运行：

```bash
npm test -- tests/installer-utils.test.ts tests/model-config.test.ts tests/model-proxy-test.test.ts tests/quota.test.ts
npm test
npm run build
```

如果新增 portable-paths 测试，则也运行对应测试。

如果修改 electron-builder 配置，也至少运行：

```bash
npm run build:unpack
```

如环境支持，再运行：

```bash
npm run build:win:portable
```

## 12. 报告要求

最终写入：

```text
/home/seeone/hermes-desktop/Round8A_USB_Portable_Packaging_Report.md
```

报告必须包含：

1. 本轮目标
2. 修改文件清单
3. Electron Builder 修改说明
4. package scripts 修改说明
5. portable 数据目录策略
6. 是否预置默认 VPS URL
7. USB_README 是否新增
8. 构建结果
9. 测试结果
10. Windows portable exe 是否成功产出
11. 如果未产出，原因和 Windows 主机执行命令
12. 实机验收清单
13. 安全处理
14. 风险点
15. 下一步建议

## 13. 安全提醒

本轮不要修复所有 VPS 安全问题，但报告要提醒：

- 已暴露过的测试 token 必须轮换
- 已暴露过的 root 密码必须轮换
- New API 3001 后续应只允许本机访问
- 公网只保留 80/443/SSH
- 最终商业发布前要做 Round7-F 安全加固

## 14. 完成标准

Round8-A 只有在以下条件满足时才算完成：

- Electron Builder 支持 Windows portable target
- NSIS installer 能力保留
- portable 路径逻辑有测试或明确验证
- 默认生产域名处理清晰
- USB_README 已写或报告说明不需要
- `npm test` 通过
- `npm run build` 通过
- `build:unpack` 通过或明确环境阻塞原因
- Windows portable 构建尝试过，成功则给出产物路径，失败则给出准确原因和 Windows 构建命令
- 写入 `Round8A_USB_Portable_Packaging_Report.md`

---

## 执行提醒

如果在 WSL/Linux 环境尝试打包 Windows exe，可能会遇到 Wine / mono / electron-builder 依赖问题，这是正常阻塞项。

优先目标：

```text
代码和配置先改好，Linux/WSL 能跑测试和 unpack；真正 Windows portable exe 可以在 Windows 主机上执行 npm run build:win:portable。
```

如果必须产出 Windows `.exe`，请在 Windows 主机或已配置 Wine/mono 的环境执行 Windows portable 构建。

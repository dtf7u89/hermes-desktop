# Hermes Desktop Windows USB Portable 使用说明

## 启动方式

1. 将 Windows portable 产物放入 U 盘目录，例如：

```text
HermesUSB/
  hermes-agent.exe
  data/
```

2. 双击 `hermes-agent.exe` 启动。首次启动会在程序旁边使用/创建 `data/` 目录。

## 首次配置

打开 License 页面，填写：

```text
VPS URL:
https://apitokenhub.dpdns.org

License Key:
你的 New API 用户 token

Test model:
gpt-5.5-fast
```

说明：

- USB 包只预置生产 VPS URL，不包含任何真实 License Key、New API token、上游模型 API key 或 admin token。
- License Key 就是你在 New API 中获得的用户 token。
- Model Proxy Test 可以填写 `gpt-5.5-fast`，也可以留空并启用自动选择模型。

## 数据保存位置

Portable 版会使用程序旁边的 `data/`，而不是固定盘符或用户 home：

```text
HermesUSB/
  data/
    license.json
    hermes/
    workspace/
    logs/
```

- `data/license.json`：保存 VPS URL、用户 New API token、device_id。
- `data/hermes/`：Hermes Agent 的 portable home。
- `data/workspace/`：portable 工作目录。
- `data/logs/`：桌面端日志目录。

## 注意事项

- 不要删除 `data/`，否则会丢失本地配置、device_id 和工作数据。
- 不要把已配置过 token 的 U 盘借给别人，因为 `data/license.json` 可能保存你的用户 token。
- 如果 token 泄露，请到 New API 后台删除或重置该 token。
- 本包不包含上游模型 API key；真实上游 key 只保存在 VPS 的 New API 后台。

## 常见问题

- 无法连接：检查网络是否能访问 `https://apitokenhub.dpdns.org`。
- 额度不显示：检查 License Key / New API token 是否有效。
- 模型测试失败：确认 New API 模型名为 `gpt-5.5-fast`，或在 Model Proxy Test 中启用自动选择。
- 换 U 盘盘符后：请整体移动 `HermesUSB/` 目录，程序会继续使用当前目录下的 `data/`。

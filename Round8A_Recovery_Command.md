# Round8-A 恢复执行命令（给 pihermestwo / deepseek-v4-pro）

> 目的：从上次 Round8-A 中断点继续，不要重复整轮长任务，避免 10 万 token 上下文导致 custom stream timeout。

请在新会话中执行：

```text
请继续 Round8-A Windows USB Portable 封装与验收，不要从头重做。

工作目录：/home/seeone/hermes-desktop

已知状态：
1. 上次会话 20260512_194434_3bbea0bd 因 custom endpoint timeout 中断。
2. 已新增/修改：
   - electron-builder.yml
   - package.json
   - src/main/portable-paths.ts
   - tests/portable-paths.test.ts
   - USB_README.md
3. 已验证通过：
   npm run test -- tests/portable-paths.test.ts tests/model-proxy-test.test.ts tests/model-config.test.ts tests/quota.test.ts
   结果：77 passed
4. 已尝试：npm run build:win:dir
   - typecheck 通过
   - electron-vite build 通过
   - dist/win-unpacked/hermes-agent.exe 已生成
   - 最后失败原因：WSL/Linux 缺少 Wine，electron-builder 需要 wine 完成 Windows exe 资源处理/portable/nsis 打包。

请只完成以下收尾任务：

A. 检查现有 Round8-A 改动是否完整且无明显回归。
B. 如能安全修复，就修复 portable 相关细节；不要大范围重构。
C. 不要在 WSL 内长时间反复尝试 Windows portable 打包，除非先确认 wine 已安装。
D. 写最终验收报告：/home/seeone/hermes-desktop/Round8A_USB_Portable_Report.md

报告必须包含：
1. 已完成项
2. 测试结果
3. 产物位置
4. 未完成/受阻项
5. 下一步二选一方案：
   - 在 WSL 安装 wine 后继续 npm run build:win:portable
   - 或在 Windows 原生环境运行 npm run build:win:portable
6. 明确说明当前可用产物：dist/win-unpacked/hermes-agent.exe
7. 明确说明最终 portable 单 exe 尚未完成（除非你实际生成并验证了 portable exe）

最后只回复报告路径和简短结论。
```

# Claude HUD Plus 工作区说明

## 项目定位

Claude HUD Plus 是基于上游 `claude-hud` 的增强版 Claude Code 状态栏插件。当前分支保持上游核心结构稳定，在此基础上增加 API 路由真实模型显示、长会话诊断和多终端显示稳定性能力。

## 执行原则

- 不要现在大规模搬动 `src/` 上游核心目录。
- 新增 Plus 能力优先放入 `src/plus/`，避免继续堆进 `src/stdin.ts` 或 `src/render/index.ts`。
- 技术 key、命令、环境变量、配置字段保留英文。
- 用户问题、选项、提示、故障排查说明优先中文化。
- `src/` 是源码事实；`dist/` 是构建产物，发布前通过 `npm run build` 生成。
- `tests/` 是正式自动化测试；`research/` 是本地调研资料和历史脚本，不参与发布。

## 常用命令

```bash
npm ci
npm run build
npm test
npm pack
```

快速状态栏冒烟测试：

```bash
echo '{"model":{"display_name":"Opus"},"context_window":{"current_usage":{"input_tokens":45000},"context_window_size":200000}}' | node dist/index.js
```

## 关键目录

```text
src/                 TypeScript 源码
src/plus/            Plus 专属增强能力
dist/                构建产物
commands/            Claude Code slash command 提示词
tests/               正式自动化测试
research/            本地调研资料、历史验证脚本和对话材料
.claude-plugin/      插件元数据
```

## Plus 能力边界

当前 Plus 能力包括：

- `src/plus/router-model.ts`：读取路由层写入的真实模型状态。
- `src/plus/context-window-override.ts`：按 `CLAUDE_HUD_CONTEXT_WINDOW_SIZE` 覆盖展示用上下文窗口。

后续新增路由、宽度策略、长会话诊断能力时，应优先放入 `src/plus/` 或独立模块，并补对应测试。

## 插件命令

- `/claude-hud-plus:setup`：配置 statusLine。
- `/claude-hud-plus:configure`：配置 HUD 显示选项。

配置文件路径：`~/.claude/plugins/claude-hud-plus/config.json`。

## 上游同步

本仓库应先完整同步官方 `claude-hud` 最新代码作为基线，再叠加 Plus 修改。不要按文件零散挑选上游代码落库。

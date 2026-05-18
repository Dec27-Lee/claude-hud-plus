# 更新日志

本文件记录 Claude HUD Plus 的重要变更。

## [未发布]

### 已修复

- Windows + PowerShell 的 `/claude-hud-plus:setup` 会写入 `statusline.ps1` 包装脚本，带有受保护的宽度兜底和修正后的版本目录匹配规则。
- 增加 Windows PowerShell 5.1 写入 `settings.json` 时避免 UTF-8 BOM 的说明。
- 中文化用户可见的命令提示词、插件元数据、治理文档和 GitHub 模板。

### 已变更

- 移除 `docs/upstream/CLAUDE.README.md` 上游说明归档，避免和 Plus 当前用户文档混淆；上游同步原则保留在 `CLAUDE.md`。
- 同步更新 README、slash command 说明和安装后配置示例，使文档以当前 `rows` 布局、动态终端宽度和会话级 CCR 模型状态为准。

### 已新增

- 新增 `rows` / `rowOverflow` 行布局配置，默认渲染模型+上下文、项目/额外工作目录+Git、会话 Token 三行 HUD。
- Plus 路由模型读取：自动对比 Claude Code 当前请求地址与 CCR 配置 `HOST` / `PORT`，确认匹配后读取当前会话级 `ccr-model.json`；状态文件缺失时模型组件显示运行 setup 的中英文提示。
- Plus 上下文窗口覆盖：支持通过 `CLAUDE_HUD_CONTEXT_WINDOW_SIZE` 覆盖展示用上下文窗口大小并重算百分比。
- `scripts/patch-ccr-session-model.cjs`，用于在 setup 用户确认后备份并修补 CCR，使其写入会话级真实模型状态。
- `src/plus/` 模块边界，用于放置 Plus 专属增强能力。

## [0.1.0] - 初始 Plus 版本

### 已新增

- 基于官方 Claude HUD 最新代码建立 Claude HUD Plus 基线。
- 项目名、插件名、命令名和配置路径统一为 `claude-hud-plus`。
- 中文 README、中文 slash command 提示词和 Plus 工作区说明。

## 上游历史

以下条目来自官方 Claude HUD 上游历史，用于保留来源和演进背景。这里可能出现 `lineLayout` 等上游旧配置名；它们不是 Claude HUD Plus 当前推荐配置，当前 Plus 布局以 `rows` / `rowOverflow` 为准。

## [0.0.12] - 2026-04-04

### 已新增

- 中文（`zh`）HUD 标签作为显式启用选项，同时保持英文为默认语言。
- `/claude-hud:configure` 中加入语言选择，用户无需手动编辑 JSON 即可选择英文或中文。
- 通过 `display.showCost` 显示离线估算的会话费用，仅基于本地 transcript token 用量计算。
- 会话 token 总量、输出风格显示、git push 数量阈值着色、可配置模型徽章格式和自定义模型覆盖。
- Git 文件 diff 渲染，支持逐文件和总行数变化，并在支持时使用可点击的 OSC 8 文件链接。

### 已变更

- 使用率显示只依赖 Claude Code 官方 stdin 的 `rate_limits` 字段。后台 OAuth 使用率轮询、相关缓存/锁行为和基于凭据推断的订阅计划标签已移除。
- setup 和 configure 流程更适合简单上手：Windows setup 优先提示 Node.js，GitHub star 提示增加 `gh` 兼容说明，configure 将语言作为一等引导选项。
- 插件检测、配置缓存和基于 transcript 的活动/会话元数据更加稳健，并补充测试覆盖。

### 已修复

- 稳定 Claude Code 版本缓存，兼容解析后的二进制路径和 mtime，修复 Node 20 CI 失败。
- 停止仅通过环境变量猜测认证模式。
- 保留 `TodoWrite` 的任务 ID，识别 transcript 中记录为 `Agent` 的代理，并改善窄终端换行，包括 OSC 超链接宽度处理。
- 改善 macOS 内存报告、配置缓存失效，以及终端宽度不可用时的兜底渲染。
- 澄清官方使用率数据行为，并隐藏 Bedrock/未知定价场景，避免显示误导性估算。

## [0.0.10] - 2026-03-23

### 已新增

- 可配置 HUD 颜色覆盖，支持命名预设、256 色索引和十六进制颜色。
- `display.customLine` 支持在 HUD 中显示短自定义短语。
- 新增显式启用的显示开关：会话名称、组合上下文模式（`display.contextValue: "both"`）、Claude Code 版本和展开布局中的近似系统 RAM 使用。

### 已变更

- setup 和插件检测更好地处理 `CLAUDE_CONFIG_DIR`、Windows shell 引号，以及 Bun `--env-file` 安装时避免继承项目环境文件。
- 使用率显示优先使用 Claude Code stdin 的 `rate_limits` 数据；不可用时仍回退到既有 OAuth/cache 路径，并更清晰地展示仅周额度/免费用户使用率。
- 上下文百分比和 token 显示遵循 Claude Code 报告的上下文窗口大小，包括较新的 1M 上下文会话；较低兜底 autocompact 估算更接近 `/context`。
- 使用率文本会在同步中保留最近一次成功值，在适用时显示 7 天重置倒计时，并说明标准代理环境变量是路由 Anthropic 流量的受支持方式。
- 进度条和展开布局输出更好地适配窄终端宽度。

### 已修复

- setup 在之前需要重启 Claude Code 才显示 HUD 的会话中更加可靠，安装后插件命令发现不再因 unknown-skill 错误失败。
- 使用率处理在 OAuth token 刷新、代理隧道、显式 TLS 覆盖、零字节锁文件、陈旧缓存恢复和 rate-limit 边界场景下更稳健。
- 多账号和多插件版本安装场景下，账号级凭据查找和插件选择更可靠。
- 展开布局渲染会正确保留速度、时长、额外标签和仅周额度使用率输出。
- 工具执行不再把终端滚动到顶部，transcript 重解析也会避免在大型历史中反复缓存部分解析结果。

## [0.0.9] - 2026-03-05

### 已变更

- 通过 `CLAUDE_HUD_USAGE_TIMEOUT_MS` 增加 Usage API 超时覆盖，默认值改为 15 秒。

### 已修复

- setup 说明现在会为 `win32 + bash` 环境生成 shell 安全的 Windows 命令。
- 当 `model.display_name` 缺失时，Bedrock 启动模型标签会规范化已知模型 ID。
- 改善代理和 OAuth token 刷新边界场景下的 Usage API 可靠性。
- 渲染输出保留普通空格而不是不换行空格，避免启动时出现垂直状态栏渲染问题。

## [0.0.8] - 2026-03-03

### 已新增

- 状态栏会话名称显示。
- `display.contextValue: "remaining"` 模式，用于显示剩余上下文百分比。
- 针对 `CLAUDE_CONFIG_DIR` 路径处理、keychain service 解析兜底顺序和配置计数重叠边界的回归测试。

### 已变更

- 优先使用订阅计划标签，而不是通过 API 环境变量检测账号类型。
- 当重置窗口达到 24 小时或更长时，使用率重置时间格式切换为天。

### 已修复

- HUD 配置查找、使用率缓存、速度缓存和旧凭据文件路径支持 `CLAUDE_CONFIG_DIR`。
- 改善多 profile 场景下的 macOS Keychain 凭据查找。
- 修复配置计数重叠检测。
- 防止 HUD 行在窄终端中消失。
- 安全处理对象形式的旧布局值迁移。
- 防止当前目录为 home 时重复计算用户级和项目级 `CLAUDE.md`。

## [0.0.7] - 2026-02-06

### 已变更

- 重新设计默认布局：用干净的 2 行显示替代之前的多行默认布局。
- 模型括号移动到项目行。
- 上下文和使用率进度条合并到同一行，并用 `│` 分隔。
- 缩短标签：`Context Window` → `Context`，`Usage Limits` → `Usage`。
- 所有可选能力默认隐藏：tools、agents、todos、duration、config counts。
- 增加 Bedrock provider 检测、输出速度显示、Token 上下文显示选项和 7 天使用率阈值配置。

### 已新增

- setup 引导在完成前提供可选功能选择。
- 新增 `display.showSpeed` 配置项，用于显示输出 token 速度。

### 已修复

- 在使用率显示中展示 API 失败原因。
- 支持 transcript 中的任务待办更新。
- 紧凑模式下保持 HUD 为单行。
- setup 检测中使用平台上下文而不是 `uname`。

## [0.0.6] - 2026-01-14

### 已新增

- 展开式多行布局模式，将拥挤的会话行拆成语义化行。
- 新配置项：`lineLayout`、`showSeparators`、`display.usageThreshold`、`display.environmentThreshold`。

### 已变更

- 新安装默认使用 `expanded` 布局。
- 阈值逻辑使用 `max(5h, 7d)`，避免高 7 天使用率被隐藏。

### 已修复

- setup 命令中的幽灵安装检测和清理。

### 迁移

- 旧配置 `layout: "default"` 自动迁移到 `lineLayout: "compact"`。
- 旧配置 `layout: "separators"` 自动迁移到 `lineLayout: "compact"` + `showSeparators: true`。

## [0.0.5] - 2026-01-14

### 已新增

- 原生上下文百分比支持，适用于 Claude Code v2.1.6+。
- `display.autocompactBuffer` 配置项。
- Linux 插件安装时的 EXDEV 跨设备错误检测。

### 已变更

- 上下文百分比改用百分比形式的 buffer，而不是硬编码 45k token。
- 移除自动 PR review workflow。

### 已修复

- Git 状态中将 `--no-optional-locks` 移到正确的全局 git option 位置。
- 防止 git 操作期间出现陈旧的 `index.lock` 文件。
- 从计数中排除禁用的 MCP server。
- 从 Usage API cache 读取时重新转换 Date 对象。

### 致谢

- 来自上游 PR 的想法帮助形成了 autocompact 方案。

### 依赖

- 升级 `@types/node`。

## [0.0.4] - 2026-01-07

### 已新增

- 通过 `~/.claude/plugins/claude-hud/config.json` 提供配置系统。
- 交互式 `/claude-hud:configure` 配置命令。
- 使用率 API 集成，显示 5 小时/7 天 rate limit。
- Git 状态、可配置路径层级、布局选项和 HUD 元素显示开关。

### 已修复

- Git 状态间距。
- 根路径渲染为空时显示 `/`。
- Windows 路径规范化。

### 致谢

- 配置系统、布局、路径层级和 git 开关来自上游贡献。

## [0.0.3] - 2025-01-06

### 已新增

- 在会话行显示 git 分支名称。
- 在会话行显示项目文件夹名称。
- setup 命令中增加动态平台和运行时检测。

### 已变更

- 移除高上下文使用率时冗余的 COMPACT 警告。

### 已修复

- 跳过 fork PR 的自动 review，避免 CI 失败。

### 依赖

- 升级 `@types/node`。

## [0.0.2] - 2025-01-04

### 安全

- 增加 CI workflow，在合并后构建 `dist/`，关闭 PR 中通过编译产物注入恶意代码的攻击面。
- 从 git 跟踪中移除 `dist/`，PR 只包含源码，由 CI 处理编译。

### 已修复

- 为上下文百分比计算增加 45k token autocompact buffer，使输出更准确地匹配 `/context`。
- 修复 package-lock.json 的 CI 缓存。
- GitHub Actions 代码 review 使用 Opus 4.5。

### 已变更

- setup 命令自动检测已安装插件版本，无需手动更新路径。
- setup 配置成功后提示可选 GitHub star。
- 移除 husky pre-commit hook，CI 处理 `dist/` 编译。

### 依赖

- 升级 `c8`。

## [0.0.1] - 2025-01-04

Claude HUD 作为 Claude Code statusline 插件的初始版本。

### 功能

- 实时上下文使用率监控和彩色进度条。
- 活跃工具追踪和完成计数。
- 运行中的 Agent 状态和耗时。
- 待办进度显示。
- 来自 Claude Code stdin 的原生 token 数据。
- 解析 transcript 以获取工具、Agent 和待办活动。

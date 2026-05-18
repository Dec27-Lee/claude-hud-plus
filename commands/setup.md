---
description: 将 claude-hud-plus 配置为 Claude Code statusLine
allowed-tools: Bash, Read, Edit, AskUserQuestion
---

# 配置 Claude HUD Plus 状态栏

目标：把 `claude-hud-plus` 配置为 Claude Code 的 `statusLine`，并尽量保留用户已有配置。

技术标识、命令、路径、环境变量保持英文；面向用户的问题、选项、提示和故障排查说明使用中文。

---

## 步骤 0：检查异常安装状态

先检查插件是否存在缓存、注册表和临时残留。

### macOS / Linux / Git Bash

```bash
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
CACHE_EXISTS=$(ls -d "$CLAUDE_DIR/plugins/cache"/*/claude-hud-plus 2>/dev/null && echo "有" || echo "无")
REGISTRY_EXISTS=$(grep -q "claude-hud-plus" "$CLAUDE_DIR/plugins/installed_plugins.json" 2>/dev/null && echo "有" || echo "无")
TEMP_FILES=$(ls -d "$CLAUDE_DIR/plugins/cache/temp_local_"* 2>/dev/null | head -1)
echo "缓存: $CACHE_EXISTS | 注册表: $REGISTRY_EXISTS | 临时文件: ${TEMP_FILES:-无}"
```

### Windows PowerShell

```powershell
$claudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }
$cache = (Get-ChildItem (Join-Path $claudeDir "plugins\cache") -Directory -ErrorAction SilentlyContinue | ForEach-Object { Test-Path (Join-Path $_.FullName "claude-hud-plus") }) -contains $true
$registry = (Get-Content (Join-Path $claudeDir "plugins\installed_plugins.json") -ErrorAction SilentlyContinue) -match "claude-hud-plus"
$temp = Get-ChildItem (Join-Path $claudeDir "plugins\cache\temp_local_*") -ErrorAction SilentlyContinue
Write-Host "缓存: $cache | 注册表: $registry | 临时文件: $($temp.Count) 个"
```

判断规则：

| 缓存 | 注册表 | 含义 | 处理 |
|---|---|---|---|
| 有 | 有 | 正常安装或可继续检查 | 进入步骤 1 |
| 有 | 无 | 缓存孤儿安装 | 询问用户是否清理 |
| 无 | 有 | 注册表残留 | 询问用户是否清理 |
| 无 | 无 | 尚未安装 | 提示先安装插件 |

如果发现幽灵安装（ghost install）或临时文件（temp files），先问用户：`检测到插件安装残留，是否清理后重新安装？`

只有用户明确同意后，才运行清理命令。

---

## 步骤 1：确认插件已安装

如果插件尚未安装，提示用户在 Claude Code 中执行：

```text
/plugin marketplace add Dec27-Lee/claude-hud-plus
/plugin install claude-hud-plus
/reload-plugins
```

如果 Linux 用户遇到 `EXDEV: cross-device link not permitted`，提示：

```bash
mkdir -p ~/.cache/tmp && TMPDIR=~/.cache/tmp claude
```

然后在新的 Claude Code 会话中重新安装插件。

---

## 步骤 2：检测 JavaScript 运行时

优先使用 Node.js 18+。如果没有 Node.js，可在 macOS/Linux 尝试 Bun。

检查命令示例：

```bash
node --version
bun --version
```

Windows 上如果没有 Node.js，提示：

```powershell
winget install OpenJS.NodeJS.LTS
```

然后要求用户重启 shell，再重新运行 `/claude-hud-plus:setup`。

---

## 步骤 3：定位最新插件版本目录

### macOS / Linux

```bash
ls -d "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/*/claude-hud-plus/*/ 2>/dev/null | sort -V | tail -1
```

### Windows PowerShell

```powershell
$claudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }
(Get-ChildItem (Join-Path $claudeDir "plugins\cache\*\claude-hud-plus\*") -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^\d+(\.\d+)+$' } | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1).FullName
```

如果找不到版本目录，告诉用户：`没有找到 claude-hud-plus 的插件缓存目录。请先确认插件已安装并执行 /reload-plugins。`

---

## 步骤 4：生成 statusLine 命令

生成的命令必须动态查找最新安装版本，这样插件更新后不需要重新 setup。

### macOS / Linux / Git Bash

推荐命令模式：

```bash
bash -c 'cols=$(stty size </dev/tty 2>/dev/null | awk '\''{print $2}'\''); if [ -n "$cols" ] && [ "$cols" -gt 4 ]; then export CLAUDE_HUD_TERMINAL_WIDTH=$((cols - 4)); fi; plugin_dir=$(ls -1d "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/*/claude-hud-plus/*/ 2>/dev/null | sort -V | tail -1); exec "{RUNTIME_PATH}" "${plugin_dir}{SOURCE}"'
```

其中：

- `{RUNTIME_PATH}` 替换为检测到的 `node` 或 `bun`
- `{SOURCE}` 通常是 `dist/index.js`
- `CLAUDE_HUD_TERMINAL_WIDTH` 由命令每次从当前终端动态探测并传给 HUD；用户不需要手动设置宽度

### Windows PowerShell

Windows 推荐写入包装脚本：

```powershell
$claudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }
$wrapperDir = Join-Path $claudeDir "plugins\claude-hud-plus"
$wrapperPath = Join-Path $wrapperDir "statusline.ps1"
New-Item -ItemType Directory -Force -Path $wrapperDir | Out-Null
```

包装脚本内容应：

1. 查找最新 `claude-hud-plus` 插件版本目录。
2. 每次运行时动态读取当前窗口宽度，并写入 `$env:CLAUDE_HUD_TERMINAL_WIDTH`。
3. 执行 Node.js：`node dist/index.js`。
4. 透传标准输入、标准输出和标准错误（stdin/stdout/stderr）。

statusLine 命令 使用：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{WRAPPER_PATH}"
```

---

## 步骤 5：写入 settings.json

读取用户设置文件：

```text
~/.claude/settings.json
```

或使用 `CLAUDE_CONFIG_DIR` 指定的目录。

写入或更新：

```json
{
  "statusLine": {
    "type": "command",
    "command": "{GENERATED_COMMAND}"
  }
}
```

必须保留 settings 中已有的其他字段。

如果用户启用了 Plus context window 覆盖，可同时写入 env：

```json
{
  "env": {
    "CLAUDE_HUD_CONTEXT_WINDOW_SIZE": "270000"
  }
}
```

不要默认覆盖用户已有 env；只在用户选择启用时合并。终端宽度默认由 statusLine 命令动态探测，不要把固定宽度写入 settings env。

---

## 步骤 6：可选 HUD 功能

询问：

- header: `功能`
- question: `是否启用一些可选 HUD 功能？默认显示模型、上下文、项目/Git 和会话 Token 三行核心信息。`
- multiSelect: true
- options:
  - `工具活动` — 显示 Read/Edit/Grep 等工具运行状态
  - `Agent 状态` — 显示运行中的子代理
  - `待办进度` — 显示 TodoWrite 进度
  - `中文标签` — 将 HUD 标签语言设置为中文

如果用户选择了任何选项，写入 `~/.claude/plugins/claude-hud-plus/config.json`。

配置示例，保留当前默认三行布局，只开启用户选择的可选项：

```json
{
  "language": "zh",
  "rows": [
    ["model", "contextBar", "contextValue"],
    ["project", "addedDirs", "git"],
    ["sessionTokens"]
  ],
  "rowOverflow": "truncate",
  "display": {
    "showTools": true,
    "showAgents": true,
    "showTodos": true
  }
}
```

---

## 步骤 7：可选启用 CCR 真实模型 hook

如果检测到用户正在使用 CCR（Claude Code 的 `ANTHROPIC_BASE_URL` / `ANTHROPIC_API_BASE_URL` 和 `~/.claude-code-router/config.json` 的 `HOST` / `PORT` 匹配），检查插件目录中的脚本：

```text
{PLUGIN_VERSION_DIR}/scripts/patch-ccr-session-model.cjs
```

先执行 dry-run，不修改 CCR：

```bash
node "{PLUGIN_VERSION_DIR}/scripts/patch-ccr-session-model.cjs" --dry-run --json
```

如果 dry-run 显示 `targets.ccr.distPatched` 为 `false`，或者 diagnostics 显示 patch 缺失/过旧/结构异常，询问用户：

- header: `CCR 模型`
- question: `检测到你正在使用 CCR，但真实路由模型 hook 尚未启用或需要更新。是否现在启用？这会备份并修补 CCR 的 dist/cli.js，使其写入当前会话 ccr-model.json。`
- multiSelect: false
- options:
  - `启用` — 自动备份并修补 CCR，然后提示重启 CCR
  - `跳过` — 不修改 CCR；HUD 的模型组件会持续提示运行 /claude-hud-plus:setup

只有用户选择 `启用` 后，才执行：

```bash
node "{PLUGIN_VERSION_DIR}/scripts/patch-ccr-session-model.cjs" --apply --json
node --check "<apply 输出里的 targets.ccr.distPath>"
```

成功后提示：

```text
CCR 真实模型 hook 已启用。请运行 ccr restart 或重启 CCR，然后重新发起一次 Claude Code 请求。
```

如果 apply 或 `node --check` 失败，提示用户不要继续使用本次 patch，并建议执行回滚：

```bash
node "{PLUGIN_VERSION_DIR}/scripts/patch-ccr-session-model.cjs" --restore --json
```

不要在用户未确认时自动 patch 全局 CCR。

---

## 步骤 8：验证

写入完成后，执行一次生成的 statusLine 命令 做冒烟验证。

可使用最小 stdin：

```json
{"model":{"display_name":"Opus"},"context_window":{"current_usage":{"input_tokens":45000},"context_window_size":200000},"transcript_path":"/tmp/test.jsonl"}
```

如果命令有输出，提示用户：

```text
配置已完成。请完全重启 Claude Code，让新的 statusLine 配置生效。
```

然后询问：

- header: `验证`
- question: `重启后，HUD 是否已经显示在输入框下方？`
- multiSelect: false
- options:
  - `正常显示` — 结束 setup
  - `没有显示` — 进入故障排查

---

## 故障排查

### HUD 没显示

请用户确认：

1. 是否完全重启了 Claude Code。
2. `~/.claude/settings.json` 是否包含 `statusLine.command`。
3. 插件是否已安装：`/plugin list`。
4. Node.js 是否可用：`node --version`。
5. 生成的 command 是否能在终端里单独运行。

### Windows 没显示

优先检查：

- `statusline.ps1` 是否存在。
- PowerShell 执行策略是否允许 `-ExecutionPolicy Bypass`。
- 包装脚本中的插件版本目录匹配规则是否能找到版本目录。
- Node.js 是否在当前 shell 的 PATH 中。

### 终端宽度异常

默认情况下，statusLine 命令会在每次运行时动态探测终端宽度，并通过 `CLAUDE_HUD_TERMINAL_WIDTH` 传给 HUD，用户不需要手动设置。

如果确实需要兜底或强制宽度，请在 HUD 配置文件中设置：

```json
{
  "maxWidth": 140,
  "forceMaxWidth": false
}
```

其中 `maxWidth` 只在终端宽度探测失败时作为兜底；如果要强制使用固定宽度，再设置 `forceMaxWidth: true`。

### 路由模型没有显示真实模型

说明：Claude HUD Plus 只读取路由层写入的状态文件，不默认 patch 全局 `node_modules`。

检查：

```text
~/.claude-code-router/config.json
~/.claude/projects/<project>/<sessionId>/ccr-model.json
```

HUD 会先确认 Claude Code 当前 `ANTHROPIC_BASE_URL` / `ANTHROPIC_API_BASE_URL` 和 CCR 配置中的 `HOST` / `PORT` 匹配，再读取当前会话级模型状态文件。如果地址不匹配，会显示 Claude Code 原始模型；如果地址匹配但会话状态文件不存在，模型组件会提示运行 `/claude-hud-plus:setup` 启用真实模型 hook。

---

## 完成提示

成功时回复：

```text
Claude HUD Plus 已配置完成。请重启 Claude Code，如果仍未显示，再重新运行 /claude-hud-plus:setup 做诊断。
```

不要主动运行 GitHub star、清理所有插件注册表、删除用户配置等高风险操作；这些操作必须先得到用户明确确认。

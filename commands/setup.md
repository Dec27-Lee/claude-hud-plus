---
description: 将 claude-hud-plus 配置为 Claude Code statusLine
allowed-tools: Bash, Read, Write, Edit, AskUserQuestion
---

# 配置 Claude HUD Plus 状态栏

目标：把 `claude-hud-plus` 配置为 Claude Code 的 `statusLine`，并尽量保留用户已有配置。

技术标识、命令、路径、环境变量保持英文；面向用户的问题、选项、提示和故障排查说明使用中文。

重要边界：

- setup 只配置 HUD 和可选的 CCR 模型 hook，不主动切换 Claude Code 的连接模式。
- 不要自动修改 `ANTHROPIC_BASE_URL`、`ANTHROPIC_AUTH_TOKEN`、CCR `HOST` / `PORT`，除非用户明确要求。
- 不要自动重启 CCR、杀进程、切端口；如需处理运行中的 CCR 服务，先说明 PID 和原因，让用户确认或手动处理。
- 如果用户手动切到直连模式保护当前会话，不要覆盖回 CCR。

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

## 步骤 1：确认插件已安装并启用

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

如果插件已安装，后续写入 `settings.json` 时必须确保：

```json
{
  "enabledPlugins": {
    "claude-hud-plus@claude-hud-plus": true
  }
}
```

同时清理旧原版 HUD 残留：

- 删除 `enabledPlugins.claude-hud@claude-hud`
- 删除 `extraKnownMarketplaces.claude-hud`
- 如果 `statusLine.command` 指向 `claude-hud/context-window-wrapper.mjs` 或 `/plugins/claude-hud/`，替换为 Plus

不要删除 `claude-hud-plus` 的缓存、注册表或配置文件。

---

## 步骤 2：检测 JavaScript 运行时

优先使用 Node.js 18+。不要把 `node --version` 和 `bun --version` 串在同一条命令里，否则 Bun 不存在会让整条检测显示失败。

推荐流程：

1. 先执行：

```bash
node --version
```

2. 如果 Node.js 可用且版本 >= 18，直接使用 Node.js，不再检测 Bun。
3. 只有 Node.js 不可用时，macOS / Linux 才尝试：

```bash
bun --version
```

Windows 上如果没有 Node.js，提示：

```powershell
winget install OpenJS.NodeJS.LTS
```

然后要求用户重启 shell，再重新运行 `/claude-hud-plus:setup`。

---

## 步骤 3：定位最新插件版本目录

### macOS / Linux / Git Bash

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

## 步骤 4：生成并验证 statusLine 命令

生成的命令必须动态查找最新安装版本，这样插件更新后不需要重新 setup。

重要顺序：

1. 先写入或更新 wrapper。
2. 单独冒烟验证 wrapper 能运行。
3. wrapper 验证通过后，再写入 `settings.json`。

不要先改 `settings.json` 再补写 wrapper，否则中途失败会让 Claude Code 指向不存在或旧脚本。

### macOS / Linux / Git Bash

推荐命令模式：

```bash
bash -c 'cols=$( (stty size </dev/tty) 2>/dev/null | awk '\''{print $2}'\'' ); if [ -n "$cols" ] && [ "$cols" -gt 4 ]; then export CLAUDE_HUD_TERMINAL_WIDTH=$((cols - 4)); fi; plugin_dir=$(ls -1d "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/*/claude-hud-plus/*/ 2>/dev/null | sort -V | tail -1); exec "{RUNTIME_PATH}" "${plugin_dir}{SOURCE}"'
```

其中：

- `{RUNTIME_PATH}` 替换为检测到的 `node` 或 `bun`
- `{SOURCE}` 通常是 `dist/index.js`
- `CLAUDE_HUD_TERMINAL_WIDTH` 由命令每次从当前终端动态探测并传给 HUD；用户不需要手动设置宽度
- `stty` 的 stderr 必须整体静默，避免没有 `/dev/tty` 时污染 HUD 输出

### Windows PowerShell

Windows 推荐写入包装脚本：

```powershell
$claudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }
$wrapperDir = Join-Path $claudeDir "plugins\claude-hud-plus"
$wrapperPath = Join-Path $wrapperDir "statusline.ps1"
New-Item -ItemType Directory -Force -Path $wrapperDir | Out-Null
```

包装脚本内容固定为：

```powershell
$ErrorActionPreference = 'Stop'

$claudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME '.claude' }
$cacheRoot = Join-Path $claudeDir 'plugins\cache'
$pluginDir = Get-ChildItem (Join-Path $cacheRoot '*\claude-hud-plus\*') -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match '^\d+(\.\d+)+$' } |
  Sort-Object { [version]$_.Name } -Descending |
  Select-Object -First 1

if (-not $pluginDir) {
  Write-Error '没有找到 claude-hud-plus 的插件缓存目录。请先确认插件已安装并执行 /reload-plugins。'
  exit 1
}

try {
  $width = [Console]::WindowWidth
  if ($width -gt 4) {
    $env:CLAUDE_HUD_TERMINAL_WIDTH = [string]($width - 4)
  }
} catch {}

$entry = Join-Path $pluginDir.FullName 'dist\index.js'
if (-not (Test-Path $entry)) {
  Write-Error "claude-hud-plus entry file was not found: $entry"
  exit 1
}

$stdin = [Console]::In.ReadToEnd()
if ($stdin.Length -gt 0) {
  $stdin | & node $entry
} else {
  & node $entry
}
exit $LASTEXITCODE
```

注意：不要删掉 stdin 透传逻辑。Claude Code 的 statusLine 会通过 stdin 传 JSON，wrapper 必须把 stdin 传给 `node dist/index.js`。

statusLine 命令使用：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{WRAPPER_PATH}"
```

### wrapper 冒烟验证

wrapper 写入后、修改 `settings.json` 前，先运行最小 stdin 冒烟验证。

冒烟验证只验证 HUD 命令能运行，不验证 CCR 真实模型。为了避免假 transcript 触发 `CCR model hook missing`，验证时临时清空当前子进程的 CCR 环境变量。

Git Bash 示例：

```bash
env -u ANTHROPIC_BASE_URL -u ANTHROPIC_API_BASE_URL \
  bash -c 'printf "%s" '\''{"model":{"display_name":"Opus"},"context_window":{"current_usage":{"input_tokens":45000},"context_window_size":200000},"transcript_path":"/tmp/test.jsonl"}'\'' | {GENERATED_COMMAND}'
```

如果验证仍输出 `CCR model hook missing`，不要据此判断 setup 失败；这只说明验证命令继承了 CCR 环境或使用了假的 transcript。继续到 CCR 专项诊断。

---

## 步骤 5：写入 settings.json

读取用户设置文件：

```text
~/.claude/settings.json
```

或使用 `CLAUDE_CONFIG_DIR` 指定的目录。

写入前先备份：

```text
~/.claude/settings.json.bak-YYYYMMDD-HHMMSS
```

必须保留 settings 中已有的其他字段。

写入或更新：

```json
{
  "enabledPlugins": {
    "claude-hud-plus@claude-hud-plus": true
  },
  "statusLine": {
    "type": "command",
    "command": "{GENERATED_COMMAND}"
  }
}
```

同时清理旧原版 HUD 残留：

```text
enabledPlugins.claude-hud@claude-hud
extraKnownMarketplaces.claude-hud
statusLine.command 中的 claude-hud/context-window-wrapper.mjs
```

不要默认覆盖用户已有 `env`，尤其不要主动修改：

```text
ANTHROPIC_BASE_URL
ANTHROPIC_API_BASE_URL
ANTHROPIC_AUTH_TOKEN
ANTHROPIC_MODEL
ANTHROPIC_DEFAULT_*_MODEL
```

如果用户启用了 Plus context window 覆盖，可合并写入：

```json
{
  "env": {
    "CLAUDE_HUD_CONTEXT_WINDOW_SIZE": "270000"
  }
}
```

终端宽度默认由 statusLine 命令动态探测，不要把固定宽度写入 settings env。

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

保存配置时保留用户已有未知字段和高级配置，不要用示例整体覆盖。

---

## 步骤 7：可选启用 CCR 真实模型 hook

只有检测到用户正在使用 CCR 时才进入本步骤。检测条件是：Claude Code 当前 `ANTHROPIC_BASE_URL` / `ANTHROPIC_API_BASE_URL` 和 `~/.claude-code-router/config.json` 的 `HOST` / `PORT` 匹配。

如果用户当前是直连模式（例如 base URL 指向外部服务而不是本机 CCR），不要切回 CCR，也不要修改连接配置。只提示：`当前 Claude Code 不是通过本机 CCR 连接，已跳过 CCR hook 检查。`

检查插件目录中的脚本：

```text
{PLUGIN_VERSION_DIR}/scripts/patch-ccr-session-model.cjs
```

先执行 dry-run，不修改 CCR：

```bash
node "{PLUGIN_VERSION_DIR}/scripts/patch-ccr-session-model.cjs" --dry-run --json
```

### 7.1 磁盘 patch 状态

如果 dry-run 显示 `targets.ccr.distPatched` 为 `false`，或者 diagnostics 显示 patch 缺失/过旧/结构异常，询问用户：

- header: `CCR 模型`
- question: `检测到你正在使用 CCR，但真实路由模型 hook 尚未启用或需要更新。是否现在启用？这会备份并修补 CCR 的 dist/cli.js，使其写入当前会话 ccr-model.json。`
- multiSelect: false
- options:
  - `启用` — 自动备份并修补 CCR，然后提示重启 CCR
  - `跳过` — 不修改 CCR；如果当前会话缺少 `ccr-model.json`，HUD 会继续明确显示 CCR 模型状态异常

只有用户选择 `启用` 后，才执行：

```bash
node "{PLUGIN_VERSION_DIR}/scripts/patch-ccr-session-model.cjs" --apply --json
node --check "<apply 输出里的 targets.ccr.distPath>"
```

如果 apply 或 `node --check` 失败，提示用户不要继续使用本次 patch，并建议执行回滚：

```bash
node "{PLUGIN_VERSION_DIR}/scripts/patch-ccr-session-model.cjs" --restore --json
```

不要在用户未确认时自动 patch 全局 CCR。

### 7.2 运行中 CCR 服务状态

`distPatched: true` 只说明磁盘文件已 patch，不代表当前运行中的 CCR 服务已经加载补丁。必须继续检查运行中服务状态。

Windows 检查示例：

```bash
cmd.exe //c "netstat -ano | findstr :3456"
```

同时读取：

```text
~/.claude-code-router/.claude-code-router.pid
~/.claude-code-router/runtime/ccr-model-debug.jsonl
```

判断：

- 如果端口监听 PID 和 `.claude-code-router.pid` 一致：提示 `CCR 磁盘文件已 patch；如刚刚 patch 过，请重启 CCR 后重新发起一次 Claude Code 请求。`
- 如果端口监听 PID 和 `.claude-code-router.pid` 不一致：提示 `CCR 已 patch，但当前运行中的 CCR 服务状态错位。真实监听 PID 是 <PID>，pid 文件是 <PID_FILE>。请结束真实监听 PID 后执行 ccr start。`
- 如果 `ccr-model-debug.jsonl` 最近没有新记录，且当前会话没有生成 `ccr-model.json`：提示 `当前请求没有进入 patched CCR 写入逻辑，通常是运行中的旧 CCR 进程未重启或 pid 文件错位。`

不要自动执行以下操作，除非用户明确要求：

```text
ccr restart
taskkill /F
Stop-Process
修改 CCR PORT
修改 Claude Code ANTHROPIC_BASE_URL
```

尤其不要为了绕过无法结束的旧进程而自动切换到 `3457` 或其他端口；如需切端口，必须先问用户。

成功启用或确认 hook 已启用后提示：

```text
CCR 真实模型 hook 已在磁盘启用。请确保运行中的 CCR 服务已重启并加载补丁，然后重新发起一次 Claude Code 请求。
```

---

## 步骤 8：最终验证

最终验证分两类，避免互相误导。

### 8.1 HUD 命令验证

执行生成的 statusLine 命令，临时清空 CCR 环境变量，只验证 HUD 命令能输出：

```json
{"model":{"display_name":"Opus"},"context_window":{"current_usage":{"input_tokens":45000},"context_window_size":200000},"transcript_path":"/tmp/test.jsonl"}
```

如果命令有 HUD 输出，说明 statusLine 命令可运行。

### 8.2 CCR 真实模型验证

只有用户当前通过本机 CCR 连接时才做。不要用 `/tmp/test.jsonl` 判断 CCR hook 是否成功。

真实模型成功的判断标准是：重新发起一次 Claude Code 请求后，当前会话目录生成新鲜文件：

```text
~/.claude/projects/<project>/<sessionId>/ccr-model.json
```

并且 HUD 第一行显示真实路由模型，例如：

```text
[gpt-5.5] ████████░░ 82% (222k/270k)
```

如果没有生成新文件，但 dry-run 显示 `distPatched: true`，优先按“运行中 CCR 服务状态”排查，不要让用户反复运行 `/claude-hud-plus:setup`。

完成后提示用户：

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
3. `enabledPlugins.claude-hud-plus@claude-hud-plus` 是否为 `true`。
4. 插件是否已安装：`/plugin list`。
5. Node.js 是否可用：`node --version`。
6. 生成的 command 是否能在终端里单独运行。

### Windows 没显示

优先检查：

- `statusline.ps1` 是否存在。
- PowerShell 执行策略是否允许 `-ExecutionPolicy Bypass`。
- 包装脚本中的插件版本目录匹配规则是否能找到版本目录。
- wrapper 是否保留 stdin 透传。
- Node.js 是否在当前 shell 的 PATH 中。

### 旧 claude-hud 又回来了

如果 `settings.json` 又出现：

```text
enabledPlugins.claude-hud@claude-hud
extraKnownMarketplaces.claude-hud
statusLine.command = ...claude-hud/context-window-wrapper.mjs
```

说明用户或旧命令再次运行了原版 `/claude-hud:setup`。处理方式：

1. 清理旧原版 HUD 残留。
2. 保留 `claude-hud-plus@claude-hud-plus: true`。
3. 重新写入 Plus statusLine。
4. 提醒用户后续使用 `/claude-hud-plus:setup`，不要使用 `/claude-hud:setup`。

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

说明：Claude HUD Plus 读取路由层写入的当前会话状态文件。

检查：

```text
~/.claude-code-router/config.json
~/.claude-code-router/.claude-code-router.pid
~/.claude-code-router/runtime/ccr-model-debug.jsonl
~/.claude/projects/<project>/<sessionId>/ccr-model.json
```

HUD 会先确认 Claude Code 当前 `ANTHROPIC_BASE_URL` / `ANTHROPIC_API_BASE_URL` 和 CCR 配置中的 `HOST` / `PORT` 匹配，再读取当前会话级模型状态文件。

如果地址不匹配，说明用户当前不是通过本机 CCR 连接；这属于连接模式问题，应明确提示当前没有使用本机 CCR，而不是自动改用户连接配置。

如果地址匹配但会话状态文件不存在：

1. 先确认 `patch-ccr-session-model.cjs --dry-run --json` 是否显示 `distPatched: true`。
2. 再确认真实监听端口 PID 是否和 `.claude-code-router.pid` 一致。
3. 如果 PID 不一致，结束真实监听 PID 后重新 `ccr start`。
4. 重启后重新发起一次 Claude Code 请求，再检查是否生成 `ccr-model.json`。

不要把 `/tmp/test.jsonl` 的冒烟结果当作 CCR hook 失败证据。

---

## 完成提示

成功时回复：

```text
Claude HUD Plus 已配置完成。请重启 Claude Code，如果仍未显示，再重新运行 /claude-hud-plus:setup 做诊断。
```

不要主动运行 GitHub star、清理所有插件注册表、删除用户配置、切换 CCR 端口、重启/结束 CCR 服务等高风险操作；这些操作必须先得到用户明确确认。

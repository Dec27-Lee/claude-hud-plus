# Claude HUD Plus

Claude HUD Plus 是一个基于官方 Claude HUD 的增强型 Claude Code 状态栏，重点优化 API 路由模型显示、长会话诊断和多终端显示稳定性。

一个 Claude Code 插件，实时显示正在发生的事情——上下文使用率、活跃工具、运行中的 Agent 和待办进度。始终在你的输入下方可见。

<img width="1785" height="1349" alt="image" src="https://github.com/user-attachments/assets/9654b425-4a96-4a5a-8275-c9195be1e8a4" />


> 🌐 [英文 README](README.md) | 中文文档

## Plus 增强

Claude HUD Plus 保持上游 Claude HUD 代码作为基线，并增加面向路由和长会话场景的源码级能力：

- **真实路由模型显示**：当 Claude Code 的 `ANTHROPIC_BASE_URL` / `ANTHROPIC_API_BASE_URL` 与 CCR 配置的 `HOST` / `PORT` 匹配时，读取当前会话目录的 `ccr-model.json`。
- **上下文窗口（context window）覆盖**：设置 `CLAUDE_HUD_CONTEXT_WINDOW_SIZE=270000` 可覆盖展示用上下文窗口，并重算使用百分比。
- **终端宽度稳定性**：默认动态探测终端宽度；只有需要兜底或强制宽度时，才在 HUD 配置中设置 `maxWidth` / `forceMaxWidth`。

路由模型显示不需要额外配置开关。HUD 会自动对比 Claude Code 当前请求地址和 `~/.claude-code-router/config.json` 中的 CCR 监听地址；只有确认当前会话正在走 CCR 时，才读取当前会话级模型状态文件。如果正在走 CCR 但会话状态文件缺失，模型组件会显示 `CCR真实模型未启用：运行 /claude-hud-plus:setup`，避免把 Claude Code 原始请求模型误显示为真实路由模型。

可选环境变量：

```bash
CLAUDE_HUD_CONTEXT_WINDOW_SIZE=270000
```

路由层需要负责写入会话级状态文件；Claude HUD Plus 只读取约定文件，不默认静默修改全局 `node_modules` 或路由器打包文件。需要启用 CCR 会话模型 hook 时，运行 `/claude-hud-plus:setup` 并按提示确认。

## 安装

在 Claude Code 实例中，运行以下命令：

**步骤 1：添加市场**
```
/plugin marketplace add Dec27-Lee/claude-hud-plus
```

**步骤 2：安装插件**

<details>
<summary><strong>⚠️ Linux 用户：请先点击此处</strong></summary>

在 Linux 上，`/tmp` 通常是独立的文件系统（tmpfs），这会导致插件安装失败并报错：
```
EXDEV: cross-device link not permitted
```

**修复方法**：在安装前设置 TMPDIR：
```bash
mkdir -p ~/.cache/tmp && TMPDIR=~/.cache/tmp claude
```

然后在该会话中运行下面的安装命令。这是 [Claude Code 平台的限制](https://github.com/anthropics/claude-code/issues/14799)。

</details>

```
/plugin install claude-hud-plus
```

安装完成后，重新加载插件：

```
/reload-plugins
```

**步骤 3：配置状态栏**
```
/claude-hud-plus:setup
```

<details>
<summary><strong>⚠️ Windows 用户：如果 setup 提示未找到 JavaScript 运行时，请点击此处</strong></summary>

在 Windows 上，Claude HUD setup 支持的运行时是 Node.js LTS。如果 setup 提示未找到 JavaScript 运行时，请先为你的 shell 安装 Node.js：
```powershell
winget install OpenJS.NodeJS.LTS
```
然后重启 shell 并再次运行 `/claude-hud-plus:setup`。

</details>

完成！重启 Claude Code 以加载新的 statusLine 配置，HUD 将会出现。

在 Windows 上，setup 写入新的 `statusLine` 配置后，请完整重启 Claude Code。

---

## 什么是 Claude HUD？

Claude HUD 让你在 Claude Code 会话中获得更清晰的洞察。

| 你看到的内容 | 为什么重要 |
|--------------|------------|
| **项目路径** | 知道你当前在哪个项目中（可配置 1-3 级目录深度） |
| **上下文健康度** | 在上下文窗口满之前准确了解还剩多少 |
| **工具活动** | 实时观察 Claude 读取、编辑和搜索文件 |
| **Agent 追踪** | 查看哪些子 Agent 正在运行以及它们在做什么 |
| **待办进度** | 实时跟踪任务完成情况 |

## 显示效果

### 默认（三行，可配置）
```
[Opus] █████░░░░░ 45% (90k/200k)
my-project git:(main*)
Tokens 145.2M (in: 11.4M, out: 378k, cache: 133.4M)
```
- **第 1 行** — 模型、上下文进度条和上下文数值
- **第 2 行** — 项目路径、额外工作目录和 git 分支（未使用 `/add-dir` 时只显示项目与 Git）
- **第 3 行** — 当前会话累计 Token

布局由 `config.json` 中的 `rows` 定义，想显示几行、每行包含哪些组件都可以调整。Claude Code 原生的权限模式提示（如 bypass permissions）不属于 HUD 输出，不需要在这里配置。

### 可选行（通过 `/claude-hud-plus:configure` 启用）
```
◐ Edit: auth.ts | ✓ Read ×3 | ✓ Grep ×2        ← 工具活动
◐ explore [haiku]: 查找认证代码（2分15秒）       ← Agent 状态
▸ 修复认证漏洞（2/5）                             ← 待办进度
```

---

## 工作原理

Claude HUD 使用 Claude Code 原生的**状态栏接口**——无需独立窗口，不需要 tmux，在任何终端都能工作。

```
Claude Code → stdin JSON → claude-hud-plus → stdout → 在终端中显示
           ↘ transcript JSONL（工具、Agent、待办）
```

**核心特性：**
- 来自 Claude Code 的原生 Token 数据（非估算）
- 适配 Claude Code 报告的上下文窗口大小，包括最新的 1M 上下文会话
- 解析转录文件以获取工具/Agent 活动
- 约每 300ms 更新一次

---

## 配置

随时自定义你的 HUD：

```
/claude-hud-plus:configure
```

引导式配置涵盖行布局、语言和常用显示开关。高级选项如自定义颜色和阈值仍然保留，但你需要直接编辑配置文件来设置它们：

- **首次设置**：选择预设（完整/核心/极简），选择标签语言，然后微调各个元素
- **随时自定义**：开关各项、调整 Git 显示样式、调整 `rows` 行布局或更改标签语言
- **保存前预览**：在提交更改前精确预览 HUD 的效果

### 预设

| 预设 | 显示内容 |
|------|----------|
| **完整** | 全部启用——工具、Agent、待办、Git、使用率、时长 |
| **核心** | 活动行 + Git 状态，减少信息冗余 |
| **极简** | 仅核心——只有模型名称和上下文进度条 |

选择预设后，你可以单独开启或关闭各个元素。

### 手动配置

直接编辑 `~/.claude/plugins/claude-hud-plus/config.json` 来配置高级选项，如 `rows`、`rowOverflow`、`colors.*`、`pathLevels`、阈值覆盖、`display.timeFormat` 以及 `display.promptCacheTtlSeconds`。运行 `/claude-hud-plus:configure` 时会保留这些手动设置，同时你仍可更改 `language`、行布局和常用引导式开关。

中文 HUD 标签作为默认关闭、需显式启用的选项提供。除非你在 `/claude-hud-plus:configure` 中选择 `中文` 或在配置中设置 `language`，否则默认使用英文。

### 选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `language` | `en` \| `zh` | `en` | HUD 标签语言。默认为英文；设为 `zh` 启用中文标签 |
| `rows` | string[][] | `[["model","contextBar","contextValue"],["project","addedDirs","git"],["sessionTokens"]]` | HUD 行布局；外层数组定义行，内层数组定义该行显示的组件 |
| `rowOverflow` | `truncate` \| `wrap` | `truncate` | 行超出终端宽度时截断，或在可分隔处换行 |
| `pathLevels` | 1-3 | 1 | 项目路径显示的目录层级数 |
| `maxWidth` | number \| null | null | 终端宽度探测失败时的兜底宽度；默认不设置，优先动态读取实际终端宽度 |
| `forceMaxWidth` | boolean | false | 是否强制使用 `maxWidth` 覆盖动态探测到的终端宽度 |
| `elementOrder` | string[] | legacy | 旧展开布局的内部兼容字段；新配置请使用 `rows` |
| `display.mergeGroups` | string[][] | legacy | 旧展开布局的内部兼容字段；新配置请使用 `rows` 控制行组合 |
| `gitStatus.enabled` | boolean | true | 在 HUD 中显示 git 分支 |
| `gitStatus.showDirty` | boolean | true | 显示 `*` 表示未提交的更改 |
| `gitStatus.showAheadBehind` | boolean | false | 显示 `↑N ↓N` 表示领先/落后远程的提交数 |
| `gitStatus.pushWarningThreshold` | number | 0 | 当未推送提交数达到此值时，用警告色显示 ahead 计数（`0` 表示禁用） |
| `gitStatus.pushCriticalThreshold` | number | 0 | 当未推送提交数达到此值时，用严重色显示 ahead 计数（`0` 表示禁用） |
| `gitStatus.showFileStats` | boolean | false | 显示文件变更数量 `!M +A ✘D ?U` |
| `gitStatus.branchOverflow` | `truncate` \| `wrap` | `truncate` | 保持当前截断行为，或在可能时让 git 块以自己的换行边界单独换到下一行 |
| `display.showModel` | boolean | true | 显示模型名称 `[Opus]` |
| `display.showAddedDirs` | boolean | true | 显示 `/add-dir` 添加的额外工作目录，例如 `+sparkle +lib-foo`；没有额外目录时不输出 |
| `display.addedDirsLayout` | `inline` \| `line` | `inline` | `inline` 会把额外目录放在项目名旁边；`line` 会渲染为独立的 `Added dirs: name1, name2` 行 |
| `display.showContextBar` | boolean | true | 显示可视化上下文进度条 `████░░░░░░` |
| `display.contextValue` | `percent` \| `tokens` \| `remaining` \| `both` | `both` | 上下文显示格式（`45%`、`45k/200k`、剩余 `55%` 或 `45% (45k/200k)`） |
| `display.showConfigCounts` | boolean | false | 显示 CLAUDE.md、rules、MCPs、hooks 数量 |
| `display.showCost` | boolean | false | 使用 Claude Code 原生提供的 `cost.total_cost_usd` 显示会话费用（可用时），并附带本地估算回退方案 |
| `display.showOutputStyle` | boolean | false | 从配置文件显示当前 Claude Code `outputStyle`，中文标签下格式为 `样式: <名称>` |
| `display.showDuration` | boolean | false | 显示会话时长 `⏱️ 5m` |
| `display.showSpeed` | boolean | false | 显示输出 Token 速度 `out: 42.1 tok/s` |
| `display.showUsage` | boolean | true | 显示 Claude 订阅用户的使用率限制（可用时） |
| `display.usageValue` | `percent` \| `remaining` | `percent` | 使用率显示格式：显示已用百分比，或显示剩余额度 |
| `display.usageBarEnabled` | boolean | true | 将使用率显示为可视化进度条而非文本 |
| `display.usageCompact` | boolean | false | 使用更短的文本形式显示使用率，例如 `5h: 25% (1h 30m)`；优先级高于 `display.usageBarEnabled` |
| `display.showResetLabel` | boolean | true | 显示使用率倒计时前缀，例如中文 `后重置` 或英文 `resets in` |
| `display.timeFormat` | `relative` \| `absolute` \| `both` | `relative` | 控制使用率重置时间的显示方式：仅倒计时（如 `2小时30分后重置`）、显示墙钟时间（如 `14:30 重置`），或同时显示两者 |
| `display.sevenDayThreshold` | 0-100 | 80 | 当 7 天使用率 ≥ 阈值时显示（0 = 始终显示） |
| `display.externalUsagePath` | string | `""` | 可选的本地使用率快照文件路径，仅在 stdin `rate_limits` 缺失时使用 |
| `display.externalUsageFreshnessMs` | number | `300000` | 外部使用率快照允许的最长存活时间，超时后会被忽略 |
| `display.showTokenBreakdown` | boolean | true | 在高上下文时（85%+）显示 Token 详情 |
| `display.showTools` | boolean | false | 显示工具活动行 |
| `display.showAgents` | boolean | false | 显示 Agent 活动行 |
| `display.showTodos` | boolean | false | 显示待办进度行 |
| `display.showSessionName` | boolean | false | 显示会话 slug 或 `/rename` 设置的自定义标题 |
| `display.showSessionTokens` | boolean | true | 显示当前会话累计 Token；默认 rows 的第三行使用它 |
| `display.showSessionStartDate` | boolean | false | 显示 transcript 会话开始时间 |
| `display.showLastResponseAt` | boolean | false | 显示距最后一次 assistant 响应过去了多久 |
| `display.showClaudeCodeVersion` | boolean | false | 显示已安装的 Claude Code 版本，如 `CC v2.1.81` |
| `display.showMemoryUsage` | boolean | false | 当 `rows` 中包含 `"memory"` 时显示近似系统 RAM 使用行 |
| `display.showPromptCache` | boolean | false | 根据 transcript 中最后一次 assistant 响应时间显示提示缓存倒计时 |
| `display.promptCacheTtlSeconds` | number | `300` | 提示缓存 TTL 秒数。Pro 保持默认值，Max 可设为 `3600` |
| `colors.context` | 颜色值 | `green` | 上下文进度条和百分比的基础颜色 |
| `colors.usage` | 颜色值 | `brightBlue` | 使用率进度条和低于警告阈值时百分比的颜色 |
| `colors.warning` | 颜色值 | `yellow` | 上下文阈值和使用率警告文本的警告颜色 |
| `colors.usageWarning` | 颜色值 | `brightMagenta` | 使用率进度条和接近阈值时百分比的警告颜色 |
| `colors.critical` | 颜色值 | `red` | 达到限制状态和严重阈值的颜色 |
| `colors.model` | 颜色值 | `cyan` | 模型徽章颜色，如 `[Opus]` |
| `colors.project` | 颜色值 | `yellow` | 项目路径的颜色 |
| `colors.git` | 颜色值 | `magenta` | Git 包装文本的颜色，如 `git:(` 和 `)` |
| `colors.gitBranch` | 颜色值 | `cyan` | Git 分支和分支状态文本的颜色 |
| `colors.label` | 颜色值 | `dim` | 标签和次要元数据的颜色，如 `上下文`、`使用率`、计数和进度文本 |
| `colors.custom` | 颜色值 | `208` | 可选自定义行的颜色 |
| `colors.barFilled` | string | `█` | 进度条已填充部分使用的字符 |
| `colors.barEmpty` | string | `░` | 进度条空白部分使用的字符 |

`colors.barFilled` 和 `colors.barEmpty` 只接受单个可见字素。控制字符、不可见格式字符、换行分隔符和非字符会被拒绝。宽字符（emoji、CJK）在不同终端中可能影响对齐。

支持的颜色名称：`dim`、`red`、`green`、`yellow`、`magenta`、`cyan`、`brightBlue`、`brightMagenta`。你也可以使用 256 色数字（`0-255`）或十六进制（`#rrggbb`）。

`display.showMemoryUsage` 默认关闭、需显式启用；启用后可通过在 `rows` 中加入 `"memory"` 渲染。它报告本地机器的近似系统 RAM 使用情况，而非 Claude Code 或特定进程内的精确内存压力。由于可回收的 OS 缓存缓冲区仍可能被计入已用内存，该数字可能高估实际压力。

`display.showCost` 默认关闭、需显式启用。ClaudeHUD 优先使用 Claude Code 在 stdin 上提供的原生 `cost.total_cost_usd` 字段（可用时）。如果该字段缺失或对直连 Anthropic 会话无效，ClaudeHUD 会回退到现有的基于本地转录文件的估算方案，确保费用行在旧负载下仍能工作。原生字段在会话中首个 API 响应之前为空，因此费用显示可能在响应到达前保持隐藏。对于已知的路由提供商（如 Bedrock、Vertex AI），ClaudeHUD 也会隐藏费用显示，因为云提供商计费会话可能报告 `$0.00` 或省略该字段，即使会话并非真正免费。

`display.showPromptCache` 默认关闭、需显式启用。启用后，ClaudeHUD 会读取本地 transcript 中最后一次 assistant 响应的时间戳，并显示距离提示缓存过期还剩多久。默认 TTL 为 5 分钟（`300` 秒）。如果你想按 1 小时的 Max 风格窗口显示，可将 `display.promptCacheTtlSeconds` 设为 `3600`。如果 transcript 里还没有 assistant 时间戳，这个元素会继续隐藏。

### 使用率限制

当 Claude Code 在 stdin 上提供订阅用户 `rate_limits` 数据时，使用率组件默认可用。若要显示它，请在 `rows` 中加入 `"usage"`，例如追加 `["usage"]` 或把它放到上下文行。

将 `display.usageValue` 设为 `remaining` 可显示剩余额度，而不是已用百分比。警告颜色和 7 天阈值判断仍使用底层已用百分比。

ClaudeHUD 优先使用官方状态栏 stdin 负载中的使用率数据。如果 `rate_limits` 缺失，你可以通过 `display.externalUsagePath` 显式启用本地旁路快照回退，例如让代理程序写入 JSON 文件。只要 stdin 和本地旁路快照同时存在，stdin 始终优先。

回退快照必须足够新（由 `display.externalUsageFreshnessMs` 控制），并且包含有效的 `updated_at`、`five_hour` 和/或 `seven_day` 字段。非法 JSON、过期文件或非法时间戳都会被静默忽略。

免费/仅限每周账户会单独显示每周窗口，而不是显示幽灵 `5h: --` 占位符。

当 7 天使用率超过 `display.sevenDayThreshold`（默认 80%）时会显示：

```
上下文 █████░░░░░ 45% │ 使用率 ██░░░░░░░░ 25%（1小时30分 / 5小时）| ██████████ 85%（2天 / 7天）
```

如需禁用，请将 `display.showUsage` 设为 `false`。

重置时间默认显示为相对倒计时。将 `display.timeFormat` 设为 `absolute` 可显示墙钟时间，设为 `both` 可同时显示两种形式。该设置目前只能手动编辑；`/claude-hud-plus:configure` 会保留它，但不会修改它。

如果想缩短倒计时，可将 `display.showResetLabel` 设为 `false`，例如显示 `(3h 17m)` 而不是 `(3小时17分后重置)`。

如果想使用更短的使用率文本，可将 `display.usageCompact` 设为 `true`，例如 `5h: 25% (1h 30m)`。紧凑使用率优先级高于 `display.usageBarEnabled`。

**前提条件：**
- Claude Code 必须在当前会话的 stdin 上包含订阅用户 `rate_limits` 数据
- 不适用于仅使用 API 密钥的用户

**故障排查：** 如果使用率不显示：
- 确保你已使用 Claude 订阅账户登录（而非 API 密钥）
- 检查配置中的 `display.showUsage` 未设为 `false`
- API 用户看不到使用率显示（他们按 Token 付费，没有使用率限制）
- AWS Bedrock 模型显示 `Bedrock` 并隐藏使用率限制（使用率由 AWS 管理）
- Google Vertex AI 模型显示 `Vertex` 并隐藏费用估算（定价与 Anthropic 直连不同）
- Claude Code 可能在会话中首个模型响应之前将 `rate_limits` 留空
- 某些 Claude Code 构建版本和订阅层级即使在首个响应之后仍可能省略 `rate_limits`
- 如果你配置了 `display.externalUsagePath`，ClaudeHUD 会先尝试读取该本地快照，再决定是否隐藏使用率
- ClaudeHUD 不会回退到凭据抓取或未记录的 API 调用

回退快照示例：

```json
{
  "updated_at": "2026-04-20T12:00:00.000Z",
  "five_hour": {
    "used_percentage": 42,
    "resets_at": "2026-04-20T15:00:00.000Z"
  },
  "seven_day": {
    "used_percentage": 84,
    "resets_at": "2026-04-27T12:00:00.000Z"
  }
}
```

### 配置示例

```json
{
  "language": "zh",
  "rows": [
    ["model", "contextBar", "contextValue"],
    ["project", "addedDirs", "git"],
    ["sessionTokens"],
    ["tools"],
    ["agents"],
    ["todos"]
  ],
  "rowOverflow": "truncate",
  "pathLevels": 2,
  "gitStatus": {
    "enabled": true,
    "showDirty": true,
    "showAheadBehind": true,
    "showFileStats": true
  },
  "display": {
    "showTools": true,
    "showAgents": true,
    "showTodos": true,
    "showConfigCounts": true,
    "showDuration": true,
    "showMemoryUsage": true
  },
  "colors": {
    "context": "cyan",
    "usage": "cyan",
    "warning": "yellow",
    "usageWarning": "magenta",
    "critical": "red",
    "model": "cyan",
    "project": "yellow",
    "git": "magenta",
    "gitBranch": "cyan",
    "label": "dim",
    "custom": "#FF6600"
  }
}
```

### 项目/Git 显示示例

这些示例展示默认第二行中的项目与 Git 片段；模型和上下文默认在第一行显示。

**1 级（默认）：** `my-project git:(main)`

**2 级：** `apps/my-project git:(main)`

**3 级：** `dev/apps/my-project git:(main)`

**带脏状态指示器：** `my-project git:(main*)`

**带领先/落后：** `my-project git:(main ↑2 ↓1)`

**带文件统计：** `my-project git:(main* !3 +1 ?2)`
- `!` = 修改的文件，`+` = 新增/暂存，`✘` = 删除，`?` = 未跟踪
- 计数为 0 的项会被省略，以保持显示整洁

### 故障排查

**配置不生效？**
- 检查 JSON 语法错误：无效的 JSON 会静默回退到默认值
- 确保值有效：`pathLevels` 必须是 1、2 或 3；`rowOverflow` 必须是 `truncate` 或 `wrap`；`maxWidth` 必须是正数
- 删除配置文件并运行 `/claude-hud-plus:configure` 重新生成

**Git 状态缺失？**
- 验证你是否在 git 仓库中
- 检查配置中的 `gitStatus.enabled` 不为 `false`

**工具/Agent/待办行缺失？**
- 这些默认隐藏——在配置中通过 `showTools`、`showAgents`、`showTodos` 启用
- 它们也仅在有活动可显示时才会出现

**HUD 设置后不显示？**
- 重启 Claude Code 以加载新的 statusLine 配置
- 在 macOS 上，完全退出 Claude Code 并在终端中再次运行 `claude`

---

## 运行环境要求

- Claude Code v1.0.80+
- macOS/Linux：Node.js 18+ 或 Bun
- Windows：Node.js 18+

---

## 开发

```bash
git clone https://github.com/Dec27-Lee/claude-hud-plus
cd claude-hud-plus
npm ci && npm run build
npm test
```

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 许可证

MIT — 详见 [LICENSE](LICENSE)

---

## 收藏趋势

[![收藏历史图](https://api.star-history.com/svg?repos=Dec27-Lee/claude-hud-plus&type=Date)](https://star-history.com/#Dec27-Lee/claude-hud-plus&Date)

---
description: 配置 HUD 显示选项（布局、语言、预设、显示元素），并保留高级手动配置
allowed-tools: Read, Write, AskUserQuestion
---

# 配置 Claude HUD Plus

**第一步**：先用 Read 工具读取 `~/.claude/plugins/claude-hud-plus/config.json`（如果存在）。

记录当前配置，并判断配置文件是否存在：

- 不存在：走“新用户配置流程”。
- 已存在：走“更新现有配置流程”。

高级设置例如 `colors.*`、`colors.contextBands`、`colors.usageBands`、`pathLevels`、`display.timeFormat`、`display.usageThreshold`、`display.usageValue`、`display.environmentThreshold`、`display.contextWarningThreshold`、`display.contextCriticalThreshold` 等，保存时必须保留，不要在引导流程里覆盖。

---

## 固定显示项

这些能力属于核心 HUD，不在向导里关闭：

- 模型名，例如 `[Opus]`
- 上下文进度条，例如 `████░░░░░░ 45%`

---

## 流程 A：新用户配置

当配置文件不存在时，依次询问：

1. 行布局
2. 预设
3. 语言
4. 要关闭的项目
5. 要额外开启的项目
6. 自定义短语

### Q1：行布局

- header: `行布局`
- question: `请选择 HUD 行布局：`
- multiSelect: false
- options:
  - `四行默认（推荐）` — 模型+上下文、项目+Git、会话 Token、工具/Agent/待办四行显示
  - `三行核心` — 只显示模型+上下文、项目+Git、会话 Token 三行
  - `单行核心` — 把模型、上下文、项目和 Git 放在一行

保存规则：

- 四行默认：

```json
{
  "rows": [
    ["model", "contextBar", "contextValue"],
    ["project", "addedDirs", "git"],
    ["sessionTokens"],
    ["tools", "agents", "todos"]
  ],
  "rowOverflow": "truncate",
  "display": {
    "showTools": true,
    "showAgents": true,
    "showTodos": true,
    "showUsage": false
  }
}
```

- 三行核心：

```json
{
  "rows": [
    ["model", "contextBar", "contextValue"],
    ["project", "addedDirs", "git"],
    ["sessionTokens"]
  ],
  "rowOverflow": "truncate",
  "display": {
    "showTools": false,
    "showAgents": false,
    "showTodos": false
  }
}
```

- 单行核心：

```json
{
  "rows": [["model", "contextBar", "contextValue", "project", "git"]],
  "rowOverflow": "truncate"
}
```

### Q2：预设

- header: `预设`
- question: `请选择一个初始配置：`
- multiSelect: false
- options:
  - `完整（推荐）` — 尽可能显示全部信息
  - `核心` — 显示活动和 Git，减少干扰信息
  - `极简` — 只保留模型和上下文核心信息

预设含义：

- 完整：开启工具活动、Agent 状态、待办进度、Git、使用率、会话时长、Token 细分等常用能力
- 核心：保留活动、Git 和关键上下文信息
- 极简：只保留核心模型与上下文显示

### Q3：语言

- header: `语言`
- question: `请选择 HUD 标签语言：`
- multiSelect: false
- options:
  - `中文（推荐）` — HUD 标签和状态文字使用中文
  - `英文` — HUD 标签和状态文字使用英文

保存为：

- 中文：`language: "zh"`
- 英文：`language: "en"`

### Q4：关闭项目

- header: `关闭`
- question: `以下项目当前会启用，需要关闭哪些？`
- multiSelect: true
- options: 只展示当前预设中已开启的项目，最多 4 个

可选项映射：

| 选项 | 配置 |
|---|---|
| 工具活动 | `display.showTools` |
| Agent 状态 | `display.showAgents` |
| 待办进度 | `display.showTodos` |
| 项目名称 | `display.showProject` |
| Git 状态 | `gitStatus.enabled` |
| 配置计数 | `display.showConfigCounts` |
| Token 细分 | `display.showTokenBreakdown` |
| 输出速度 | `display.showSpeed` |
| 使用率限制 | `display.showUsage` |
| 紧凑使用率 | `display.usageCompact` |
| Session 时长 | `display.showSessionTokens` |
| 费用 | `display.showCost` |
| Claude Code 版本 | `display.showClaudeCodeVersion` |
| 记忆/内存 | `display.showMemoryUsage` |
| 提示缓存倒计时 | `display.showPromptCache` |
| 输出风格 | `display.showOutputStyle` |
| 使用率进度条 | `display.usageBarEnabled` |

### Q5：开启项目

- header: `开启`
- question: `以下项目当前未启用，需要额外开启哪些？`
- multiSelect: true
- options: 只展示当前预设中未开启的项目，最多 4 个

映射同 Q4。

如果没有可开启项，提示：`当前预设已启用全部可选项。`

### Q6：自定义短语

- header: `自定义`
- question: `是否在 HUD 中显示一段自定义短语？`
- multiSelect: false
- options:
  - `不显示` — 清空 `display.customLine`
  - `输入短语` — 继续询问短语内容，保存到 `display.customLine`

如果用户选择输入短语，再问：`请输入要显示在 HUD 中的短语：`

---

## 流程 B：更新现有配置

当配置文件已存在时，依次询问：

1. 关闭项目
2. 开启项目
3. Git 显示方式
4. 行布局/重置
5. 语言
6. 自定义短语

### Q1：关闭项目

- header: `关闭`
- question: `当前已启用的项目中，需要关闭哪些？`
- multiSelect: true
- options: 基于当前配置中为 true 的项目生成，最多 4 个

### Q2：开启项目

- header: `开启`
- question: `当前未启用的项目中，需要开启哪些？`
- multiSelect: true
- options: 基于当前配置中为 false 的项目生成，最多 4 个

### Q3：Git 显示

- header: `Git`
- question: `Git 状态应该如何显示？`
- multiSelect: false
- options:
  - `保持当前` — 不修改 Git 设置
  - `基础状态` — 只显示分支和 dirty 标记
  - `详细状态` — 显示分支、dirty、ahead/behind、文件统计
  - `隐藏 Git` — 设置 `gitStatus.enabled: false`

### Q4：行布局/重置

- header: `行布局`
- question: `是否调整行布局或重置为完整配置？`
- multiSelect: false
- options:
  - `保持当前` — 不改 `rows` / `rowOverflow`
  - `四行默认` — 写入默认四行 `rows`，`rowOverflow: "truncate"`，开启工具/Agent/待办并关闭使用率
  - `单行核心` — 写入单行核心 `rows`，`rowOverflow: "truncate"`
  - `重置为完整` — 写入四行默认布局并开启常用显示项

### Q5：语言

- header: `语言`
- question: `请选择 HUD 标签语言：`
- multiSelect: false
- options:
  - `保持当前` — 不修改语言
  - `中文` — 设置 `language: "zh"`
  - `英文` — 设置 `language: "en"`

### Q6：自定义短语

- header: `自定义`
- question: `是否修改 HUD 自定义短语？`
- multiSelect: false
- options:
  - `保持当前` — 不修改 `display.customLine`
  - `清空短语` — 设置 `display.customLine: ""`
  - `输入短语` — 继续询问并保存到 `display.customLine`

---

## 保存规则

保存前必须：

1. 保留用户已有的未知字段和高级手动配置。
2. 只修改本次向导涉及的字段。不要写入 `lineLayout`；布局只通过 `rows` 和 `rowOverflow` 表达。
3. 保持 JSON 缩进为 2 个空格。
4. 写入 `~/.claude/plugins/claude-hud-plus/config.json`。
5. 如果父目录不存在，创建父目录。

保存前询问：

- header: `确认`
- question: `是否保存这些 HUD 配置变更？`
- multiSelect: false
- options:
  - `保存` — 写入配置文件
  - `取消` — 不写入任何内容

用户取消时回复：`已取消配置，未写入任何文件。`

配置没有变化时回复：`无需保存，当前配置没有变化。`

保存成功后回复：`配置已保存，HUD 会在下一次刷新时生效。`

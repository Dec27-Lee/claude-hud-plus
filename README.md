# Claude HUD Plus

Claude HUD Plus is an enhanced Claude Code statusline based on the official Claude HUD, focused on API router model visibility, long-session diagnostics, and stable display across terminal environments.

A Claude Code plugin that shows what's happening — context usage, active tools, running agents, and todo progress. Always visible below your input.

[![License](https://img.shields.io/github/license/Dec27-Lee/claude-hud-plus?v=2)](LICENSE)
[![Stars](https://img.shields.io/github/stars/Dec27-Lee/claude-hud-plus)](https://github.com/Dec27-Lee/claude-hud-plus/stargazers)

![Claude HUD in action](claude-hud-preview-5-2.png)

> 🌐 English | [中文文档](README.zh.md)

## Plus additions

Claude HUD Plus keeps the upstream Claude HUD codebase as its baseline, then adds source-level support for router-heavy and long-running Claude Code sessions:

- **Routed model display**: when Claude Code's `ANTHROPIC_BASE_URL` / `ANTHROPIC_API_BASE_URL` matches the `HOST` / `PORT` in the CCR config, the HUD reads the actual model selected by the router from the current session's `ccr-model.json`.
- **Context window override**: set `CLAUDE_HUD_CONTEXT_WINDOW_SIZE=270000` or another positive integer to override the displayed context window size and recompute usage percentage.
- **Terminal width stability**: terminal width is detected dynamically by default; configure `maxWidth` / `forceMaxWidth` only when detection is unreliable or you want a fixed render width.

Routed model display does not require a manual enable/disable switch. The HUD compares Claude Code's current request URL with the CCR listener in `~/.claude-code-router/config.json`; it only reads the current session's router model state when the current session is confirmed to be using CCR. If CCR is in use but the session state file is missing, the model component shows `CCR model hook missing: run /claude-hud-plus:setup` instead of misleadingly showing Claude Code's requested model as the routed model.

Optional environment variables:

```bash
CLAUDE_HUD_CONTEXT_WINDOW_SIZE=270000
```

The router layer must write session-level state files for the HUD to show actual routed models. Claude HUD Plus reads this contract but does not silently patch global `node_modules` or router bundles by default. To enable the CCR session-model hook, run `/claude-hud-plus:setup` and confirm the prompt.

## Install

Inside a Claude Code instance, run the following commands:

**Step 1: Add the marketplace**
```
/plugin marketplace add Dec27-Lee/claude-hud-plus
```

**Step 2: Install the plugin**

<details>
<summary><strong>⚠️ Linux users: Click here first</strong></summary>

On Linux, `/tmp` is often a separate filesystem (tmpfs), which causes plugin installation to fail with:
```
EXDEV: cross-device link not permitted
```

**Fix**: Set TMPDIR before installing:
```bash
mkdir -p ~/.cache/tmp && TMPDIR=~/.cache/tmp claude
```

Then run the install command below in that session. This is a [Claude Code platform limitation](https://github.com/anthropics/claude-code/issues/14799).

</details>

```
/plugin install claude-hud-plus
```

After that, reload plugins:

```
/reload-plugins
```


**Step 3: Configure the statusline**
```
/claude-hud-plus:setup
```

<details>
<summary><strong>⚠️ Windows users: Click here if setup says no JavaScript runtime was found</strong></summary>

On Windows, Node.js LTS is the supported runtime for Claude HUD setup. If setup says no JavaScript runtime was found, install Node.js for your shell first:
```powershell
winget install OpenJS.NodeJS.LTS
```
Then restart your shell and run `/claude-hud-plus:setup` again.

</details>

Done! Restart Claude Code to load the new statusLine config, then the HUD will appear.

On Windows, make that a full Claude Code restart after setup writes the new `statusLine` config.

---

## What is Claude HUD?

Claude HUD gives you better insights into what's happening in your Claude Code session.

| What You See | Why It Matters |
|--------------|----------------|
| **Project path** | Know which project you're in (configurable 1-3 directory levels) |
| **Context health** | Know exactly how full your context window is before it's too late |
| **Tool activity** | Watch Claude read, edit, and search files as it happens |
| **Agent tracking** | See which subagents are running and what they're doing |
| **Todo progress** | Track task completion in real-time |

## What You See

### Default (3 configurable rows)
```
[Opus] █████░░░░░ 45% (90k/200k)
my-project git:(main*)
Tokens 145.2M (in: 11.4M, out: 378k, cache: 133.4M)
```
- **Line 1** — Model, context bar, and context value
- **Line 2** — Project path and git branch
- **Line 3** — Cumulative session tokens

The layout is defined by `rows` in `config.json`, so you can choose how many lines to render and which components appear on each line. Claude Code's native permission-mode prompt, such as bypass permissions, is not rendered by the HUD.

### Optional lines (enable via `/claude-hud-plus:configure`)
```
◐ Edit: auth.ts | ✓ Read ×3 | ✓ Grep ×2        ← Tools activity
◐ explore [haiku]: Finding auth code (2m 15s)    ← Agent status
▸ Fix authentication bug (2/5)                   ← Todo progress
```

---

## How It Works

Claude HUD uses Claude Code's native **statusline API** — no separate window, no tmux required, works in any terminal.

```
Claude Code → stdin JSON → claude-hud → stdout → displayed in your terminal
           ↘ transcript JSONL (tools, agents, todos)
```

**Key features:**
- Native token data from Claude Code (not estimated)
- Scales with Claude Code's reported context window size, including newer 1M-context sessions
- Parses the transcript for tool/agent activity
- Updates every ~300ms

---

## Configuration

Customize your HUD anytime:

```
/claude-hud-plus:configure
```

The guided flow handles row layout, language, and common display toggles. Advanced overrides such as
custom colors and thresholds are preserved there, but you set them by editing the config file directly:

- **First time setup**: Choose a preset (Full/Essential/Minimal), pick a label language, then fine-tune individual elements
- **Customize anytime**: Toggle items on/off, adjust git display style, update `rows`, or change label language
- **Preview before saving**: See exactly how your HUD will look before committing changes

### Presets

| Preset | What's Shown |
|--------|--------------|
| **Full** | Everything enabled — tools, agents, todos, git, usage, duration |
| **Essential** | Activity lines + git status, minimal info clutter |
| **Minimal** | Core only — just model name and context bar |

After choosing a preset, you can turn individual elements on or off.

### Manual Configuration

Edit `~/.claude/plugins/claude-hud-plus/config.json` directly for advanced settings such as `rows`, `rowOverflow`, `colors.*`,
`pathLevels`, `maxWidth`, threshold overrides, `display.timeFormat`, and `display.promptCacheTtlSeconds`. Running `/claude-hud-plus:configure`
preserves those manual settings while still letting you change `language`, row layout, and the common
guided toggles.

Chinese HUD labels are available as an explicit opt-in. English stays the default unless you choose `中文` in `/claude-hud-plus:configure` or set `language` in config.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `language` | `en` \| `zh` | `en` | HUD label language. English is the default; set `zh` to enable Chinese labels. |
| `rows` | string[][] | `[["model","contextBar","contextValue"],["project","git"],["sessionTokens"]]` | HUD row layout. The outer array defines lines; each inner array defines components on that line. |
| `rowOverflow` | `truncate` \| `wrap` | `truncate` | Truncate overlong rows, or wrap at supported separator boundaries. |
| `pathLevels` | 1-3 | 1 | Directory levels to show in project path |
| `maxWidth` | number \| `null` | `null` | Optional fallback width used only when terminal width detection fails completely |
| `forceMaxWidth` | boolean | false | Always use `maxWidth` when it is set, even if terminal width detection returns a smaller value |
| `elementOrder` | string[] | legacy | Internal compatibility field for the old expanded layout. New configs should use `rows`. |
| `display.mergeGroups` | string[][] | legacy | Internal compatibility field for the old expanded layout. New configs should use `rows` to group components. |
| `gitStatus.enabled` | boolean | true | Show git branch in HUD |
| `gitStatus.showDirty` | boolean | true | Show `*` for uncommitted changes |
| `gitStatus.showAheadBehind` | boolean | false | Show `↑N ↓N` for ahead/behind remote |
| `gitStatus.pushWarningThreshold` | number | 0 | Color the ahead count with the warning color at or above this unpushed-commit count (`0` disables it) |
| `gitStatus.pushCriticalThreshold` | number | 0 | Color the ahead count with the critical color at or above this unpushed-commit count (`0` disables it) |
| `gitStatus.showFileStats` | boolean | false | Show file change counts `!M +A ✘D ?U` |
| `gitStatus.branchOverflow` | `truncate` \| `wrap` | `truncate` | Keep current truncation behavior or let the git block wrap onto its own line boundary when possible |
| `display.showModel` | boolean | true | Show model name `[Opus]` |
| `display.showAddedDirs` | boolean | true | Show extra workspace directories from `/add-dir` (e.g. `+sparkle +lib-foo`); empty array renders nothing. In both layouts at most 5 dirs render (overflow shown as `+N more`) and basenames are truncated to 24 chars with `…` |
| `display.addedDirsLayout` | `inline` \| `line` | `inline` | `inline` puts dirs next to the project name with a `+name` prefix per dir; `line` renders them on a separate `Added dirs: name1, name2` line (no `+` prefix, comma-separated) |
| `display.showContextBar` | boolean | true | Show visual context bar `████░░░░░░` |
| `display.contextValue` | `percent` \| `tokens` \| `remaining` \| `both` | `both` | Context display format (`45%`, `45k/200k`, `55%` remaining, or `45% (45k/200k)`) |
| `display.showConfigCounts` | boolean | false | Show CLAUDE.md, rules, MCPs, hooks counts |
| `display.showCost` | boolean | false | Show session cost using Claude Code's native `cost.total_cost_usd` when available, with a local estimate fallback for direct Anthropic sessions |
| `display.showOutputStyle` | boolean | false | Show the active Claude Code `outputStyle` from settings files as `style: <name>` |
| `display.showDuration` | boolean | false | Show session duration `⏱️ 5m` |
| `display.showSpeed` | boolean | false | Show output token speed `out: 42.1 tok/s` |
| `display.showUsage` | boolean | true | Show Claude subscriber usage limits when available |
| `display.usageValue` | `percent` \| `remaining` | `percent` | Usage display format (`25%` used, or `75%` remaining) |
| `display.usageBarEnabled` | boolean | true | Display usage as visual bar instead of text |
| `display.usageCompact` | boolean | false | Display usage in a shorter text form such as `5h: 25% (1h 30m)`; takes precedence over `display.usageBarEnabled` |
| `display.showResetLabel` | boolean | true | Show the `resets in` prefix before usage countdowns |
| `display.timeFormat` | `relative` \| `absolute` \| `both` | `relative` | How reset times are shown in usage windows: countdown only (`resets in 2h 30m`), wall-clock time (`resets at 14:30`), or both (`resets in 2h 30m, at 14:30`) |
| `display.sevenDayThreshold` | 0-100 | 80 | Show 7-day usage when >= threshold (0 = always) |
| `display.externalUsagePath` | string | `""` | Optional path to a local usage snapshot file used only when stdin `rate_limits` are missing |
| `display.externalUsageFreshnessMs` | number | `300000` | Maximum allowed age for the external usage snapshot before it is ignored |
| `display.showTokenBreakdown` | boolean | true | Show token details at high context (85%+) |
| `display.showTools` | boolean | false | Show tools activity line |
| `display.showAgents` | boolean | false | Show agents activity line |
| `display.showTodos` | boolean | false | Show todos progress line |
| `display.showSessionName` | boolean | false | Show session slug or custom title from `/rename` |
| `display.showSessionTokens` | boolean | true | Show cumulative session tokens; the default third row uses this component |
| `display.showSessionStartDate` | boolean | false | Show the transcript session start timestamp |
| `display.showLastResponseAt` | boolean | false | Show how long ago the last assistant response was written |
| `display.showClaudeCodeVersion` | boolean | false | Show the installed Claude Code version, e.g. `CC v2.1.81` |
| `display.showMemoryUsage` | boolean | false | Show an approximate system RAM usage row when `"memory"` is included in `rows` |
| `display.showPromptCache` | boolean | false | Show a prompt cache countdown based on the last assistant response timestamp in the transcript |
| `display.promptCacheTtlSeconds` | number | `300` | Prompt cache TTL in seconds. Keep the default for Pro, set `3600` for Max |
| `colors.context` | color value | `green` | Base color for the context bar and context percentage |
| `colors.usage` | color value | `brightBlue` | Base color for usage bars and percentages below warning thresholds |
| `colors.warning` | color value | `yellow` | Warning color for context thresholds and usage warning text |
| `colors.usageWarning` | color value | `brightMagenta` | Warning color for usage bars and percentages near their threshold |
| `colors.critical` | color value | `red` | Critical color for limit-reached states and critical thresholds |
| `colors.model` | color value | `cyan` | Color for the model badge such as `[Opus]` |
| `colors.project` | color value | `yellow` | Color for the project path |
| `colors.git` | color value | `magenta` | Color for git wrapper text such as `git:(` and `)` |
| `colors.gitBranch` | color value | `cyan` | Color for the git branch and branch status text |
| `colors.label` | color value | `dim` | Color for labels and secondary metadata such as `Context`, `Usage`, counts, and progress text |
| `colors.custom` | color value | `208` | Color for the optional custom line |
| `colors.barFilled` | string | `█` | Character used for the filled portion of progress bars |
| `colors.barEmpty` | string | `░` | Character used for the empty portion of progress bars |

`colors.barFilled` and `colors.barEmpty` accept a single visible grapheme. Control characters, invisible format characters (bidi controls, zero-width joiners, variation selectors), line/paragraph separators, and noncharacters are rejected. Wide characters (emoji, CJK) may affect bar alignment depending on the terminal.

Supported color names: `dim`, `red`, `green`, `yellow`, `magenta`, `cyan`, `brightBlue`, `brightMagenta`. You can also use a 256-color number (`0-255`) or hex (`#rrggbb`).

`display.showMemoryUsage` is fully opt-in; add `"memory"` to `rows` to render it. It reports approximate system RAM usage from the local machine, not precise memory pressure inside Claude Code or a specific process. The number may overstate actual pressure because reclaimable OS cache and buffers can still be counted as used memory.

`display.showCost` is fully opt-in. ClaudeHUD prefers the native `cost.total_cost_usd` field that Claude Code provides on stdin when it is available. If that field is absent or invalid for a direct Anthropic session, ClaudeHUD falls back to the existing local transcript-based estimate so the cost line still works on older payloads. The native field is absent before the first API response in a session, so the cost display may stay hidden until then. ClaudeHUD also keeps the cost hidden for known routed providers such as Bedrock and Vertex AI, because cloud-provider billed sessions may report `$0.00` or omit the field even though the session was not literally free.

`display.showPromptCache` is fully opt-in. When enabled, ClaudeHUD looks at the timestamp of the last assistant response in the local transcript and shows a live countdown until the prompt cache expires. The default TTL is 5 minutes (`300` seconds). Set `display.promptCacheTtlSeconds` to `3600` if you want a 1-hour Max-style window. If the transcript does not have an assistant timestamp yet, the cache element stays hidden.

### Usage Limits

Usage data is available by default when Claude Code provides subscriber `rate_limits` data on stdin. To render it, include `"usage"` in `rows`, for example as its own row or beside the context components.

Set `display.usageValue` to `remaining` to show quota left instead of quota used. Warning colors and 7-day threshold checks still use the underlying used percentage.

ClaudeHUD prefers the official statusline stdin payload. If `rate_limits` are missing, you can opt into a local sidecar fallback by setting `display.externalUsagePath` to a JSON snapshot written by another tool such as a proxy. Stdin still wins whenever both sources exist.

The fallback snapshot must be fresh enough (`display.externalUsageFreshnessMs`) and include valid `updated_at`, plus a `five_hour` window, `seven_day` window, or `balance_label`. `balance_label` is optional text for prepaid provider balances; it is trimmed, length-limited, and sanitized before display. Invalid JSON, stale files, or invalid timestamps are ignored quietly.

Free/weekly-only accounts render the weekly window by itself instead of showing a ghost `5h: --` placeholder.

The 7-day percentage appears when above the `display.sevenDayThreshold` (default 80%):

```
Context █████░░░░░ 45% │ Usage ██░░░░░░░░ 25% (1h 30m / 5h) | ██████████ 85% (2d / 7d)
```

To disable, set `display.showUsage` to `false`.

Reset times use relative countdowns by default. Set `display.timeFormat` to `absolute` for wall-clock
times or `both` to show both forms. This setting is manual-only today; `/claude-hud-plus:configure`
preserves it without editing it.

Set `display.showResetLabel` to `false` if you want shorter usage countdowns such as `(3h 17m)` instead of `(resets in 3h 17m)`.

Set `display.usageCompact` to `true` if you want the shorter usage-only form, for example `5h: 25% (1h 30m)`. Compact usage takes precedence over `display.usageBarEnabled`.

**Requirements:**
- Claude Code must include subscriber `rate_limits` data on stdin for the current session
- Not available for API-key-only users

**Troubleshooting:** If usage doesn't appear:
- Ensure you're logged in with a Claude subscriber account (not API key)
- Check `display.showUsage` is not set to `false` in config
- API users see no usage display (they have pay-per-token, not rate limits)
- AWS Bedrock models display `Bedrock` and hide usage limits (usage is managed in AWS)
- Google Vertex AI models display `Vertex` and hide cost estimates (pricing differs from Anthropic direct)
- Claude Code may leave `rate_limits` empty until after the first model response in a session
- Some Claude Code builds and subscription tiers may still omit `rate_limits`, even after the first response
- If you configured `display.externalUsagePath`, ClaudeHUD will try that local snapshot before hiding usage
- ClaudeHUD never falls back to credential scraping or undocumented API calls

Example fallback snapshot:

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

### Example Configuration

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

### Display Examples

**1 level (default):** `[Opus] │ my-project git:(main)`

**2 levels:** `[Opus] │ apps/my-project git:(main)`

**3 levels:** `[Opus] │ dev/apps/my-project git:(main)`

**With dirty indicator:** `[Opus] │ my-project git:(main*)`

**With ahead/behind:** `[Opus] │ my-project git:(main ↑2 ↓1)`

**With file stats:** `[Opus] │ my-project git:(main* !3 +1 ?2)`
- `!` = modified files, `+` = added/staged, `✘` = deleted, `?` = untracked
- Counts of 0 are omitted for cleaner display

### Troubleshooting

**Config not applying?**
- Check for JSON syntax errors: invalid JSON silently falls back to defaults
- Ensure valid values: `pathLevels` must be 1, 2, or 3; `rowOverflow` must be `truncate` or `wrap`; `maxWidth` must be a positive number
- Delete config and run `/claude-hud-plus:configure` to regenerate

**Git status missing?**
- Verify you're in a git repository
- Check `gitStatus.enabled` is not `false` in config

**Tool/agent/todo lines missing?**
- These are hidden by default — enable with `showTools`, `showAgents`, `showTodos` in config
- They also only appear when there's activity to show

**HUD not appearing after setup?**
- Restart Claude Code so it picks up the new statusLine config
- On macOS, fully quit Claude Code and run `claude` again in your terminal

---

## Requirements

- Claude Code v1.0.80+
- macOS/Linux: Node.js 18+ or Bun
- Windows: Node.js 18+

---

## Development

```bash
git clone https://github.com/Dec27-Lee/claude-hud-plus
cd claude-hud-plus
npm ci && npm run build
npm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT — see [LICENSE](LICENSE)

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Dec27-Lee/claude-hud-plus&type=Date)](https://star-history.com/#Dec27-Lee/claude-hud-plus&Date)

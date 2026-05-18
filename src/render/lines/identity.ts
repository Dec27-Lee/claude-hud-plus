import type { RenderContext } from "../../types.js";
import {
  getContextPercent,
  getBufferedPercent,
  getTotalTokens,
} from "../../stdin.js";
import { coloredBar, label, getContextColor, RESET } from "../colors.js";
import { getAdaptiveBarWidth } from "../../utils/terminal.js";
import { t } from "../../i18n/index.js";
import { progressLabel } from "./label-align.js";

const DEBUG =
  process.env.DEBUG?.includes("claude-hud") || process.env.DEBUG === "*";

function getDisplayContextPercent(ctx: RenderContext): number {
  const rawPercent = getContextPercent(ctx.stdin);
  const bufferedPercent = getBufferedPercent(ctx.stdin);
  const autocompactMode = ctx.config?.display?.autocompactBuffer ?? "enabled";

  if (DEBUG && autocompactMode === "disabled") {
    console.error(
      `[claude-hud:context] autocompactBuffer=disabled, showing raw ${rawPercent}% (buffered would be ${bufferedPercent}%)`,
    );
  }

  return autocompactMode === "disabled" ? rawPercent : bufferedPercent;
}

export function renderContextBarPart(ctx: RenderContext): string | null {
  const display = ctx.config?.display;
  if (display?.showContextBar === false) {
    return null;
  }

  const percent = getDisplayContextPercent(ctx);
  const colors = ctx.config?.colors;
  const contextThresholds = {
    warning: display?.contextWarningThreshold,
    critical: display?.contextCriticalThreshold,
  };

  return coloredBar(percent, getAdaptiveBarWidth(), colors, contextThresholds);
}

export function renderContextValuePart(ctx: RenderContext): string {
  const percent = getDisplayContextPercent(ctx);
  const display = ctx.config?.display;
  const colors = ctx.config?.colors;
  const contextThresholds = {
    warning: display?.contextWarningThreshold,
    critical: display?.contextCriticalThreshold,
  };
  const contextValueMode = display?.contextValue ?? "percent";
  const contextValue = formatContextValue(ctx, percent, contextValueMode);
  return `${getContextColor(percent, colors, contextThresholds)}${contextValue}${RESET}`;
}

export function renderIdentityLine(
  ctx: RenderContext,
  alignLabels = false,
): string {
  const percent = getDisplayContextPercent(ctx);
  const colors = ctx.config?.colors;
  const display = ctx.config?.display;
  const contextThresholds = {
    warning: display?.contextWarningThreshold,
    critical: display?.contextCriticalThreshold,
  };
  const contextValueDisplay = renderContextValuePart(ctx);

  let line =
    display?.showContextBar !== false
      ? `${progressLabel("label.context", colors, alignLabels)} ${coloredBar(percent, getAdaptiveBarWidth(), colors, contextThresholds)} ${contextValueDisplay}`
      : `${progressLabel("label.context", colors, alignLabels)} ${contextValueDisplay}`;

  if (display?.showTokenBreakdown !== false && percent >= (display?.contextCriticalThreshold ?? 85)) {
    const usage = ctx.stdin.context_window?.current_usage;
    if (usage) {
      const input = formatTokens(usage.input_tokens ?? 0);
      const cache = formatTokens(
        (usage.cache_creation_input_tokens ?? 0) +
          (usage.cache_read_input_tokens ?? 0),
      );
      line += label(
        ` (${t("format.in")}: ${input}, ${t("format.cache")}: ${cache})`,
        colors,
      );
    }
  }

  return line;
}

export function formatTokens(n: number): string {
  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(0)}k`;
  }
  return n.toString();
}

export function formatContextValue(
  ctx: RenderContext,
  percent: number,
  mode: "percent" | "tokens" | "remaining" | "both",
): string {
  const totalTokens = getTotalTokens(ctx.stdin);
  const size = ctx.stdin.context_window?.context_window_size ?? 0;

  if (mode === "tokens") {
    if (size > 0) {
      return `${formatTokens(totalTokens)}/${formatTokens(size)}`;
    }
    return formatTokens(totalTokens);
  }

  if (mode === "both") {
    if (size > 0) {
      return `${percent}% (${formatTokens(totalTokens)}/${formatTokens(size)})`;
    }
    return `${percent}%`;
  }

  if (mode === "remaining") {
    return `${Math.max(0, 100 - percent)}%`;
  }

  return `${percent}%`;
}

export function applyContextWindowSizeOverride(stdin) {
    const overrideSize = Number.parseInt(process.env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE ?? '', 10);
    if (!Number.isFinite(overrideSize) || overrideSize <= 0) {
        return;
    }
    const contextWindow = stdin.context_window;
    if (!contextWindow) {
        return;
    }
    contextWindow.context_window_size = overrideSize;
    const usage = contextWindow.current_usage;
    if (!usage) {
        return;
    }
    const total = (usage.input_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0);
    contextWindow.used_percentage = Math.min(100, Math.max(0, Math.round((total / overrideSize) * 100)));
}
//# sourceMappingURL=context-window-override.js.map
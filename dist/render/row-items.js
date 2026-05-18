import { custom as customColor } from './colors.js';
import { renderAgentsLine } from './agents-line.js';
import { renderAddedDirsLine, renderAddedDirsPart, renderContextBarPart, renderContextValuePart, renderEnvironmentLine, renderGitPart, renderMemoryLine, renderModelPart, renderProjectPart, renderPromptCacheLine, renderSessionTimeLine, renderSessionTokensLine, renderUsageLine, } from './lines/index.js';
import { renderTodosLine } from './todos-line.js';
import { renderToolsLine } from './tools-line.js';
export function renderRowItem(ctx, item) {
    switch (item) {
        case 'model':
            return renderModelPart(ctx);
        case 'contextBar':
            return renderContextBarPart(ctx);
        case 'contextValue':
            return renderContextValuePart(ctx);
        case 'project':
            return renderProjectPart(ctx);
        case 'git':
            return renderGitPart(ctx);
        case 'addedDirs':
            return ctx.config.display.addedDirsLayout === 'line'
                ? renderAddedDirsLine(ctx)
                : renderAddedDirsPart(ctx);
        case 'sessionTokens':
            return renderSessionTokensLine(ctx);
        case 'usage':
            return renderUsageLine(ctx);
        case 'promptCache':
            return renderPromptCacheLine(ctx);
        case 'memory':
            return renderMemoryLine(ctx);
        case 'environment':
            return renderEnvironmentLine(ctx);
        case 'tools':
            return ctx.config.display.showTools === false ? null : renderToolsLine(ctx);
        case 'agents':
            return ctx.config.display.showAgents === false ? null : renderAgentsLine(ctx);
        case 'todos':
            return ctx.config.display.showTodos === false ? null : renderTodosLine(ctx);
        case 'sessionTime':
            return renderSessionTimeLine(ctx);
        case 'customLine':
            return ctx.config.display.customLine
                ? customColor(ctx.config.display.customLine, ctx.config.colors)
                : null;
    }
}
//# sourceMappingURL=row-items.js.map
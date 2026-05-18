import type { RenderContext } from "../../types.js";
export declare function renderContextBarPart(ctx: RenderContext): string | null;
export declare function renderContextValuePart(ctx: RenderContext): string;
export declare function renderIdentityLine(ctx: RenderContext, alignLabels?: boolean): string;
export declare function formatTokens(n: number): string;
export declare function formatContextValue(ctx: RenderContext, percent: number, mode: "percent" | "tokens" | "remaining" | "both"): string;
//# sourceMappingURL=identity.d.ts.map
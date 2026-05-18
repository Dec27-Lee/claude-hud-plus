import type { StdinData } from '../types.js';
export type RouterModelInfo = {
    model: string;
    provider: string | null;
    requestedModel: string | null;
    source: 'session';
};
export type RouterModelStatus = {
    kind: 'not-ccr';
} | {
    kind: 'ready';
    info: RouterModelInfo;
} | {
    kind: 'pending-session-state';
} | {
    kind: 'missing-session-state';
};
export declare function getRouterModelInfo(stdin: StdinData): RouterModelInfo | null;
export declare function getRouterModelStatus(stdin: StdinData): RouterModelStatus;
//# sourceMappingURL=router-model.d.ts.map
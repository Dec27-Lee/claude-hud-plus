import type { StdinData } from '../types.js';
export type RouterModelInfo = {
    model: string;
    provider: string | null;
    requestedModel: string | null;
    source: 'session' | 'latest';
};
export declare function getRouterModelInfo(stdin: StdinData): RouterModelInfo | null;
//# sourceMappingURL=router-model.d.ts.map
import type { CommonArgs } from '../../types/cli';
export declare function command(args: CommonArgs): import("commander").OptionValues;
export declare function deriveKey(args: CommonArgs<{
    path?: string;
}>): Promise<{
    action: string;
}>;
//# sourceMappingURL=derive.d.ts.map
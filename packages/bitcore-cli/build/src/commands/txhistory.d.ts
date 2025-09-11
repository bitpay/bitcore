import type { CommonArgs } from '../../types/cli';
export declare function command(args: CommonArgs): import("commander").OptionValues;
export declare function getTxHistory(args: CommonArgs<{
    pageSize: number;
    page?: number;
    expand?: boolean;
    raw?: boolean;
    export?: string | boolean;
}>): Promise<{
    action: string;
}>;
//# sourceMappingURL=txhistory.d.ts.map
import type { CommonArgs } from '../../types/cli';
export declare function command(args: CommonArgs): import("commander").OptionValues;
export declare function getUtxos(args: CommonArgs<{
    expand?: boolean;
    sortBy?: 'amount' | 'time';
    sortDir?: 'asc' | 'desc';
    export?: string;
    raw?: boolean;
}>): Promise<void>;
//# sourceMappingURL=utxos.d.ts.map
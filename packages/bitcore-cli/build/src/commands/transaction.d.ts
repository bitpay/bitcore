import type { CommonArgs } from '../../types/cli';
export declare function command(args: CommonArgs): import("commander").OptionValues;
export declare function createTransaction(args: CommonArgs<{
    to?: string;
    amount?: string;
    fee?: string;
    feeRate?: string;
    feeLevel?: string;
    nonce?: number;
    note?: string;
    dryRun?: boolean;
}>): Promise<void>;
//# sourceMappingURL=transaction.d.ts.map
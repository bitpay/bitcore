import type { CommonArgs } from '../../types/cli';
export declare function command(args: CommonArgs): import("commander").OptionValues;
export declare function getBalance(args: CommonArgs<{
    showByAddress?: boolean;
}>): Promise<any>;
export declare function displayBalance(currency: any, bal: any, opts?: any): void;
//# sourceMappingURL=balance.d.ts.map
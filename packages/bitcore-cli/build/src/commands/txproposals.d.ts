import type { CommonArgs } from '../../types/cli';
export declare function command(args: CommonArgs): import("commander").OptionValues;
export declare function getTxProposals(args: CommonArgs<{
    action?: string;
    proposalId?: string;
    raw?: boolean;
    export?: string | boolean;
}>): Promise<{
    action: string;
}>;
//# sourceMappingURL=txproposals.d.ts.map
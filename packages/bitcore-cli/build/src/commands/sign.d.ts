import { type CommonArgs } from '../../types/cli';
export declare function command(args: CommonArgs): import("commander").OptionValues;
export declare function signMessage(args: CommonArgs<{
    message?: string;
    path?: string;
    address?: string;
}>): Promise<void>;
//# sourceMappingURL=sign.d.ts.map
import { ICliOptions } from '../../../types/cli';
import { Wallet } from '../../wallet';
export declare function joinThresholdSigWallet(args: {
    wallet: Wallet;
    chain: string;
    opts: ICliOptions & {
        mnemonic?: string;
    };
}): Promise<{
    mnemonic: any;
}>;
//# sourceMappingURL=joinThresholdSig.d.ts.map
import { ICliOptions } from '../../../types/cli';
import { Wallet } from '../../wallet';
export declare function joinMultiSigWallet(args: {
    wallet: Wallet;
    opts: ICliOptions & {
        mnemonic?: string;
    };
}): Promise<{
    mnemonic: string;
}>;
//# sourceMappingURL=joinMultiSig.d.ts.map
import { Network } from 'bitcore-wallet-client';
import { ICliOptions } from '../../../types/cli';
import { Wallet } from '../../wallet';
export declare function createSingleSigWallet(args: {
    wallet: Wallet;
    chain: string;
    network: Network;
    opts: ICliOptions & {
        mnemonic?: string;
    };
}): Promise<{
    mnemonic: string;
}>;
//# sourceMappingURL=createSingleSig.d.ts.map
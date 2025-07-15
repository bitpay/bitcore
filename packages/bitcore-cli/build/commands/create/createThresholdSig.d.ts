import { Network } from 'bitcore-wallet-client';
import { ICliOptions } from '../../../types/cli';
import { Wallet } from '../../wallet';
export declare function createThresholdSigWallet(args: {
    wallet: Wallet;
    chain: string;
    network: Network;
    m: number;
    n: number;
    opts: ICliOptions & {
        mnemonic?: string;
    };
}): Promise<{
    mnemonic: any;
}>;
//# sourceMappingURL=createThresholdSig.d.ts.map
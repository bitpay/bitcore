import { ICliOptions } from '../../../types/cli';
import { Wallet } from '../../wallet';
export declare function createWallet(args: {
    wallet: Wallet;
    opts: ICliOptions & {
        mnemonic?: string;
    };
}): Promise<void>;
//# sourceMappingURL=index.d.ts.map
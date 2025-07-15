import { ICliOptions } from '../../types/cli';
import { Wallet } from '../wallet';
export declare function getBalance(args: {
    wallet: Wallet;
    opts: ICliOptions & {
        tokenAddress?: string;
    };
}): Promise<any>;
export declare function displayBalance(bal: any, coin: any, opts?: any): void;
//# sourceMappingURL=balance.d.ts.map
import { ICliOptions } from '../../types/cli';
import { Wallet } from '../wallet';
export declare function getAddresses(args: {
    wallet: Wallet;
    opts: ICliOptions & {
        pageSize: number;
    };
}): Promise<void>;
//# sourceMappingURL=addresses.d.ts.map
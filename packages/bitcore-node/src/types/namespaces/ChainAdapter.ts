import { ChainNetwork } from "../ChainNetwork";
import { ITransaction } from "../../models/transaction";
import { IBlock } from "../../models/baseBlock";
export declare namespace Adapter {
  type ConvertBlockParams<T> = ChainNetwork & {
    block: T;
    height: number;
  };

  type ConvertTxParams<T, B> = ChainNetwork &
    ConvertBlockParams<B> & {
      tx: T;
    };

  interface IChainAdapter<B, T> {
    convertBlock(params: ConvertBlockParams<B>): IBlock;
    convertTx(params: ConvertTxParams<T, B>): ITransaction;
  }
}

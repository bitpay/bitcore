import { IBlock } from "../../models/block";
import { ITransaction } from "../../models/transaction";
import { ChainNetwork } from "../ChainNetwork";

export interface IChainAdapter<B, T> {
  convertBlock(chainnet: ChainNetwork, block: B): IBlock;
  convertTx(chainnet: ChainNetwork, transaction: T, block?: B): ITransaction;
}

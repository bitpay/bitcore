import mongoose from 'mongoose';
import { BlockModel } from '../../src/models/block';
import { TransactionModel } from '../../src/models/transaction';
import { CoinModel } from '../../src/models/coin';
import { WalletAddressModel } from '../../src/models/walletAddress';
import { WalletModel } from '../../src/models/wallet';


export async function resetDatabase(){
  await resetModel(BlockModel);
  await resetModel(TransactionModel);
  await resetModel(CoinModel);
  await resetModel(WalletAddressModel);
  await resetModel(WalletModel);
}

export async function resetModel(model){
  return model.remove({});
}

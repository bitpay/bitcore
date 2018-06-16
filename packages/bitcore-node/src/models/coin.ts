import { Schema, Document, model, DocumentQuery } from "mongoose";
import { TransformableModel } from "../types/TransformableModel";
import { LoggifyObject } from "../decorators/Loggify";

export interface ICoin {
  id: string;
  network: string;
  chain: string;
  mintTxid: string;
  mintIndex: number;
  mintHeight: number;
  coinbase: boolean;
  value: number;
  address: string;
  script: Buffer;
  wallets: Schema.Types.ObjectId;
  spentTxid: string;
  spentHeight: number;
  spent?: boolean;
}
export type CoinQuery = {[key in keyof ICoin]?: any}  &
  Partial<DocumentQuery<ICoin, Document>>;

type ICoinDoc = ICoin & Document;
type ICoinModelDoc = ICoinDoc & TransformableModel<ICoinDoc>;
export interface ICoinModel extends ICoinModelDoc {
  getBalance: (params: { query: CoinQuery }) => Promise<{balance: number}[]>;
}
const CoinSchema = new Schema({
  id: String,
  network: String,
  chain: String,
  mintTxid: String,
  mintIndex: Number,
  mintHeight: Number,
  coinbase: Boolean,
  value: Number,
  address: String,
  script: Buffer,
  wallets: { type: [Schema.Types.ObjectId] },
  spentTxid: String,
  spentHeight: Number,
  spent: Boolean,
});

CoinSchema.index({ id: "hashed" });
CoinSchema.index({ mintTxid: "hashed" });
CoinSchema.index({ address: "hashed" });
CoinSchema.index({ spentTxid: "hashed" }, { sparse: true });
CoinSchema.index({ wallets: 1, spent: 1 });
CoinSchema.index({ spent: 1 });
// CoinSchema.index(
//   { mintTxid: 1, mintIndex: 1 },
//   { partialFilterExpression: { spentHeight: { $lt: 0 } } }
// );
// CoinSchema.index({ mintHeight: 1, chain: 1, network: 1 });
// CoinSchema.index({ spentHeight: 1, chain: 1, network: 1 });

// TODO: need to find unspent coins, and find all coins with certain wallets

CoinSchema.statics.getBalance = function(params: { query: CoinQuery }) {
  let { query } = params;
  // TODO: getBalance uses CoinModel.spentHeight index
  query = Object.assign(query, { spentHeight: { $lt: 0 } });
  return CoinModel.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        balance: { $sum: "$value" }
      }
    },
    { $project: { _id: false } }
  ]).exec();
};

CoinSchema.statics._apiTransform = function(
  coin: ICoin,
  options: { object: boolean }
) {
  let script = coin.script || "";
  let transform = {
    txid: coin.mintTxid,
    vout: coin.mintIndex,
    spentTxid: coin.spentTxid,
    address: coin.address,
    script: script.toString("hex"),
    value: coin.value
  };
  if (options && options.object) {
    return transform;
  }
  return JSON.stringify(transform);
};

LoggifyObject(CoinSchema.statics, 'CoinSchema');
export let CoinModel: ICoinModel = model<ICoinDoc, ICoinModel>("Coin", CoinSchema);

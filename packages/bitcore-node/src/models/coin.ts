import { LoggifyClass } from "../decorators/Loggify";
import { BaseModel } from "./base";
import { ObjectID } from "mongodb";

export type ICoin = {
  network: string;
  chain: string;
  mintTxid: string;
  mintIndex: number;
  mintHeight: number;
  coinbase: boolean;
  value: number;
  address: string;
  script: Buffer;
  wallets: Set<ObjectID>;
  spentTxid: string;
  spentHeight: number;
}

@LoggifyClass
class Coin extends BaseModel<ICoin> {

  constructor() {
    super('coins');
    this.collection.createIndex({ mintTxid: 1 });
    this.collection.createIndex(
      { mintTxid: 1, mintIndex: 1 },
      { partialFilterExpression: { spentHeight: { $lt: 0 } } }
    );
    this.collection.createIndex({ address: 1 });
    this.collection.createIndex({ mintHeight: 1, chain: 1, network: 1 });
    this.collection.createIndex({ spentTxid: 1 }, { sparse: true });
    this.collection.createIndex({ spentHeight: 1, chain: 1, network: 1 });
    this.collection.createIndex({ wallets: 1, spentHeight: 1 }, { sparse: true });
  }

  getBalance(params: { query: any }) {
    let { query } = params;
    query = Object.assign(query, { spentHeight: { $lt: 0 } });
    return this.collection.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          balance: { $sum: "$value" }
        }
      },
      { $project: { _id: false } }
    ]);
  };

  _apiTransform(
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
  }
}
export let CoinModel = new Coin();

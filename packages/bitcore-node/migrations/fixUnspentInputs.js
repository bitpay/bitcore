/****************************************
*** This migration script will fix historical instances 
*** of an issue where inputs that were used in an RBF tx
*** are left in a pending state if they are not used by 
*** the new tx that is the replacement.
********************************************/ 

const { TransactionModel, TransactionStorage } = require('../build/src/models/transaction');
const { CoinModel, CoinStorage } = require('../build/src/models/coin');
const { Storage } = require('../build/src/services/storage');
const { wait } = require('../build/src/utils/wait');

const RBFEnabledUTXOChains = [ 'BTC', 'LTC', 'DOGE' ];
const networks = [ 'regtest', 'testnet', 'livenet'];
const storageArgs = {
    dbHost: '127.0.0.1',
    dbName: 'bitcore'
  };

class Migration {
    transactionModel = new TransactionModel();
    coinModel = new CoinModel();

    constructor({ transactionModel = TransactionStorage, coinModel = CoinStorage } = {}) {
        this.transactionModel = transactionModel;
        this.coinModel = coinModel;
      }
    async connect() {
        try {
            if (!Storage.connected) {
                await Storage.start(storageArgs);
                await wait(2000);
              }
        } catch (e) {
            console.log(e);
        }
    }

    async runScript() {
        console.log('running script');
            for await (const chain of RBFEnabledUTXOChains) {
                for await (const network of networks) {
                    // using Set so that we don't have duplicates
                    console.log(`updating records for ${chain}:${network}`);
                    // Get array of all invalid txs for chain and network
                    const invalidTxs = await this.transactionModel.collection.find({ chain, network, blockHeight: -3 }).toArray();
                    // Create array of tx ids
                    const spentTxids = invalidTxs.map(tx => tx.txid);
                    // Set all coins that were pending to be spent by an invalid tx back to unspent
                    const task = await this.coinModel.collection.updateMany({ chain, network, spentTxid: { $in: spentTxids }, spentHeight: -1 }, { $set: { spentHeight: -2 } });
                    console.log("modified count: ", task.modifiedCount);
                }
            }
    }
}

const migration = new Migration({ transactionModel: TransactionStorage, coinModel: CoinStorage });

migration.connect().then(() => {
    migration.runScript()
    .then(() => {
        console.log('completed');
        process.exit();
    });
});

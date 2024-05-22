#!/usr/bin/env node
/****************************************
 *** This migration script will change network names as defined in 
 *** networkMapping. It will update the state, blocks, transactions,
 *** wallets, walletAddresses and coins collections.
 ***
 *** This does a dry run by default. Use "--doit" to execute.
 ********************************************/
const { StateStorage } = require('../build/src/models/state');
const { BitcoinBlockStorage } = require('../build/src/models/block');
const { CoinStorage } = require('../build/src/models/coin');
const { TransactionStorage } = require('../build/src/models/transaction');
const { WalletStorage } = require('../build/src/models/wallet');
const { WalletAddressStorage } = require('../build/src/models/walletAddress');
const { Storage } = require('../build/src/services/storage');
const { wait } = require('../build/src/utils/wait');

const networkMapping = {
  ETH: {
    testnet: 'goerli'
  },
  BTC: {
    testnet: 'testnet3'
  },
  BCH: {
    testnet: 'testnet3'
  },
  DOGE: {
    testnet: 'testnet3'
  },
  LTC: {
    testnet: 'testnet4',
  },
  MATIC: {
    testnet: 'mumbai'
  }
};

class Migration {
  constructor({ transactionModel = TransactionStorage, coinModel = CoinStorage, stateModel = StateStorage, blockModel = BitcoinBlockStorage, walletModel = WalletStorage, walletAddressModel = WalletAddressStorage } = {}) {
    this.transactionModel = transactionModel;
    this.coinModel = coinModel;
    this.stateModel = stateModel;
    this.blockModel = blockModel;
    this.walletModel = walletModel;
    this.walletAddressModel = walletAddressModel;
  }

  async connect() {
    console.log("Attempting connection to the database...")
    try {
      if (!Storage.connected) {
        await Storage.start();
        await wait(2000);
      }
    } catch (e) {
      console.log(e);
    }
  }

  async endProcess() {
    if (Storage.connected){
      await Storage.stop();
    }
    process.exit();
  }

  processArgs(argv) {
    let retArgs = {
      doit: false,
    };
    let args = argv.slice(2);

    const help = ~args.findIndex(i => i == '--help');
    if (help) {
      console.log("Usage: node migrateToNamedTestnets.js [--doit to execute otherwise dry run]");
      this.endProcess();
    }

    const doit = ~args.findIndex(i => i == '--doit');

    retArgs.doit = doit;

    return retArgs;
  }

  async runScript(args) {
    const outcome = {};
    const { doit } = args;
    console.log(doit ? 'LET\'S DO IT FOR REAL' : 'Dry run');

    // Blocks and Transactions are updated in a nested loop
    for (const chain of Object.keys(networkMapping)) {
      outcome[chain] = {};
      for (const fromNetwork of Object.keys(networkMapping[chain])) {
        outcome[chain][fromNetwork] = { state: 0, blocks: 0, transactions: 0, coins: 0, wallets: 0, walletAddresses: 0 };
        const toNetwork = networkMapping[chain][fromNetwork];
        const newOutcomes = await this.updateBlocksTransactionsAddressesAndCoins(chain, fromNetwork, toNetwork, doit);
        outcome[chain][fromNetwork].state += newOutcomes.state;
        outcome[chain][fromNetwork].blocks += newOutcomes.blocks;
        outcome[chain][fromNetwork].transactions += newOutcomes.transactions;
        outcome[chain][fromNetwork].coins += newOutcomes.coins;
        outcome[chain][fromNetwork].walletAddresses += newOutcomes.walletAddresses;
      }
    }

    // Wallets are updated as we retrieve each wallet
    await this.updateWallets(outcome, doit);

    console.log('Outcome:', outcome);
    if (!doit) {
      console.log('Run the script with "--doit" to execute this operation.');
    }

    await this.endProcess();
  }

  async updateBlocksTransactionsAddressesAndCoins(chain, fromNetwork, toNetwork, doit) {
    const outcome = { state: 0, blocks: 0, transactions: 0, coins: 0, walletAddresses: 0};
    if (doit) {
      // State
      const stateUpdate = await this.stateModel.collection.updateMany({ initialSyncComplete: `${chain}:${fromNetwork}` }, { $set: { 'initialSyncComplete.$': `${chain}:${toNetwork}` } });
      if (stateUpdate?.result?.nModified) {
        outcome.state += stateUpdate.result.nModified;
      }
      // Blocks
      const blockUpdate = await this.blockModel.collection.updateMany({chain, network: fromNetwork }, { $set: { network: toNetwork } });
      if (blockUpdate?.result?.nModified) {
        outcome.blocks += blockUpdate.result.nModified;
      }
      // Transactions
      const transactionUpdate = await this.transactionModel.collection.updateMany({chain, network: fromNetwork }, { $set: { network: toNetwork } });
      if (transactionUpdate?.result?.nModified) {
        outcome.transactions += transactionUpdate.result.nModified;
      }
      // Wallet Addresses
      const walletAddressUpdate = await this.walletAddressModel.collection.updateMany({ chain, network: fromNetwork }, { $set: { network: toNetwork } });
      if (walletAddressUpdate?.result?.nModified) {
        outcome.walletAddresses += walletAddressUpdate.result.nModified;
      }
      // Coins
      const coinUpdate = await this.coinModel.collection.updateMany({ chain, network: fromNetwork }, { $set: { network: toNetwork } });
      if (coinUpdate?.result?.nModified) {
        outcome.coins += coinUpdate.result.nModified;
      }
    } else {
      // Only return the count of affected documents without actually updating
      const stateCount = await this.stateModel.collection.countDocuments({ initialSyncComplete: `${chain}:${fromNetwork}` });
      const blockCount = await this.blockModel.collection.countDocuments({ chain, network: fromNetwork });
      const transactionCount = await this.transactionModel.collection.countDocuments({ chain, network: fromNetwork });
      const walletAddressCount = await this.walletAddressModel.collection.countDocuments({ chain, network: fromNetwork });
      const coinCount = await this.coinModel.collection.countDocuments({ chain, network: fromNetwork });
      
      outcome.state = stateCount;
      outcome.blocks = blockCount;
      outcome.transactions = transactionCount;
      outcome.walletAddresses = walletAddressCount;
      outcome.coins = coinCount;
    }
    
    return outcome;
  }

  async updateWallets(outcome, doit) {
    const chains = Object.keys(networkMapping);
    const chainNetworks = (chain) => Object.keys(networkMapping[chain]);
      // Stream all wallets
      const walletStream = this.walletModel.collection
      .find({})
      .addCursorFlag('noCursorTimeout', true);

      let walletData = (await walletStream.next());
      while (walletData != null) {
        const { chain, network } = walletData;
        if (chains.includes(chain) && chainNetworks(chain).includes(network)) {
          if (doit) {
              // Wallet
            await this.walletModel.collection.updateOne({ _id: walletData._id }, { $set: { network: networkMapping[chain][network] } });
          }
          outcome[chain][network].wallets++;
        }            
        // get next record
        walletData = (await walletStream.next());
      }
    
  }
}

const migration = new Migration({ stateModel: StateStorage, blockModel: BitcoinBlockStorage, transactionModel: TransactionStorage, coinModel: CoinStorage, walletModel: WalletStorage, walletAddressModel: WalletAddressStorage });

const args = migration.processArgs(process.argv);
migration
  .connect()
  .then(() => {
    migration.runScript(args);
  })
  .catch(err => {
    console.error(err);
    migration.endProcess()
    .catch(err => { 
      console.error(err);
      process.exit(1);
    });
  });

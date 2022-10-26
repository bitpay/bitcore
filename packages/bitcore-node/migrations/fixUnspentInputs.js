#!/usr/bin/env node
/****************************************
 *** This migration script will fix historical instances
 *** of an issue where inputs that were used in an RBF tx
 *** are left in a pending state if they are not used by
 *** the new tx that is the replacement.
 ***
 *** This does a dry run by default. Use "--dryrun false"
 *** to execute outside of dry run.
 *** 
 *** By default this will run for BTC on testnet. To change this
 *** use the --chain [CHAIN] and --network [NETWORk] flags.
 *** You must have valid RPC connection specified in bitcore.config.json.
 ********************************************/
const { CryptoRpc } = require('crypto-rpc');
const { TransactionStorage } = require('../build/src/models/transaction');
const { CoinStorage } = require('../build/src/models/coin');
const fs = require('fs');
const fsPromises = fs.promises;
const { Storage } = require('../build/src/services/storage');
const { wait } = require('../build/src/utils/wait');
const Config = require('../build/src/config');

class Migration {
  constructor({ transactionModel = TransactionStorage, coinModel = CoinStorage } = {}) {
    this.transactionModel = transactionModel;
    this.coinModel = coinModel;
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
      dryrun: true,
      chain: '',
      network: ''
    };
    let args = argv.slice(2);

    const helpIdx = args.findIndex(i => i == '--help');
    if (helpIdx >= 0) {
      console.log("Usage: node fixUnspentInputs.js --chain [CHAIN] --network [NETWORK] --dryrun [BOOL - default: true]");
      this.endProcess();
    }

    const dryRunIdx = args.findIndex(i => i == '--dryrun');
    if (dryRunIdx >= 0) {
      retArgs.dryrun =
        args[dryRunIdx + 1] == undefined || args[dryRunIdx + 1] == 'true'
          ? true
          : args[dryRunIdx + 1] == 'false'
          ? false
          : true;
    }

    const chainIdx = args.findIndex(i => i == '--chain');
    if (chainIdx >= 0) {
      retArgs.chain = args[chainIdx + 1] == undefined ? '' : args[chainIdx + 1].toUpperCase();
    }

    const networkIdx = args.findIndex(i => i == '--network');
    if (networkIdx >= 0) {
      retArgs.network = args[networkIdx + 1] == undefined ? '' : args[networkIdx + 1].toLowerCase();
    }

    if (!retArgs.chain || !retArgs.network) {
      console.log("You must specify a chain and network for the script to run on. Use --help for more info.");
      this.endProcess();
    }

    return retArgs;
  }

  async runScript(args) {
    console.log('Running script with these args: ', args);
    let output = {};
    const { chain, network, dryrun } = args;
    console.log(`Checking records for ${chain}:${network}`);
    // Get all pending coins from valid transactions (mintHeight should be valid block height)
    const stream = this.coinModel.collection
      .find(
        { chain, network, mintHeight: { $gt: -1 }, spentHeight: -1 } // -1 is pending status
      )
      .addCursorFlag('noCursorTimeout', true);

    // Initialize RPC connection
    if (!Config.default.chains[chain]) {
      console.error(`There is no RPC config for chain '${chain}'`);
      this.endProcess();
    }
    if (!Config.default.chains[chain][network]) {
      console.error(`There is no RPC config for chain '${chain}' with network '${network}'`);
      this.endProcess();
    }
    const rpcConfig = Config.default.chains[chain][network].rpc;
    const rpc = new CryptoRpc(
      {
        rpcPort: rpcConfig.port,
        host: rpcConfig.host,
        protocol: rpcConfig.protocol || 'http',
        rpcUser: rpcConfig.username,
        rpcPass: rpcConfig.password,
        chain
      },
      {}
    ).get(chain);

    let data = (await stream.next());
    while (data != null) {
      let isUnspent = false;
      // If spent (or in mempool) then this returns an error otherwise returns data on unspent output
      try {
        const coinData = await rpc.getTxOutputInfo({
          txid: data.mintTxid,
          vout: data.mintIndex
        });
        isUnspent = !!coinData;
      } catch (e) {
        if (e.message && e.message.match(`No info found for ${data.mintTxid}`)){
          // Coin must be spent or actually pending in mempool - do nothing
        } else {
          // Lets log the error in case it is config related
          console.error(e);
        }
      } finally {
        if (isUnspent) {
          // Log record
          if (output[`${chain}-${network}`]) {
            output[`${chain}-${network}`].push(data);
          } else {
            output[`${chain}-${network}`] = [data];
          }

          if (!dryrun) {
            // Update record to be unspent (-2)
            await this.coinModel.collection.updateOne({ _id: data._id }, { $set: { spentHeight: -2 } }); // -2 is unspent status
          }
        }
      }
      // get next record
      data = (await stream.next());
    }

    console.log(`Finished ${dryrun ? 'scanning' : 'updating'} records for ${chain}-${network}`);
    const date = new Date().getTime();
    const filename = `output-${chain}-${network}-${date}.log`;
    console.log(`Writing output to ${filename}`);
    try {
      await fsPromises.writeFile(filename, JSON.stringify(output));
    } catch (e) {
      // write to stdout
      console.log('Failed to write output to file. Writing to stdout instead.');
      console.log(output);
    }
    if (dryrun) {
      console.log('Run the script with "--dryrun false" to execute this operation on the returned results.');
    }

    await this.endProcess();
  }
}

const migration = new Migration({ transactionModel: TransactionStorage, coinModel: CoinStorage });

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

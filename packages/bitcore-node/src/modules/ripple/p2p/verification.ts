import logger from '../../../logger';
import { ErrorType, IVerificationPeer } from '../../../services/verification';
import { XrpBlockStorage } from '../models/block';
import { XrpP2pWorker } from '../p2p';
import { IXrpCoin, IXrpTransaction } from '../types';

export class XrpVerificationPeer extends XrpP2pWorker implements IVerificationPeer {
  prevBlockNum = 0;
  prevHash = '';
  nextBlockHash = '';
  deepScan = false;

  enableDeepScan() {
    this.deepScan = true;
  }

  disableDeepScan() {
    this.deepScan = false;
  }

  async setupListeners() {
    this.events.on('connected', async () => {
      this.client!.on('ledger', async block => {
        const transformedBlock = this.provider.transformLedger(block, this.network);
        this.events.emit('block', transformedBlock);
      });
    });
  }

  async resync(start: number, end: number) {
    const { chain, network } = this;
    const client = await this.provider.getClient(this.network);
    let currentHeight = Math.max(1, start);
    while (currentHeight <= end) {
      let lastLog = Date.now();
      const block = await client.getLedger({
        ledgerVersion: currentHeight,
        includeTransactions: true,
        includeAllData: true
      });

      const transformedBlock = this.provider.transformLedger(block, network);

      const nextBlock = await XrpBlockStorage.collection.findOne({
        chain,
        network,
        previousBlockHash: transformedBlock.hash
      });
      const coinsAndTxs = (block.transactions || [])
        .map((tx: any) => ({
          tx: this.provider.transform(tx, network, transformedBlock),
          coins: this.provider.transformToCoins(tx, network)
        }))
        .filter(data => {
          return 'txid' in data.tx && data.tx.txid != null;
        }) as Array<{ tx: IXrpTransaction; coins: Array<IXrpCoin> }>;
      const blockTxs = new Array<IXrpTransaction>();
      const blockCoins = new Array<IXrpCoin>();

      for (const coinAndTx of coinsAndTxs) {
        const { transaction, coins } = await this.provider.tag(chain, network, coinAndTx.tx, coinAndTx.coins);
        if (this.chainConfig.walletOnlySync && !transaction.wallets.length) {
          continue;
        }
        blockTxs.push(transaction);
        blockCoins.push(...(coins as Array<IXrpCoin>));
      }

      if (nextBlock) {
        transformedBlock.nextBlockHash = nextBlock.hash;
      }

      await this.blockModel.processBlock({
        chain,
        network,
        block: transformedBlock,
        transactions: blockTxs,
        coins: blockCoins,
        initialSyncComplete: true
      });

      currentHeight++;

      if (Date.now() - lastLog > 100) {
        logger.info('Re-Sync ', {
          chain,
          network,
          height: currentHeight
        });
        lastLog = Date.now();
      }
    }
  }

  async getBlockForNumber(blockNum: number) {
    return this.getBlock(blockNum);
  }

  async validateDataForBlock(blockNum: number, _: number, log = false) {
    let success = true;
    const { chain, network } = this;
    const errors = new Array<ErrorType>();

    const block = await this.blockModel.collection.findOne({
      chain,
      network,
      height: blockNum,
      processed: true
    });

    if (!block) {
      success = false;
      const error = {
        model: 'block',
        err: true,
        type: 'MISSING_BLOCK',
        payload: { blockNum }
      };
      errors.push(error);
      if (log) {
        console.log(JSON.stringify(error));
      }
      return { success, errors };
    }

    return { success, errors };
  }
}

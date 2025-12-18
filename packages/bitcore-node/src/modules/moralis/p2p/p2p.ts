import { CryptoRpc } from 'crypto-rpc';
import { Cursor } from 'mongodb';
import Web3 from 'web3';
import { BlockTransactionObject } from 'web3-eth';
import logger, { timestamp } from '../../../logger';
import { CoinEvent, EventStorage } from '../../../models/events';
import { StateStorage } from '../../../models/state';
import { WalletAddressStorage } from '../../../models/walletAddress';
import { IWebhook, WebhookStorage } from '../../../models/webhook';
import { EVMBlockStorage } from '../../../providers/chain-state/evm/models/block';
import { EVMTransactionStorage } from '../../../providers/chain-state/evm/models/transaction';
import { BaseP2PWorker } from '../../../services/p2p';
import { IEVMNetworkConfig, IExternalSyncConfig } from '../../../types/Config';
import { IAddressSubscription } from '../../../types/ExternalProvider';
import { wait } from '../../../utils';
import { MoralisStateProvider } from '../api/csp';

export class MoralisP2PWorker extends BaseP2PWorker {
  private chainConfig: IExternalSyncConfig<IEVMNetworkConfig>;
  private web3?: Web3;
  private syncInterval?: NodeJS.Timeout;
  private addressSub?: IAddressSubscription;
  private chainId?: number;
  private webhookTail?: Cursor;
  private bestBlock: number;
  private chainNetworkStr: string;
  private csp: MoralisStateProvider;

  constructor({ chain, network, chainConfig }) {
    super({ chain, network, chainConfig });
    this.chain = chain;
    this.network = network;
    this.chainConfig = chainConfig;
    this.csp = new MoralisStateProvider(this.chain);
    this.addressSub = undefined;
    this.chainId = undefined;
    this.webhookTail = undefined;
    this.bestBlock = 0;
    this.chainNetworkStr = `${this.chain}:${this.network}`;
  }

  async start() {
    this.refreshSyncingNode();
  }

  async stop() {
    this.stopping = true;
    clearInterval(this.syncInterval);
    await this.webhookTail?.close();
    await this.unregisterSyncingNode();
    (this.web3?.currentProvider as any)?.disconnect?.();
  }

  async getWeb3(): Promise<Web3> {
    const connectionErrors: any[] = [];
    try {
      try {
        await this.web3!.eth.getBlockNumber();
      } catch {
        const providerConfigs = this.chainConfig.providers || (this.chainConfig.provider ? [this.chainConfig.provider] : []);
        for (const config of providerConfigs) {
          try {
            const rpc = new CryptoRpc({ chain: this.chain, network: this.network, isEVM: true, ...config }).get(this.chain);
            await rpc.web3.eth.getBlockNumber();
            this.web3 = rpc.web3;
            return this.web3 as Web3;
          } catch (e) {
            connectionErrors.push(e);
          }
        }
        logger.error('Unable to connect to web3 %o:%o instance: %o', connectionErrors);
        // Notice we don't unset this.web3. At worst, the old connection starts working again.
      }
    } catch (e) {
      logger.error('Error getting web3 %o:%o instance: %o', this.chain, this.network, e);
    }
    return this.web3 as Web3;
  }

  async getChainId() {
    if (this.chainId == null) {
      const web3 = await this.getWeb3();
      this.chainId = await web3.eth.getChainId();
    }
    return this.chainId;
  }

  async sync(): Promise<void> {
    const { value: state } = await StateStorage.getSingletonState();
    let currentHeight: number = state?.verifiedBlockHeight?.[this.chain]?.[this.network] || 0;
    let syncing = false;

    this.syncInterval = setInterval(() => {
      if (this.stopping || !this.isSyncingNode) {
        return;
      }

      if (syncing) {
        return;
      }

      (async () => {
        syncing = true;

        const startTime = Date.now();
        let msgInterval;
        let block: BlockTransactionObject | null = null;
        try {
          const web3 = await this.getWeb3();
          this.bestBlock = await web3.eth.getBlockNumber();
          currentHeight = Math.max(this.bestBlock - (this.chainConfig.maxBlocksToSync || 50), currentHeight || 0);
          const startHeight = currentHeight;

          if (this.bestBlock - currentHeight <= 0) {
            return;
          }

          logger.info(`Syncing ${this.bestBlock - currentHeight} blocks for ${this.chain} ${this.network}`);
          msgInterval = setInterval(() => {
            const blocksProcessed = currentHeight - startHeight;
            const elapsedMinutes = (Date.now() - startTime) / (60 * 1000);
            logger.info(
              `${timestamp()} | Syncing... | Chain: ${this.chain} | Network: ${this.network} |${(blocksProcessed / elapsedMinutes)
                .toFixed(2)
                .padStart(8)} blocks/min | Height: ${currentHeight.toString().padStart(7)}`
            );
          }, 1000 * 2); // 2 seconds
     

          do {
            block = await web3.eth.getBlock(currentHeight, true);
            if (block && !this.stopping) {
              const blockEvent = EVMBlockStorage.convertRawBlock(this.chain, this.network, block);
              await EventStorage.signalBlock(blockEvent);// .catch((e) => logger.error(`Error signaling ${this.chainNetworkStr} block event: %o`, e.stack || e.message || e));
              for (const tx of block.transactions) {
                const txEvent = EVMTransactionStorage.convertRawTx(this.chain, this.network, tx as any, blockEvent);
                await EventStorage.signalTx(txEvent);// .catch((e) => logger.error(`Error signaling ${this.chainNetworkStr} tx event: %o`, e.stack || e.message || e));
              }
              await StateStorage.setVerifiedBlockHeight({ chain: this.chain, network: this.network, height: currentHeight });
              currentHeight = block.number + 1;
            }
          } while (block);
          clearInterval(msgInterval); // clear before log below
          logger.info(`${this.chainNetworkStr} up to date.`);
        } catch (err: any) {
          logger.error(`Error syncing ${this.chainNetworkStr}: %o`, err.stack || err.message || err);
        } finally {
          syncing = false;
          clearInterval(msgInterval); // clear here too in case of a catch
        }
      })().catch(err => logger.error('Unhandled error in sync interval:', err));
    }, 1000 * (this.chainConfig.syncIntervalSecs || 10)); // default 10 seconds

    // Listen for webhooks and process any unprocessed ones in the db
    await this.syncAddressActivity();
    // Subscribe to external wallet activity provider
    while (!(await this.subscribeToAddressActivity()) && !this.stopping) {
      // subscription might fail if the API service is offline (webhook endpoint)
      logger.warn(`Retrying ${this.chainNetworkStr} address subscription in 10 seconds...`);
      await wait(10 * 1000);
    };
  }

  private async subscribeToAddressActivity() {
    try {
      const chainId = await this.getChainId();
      const subs = await this.csp.getAddressSubscriptions();
      this.addressSub = subs?.find(sub => sub.chainIds.includes('0x' + chainId.toString(16)));
      
      if (this.addressSub?.status === 'error') {
        await this.csp.deleteAddressSubscription({ sub: this.addressSub });
        this.addressSub = undefined;
      }

      if (!this.addressSub) {
        // Create new subscription if none exists
        this.addressSub = await this.csp.createAddressSubscription({
          chain: this.chain,
          network: this.network,
          chainId
        });
      }

      logger[this.addressSub?.status === 'active' ? 'info' : 'warn'](`Address subscription for ${this.chainNetworkStr} is: ${this.addressSub!.status}`);

      // todo check and update url
      // if (!sub.webhookUrl.startsWith(provider.baseWebhookUrl)) {
      //   // todo update url
      // }

      const ONE_DAY = 1000 * 60 * 60 * 24;
      const now = Date.now();

      { // Remove inactive addresses
        const state = await StateStorage.getSingletonState();
        const lastUpdate = state.value?.lastAddressSubscriptionUpdate?.[this.chain]?.[this.network];
        
        const inactiveAddresses = await WalletAddressStorage.collection.find({
          chain: this.chain,
          network: this.network,
          lastQueryTime: { $gte: lastUpdate, $lt: now - ONE_DAY * 60 }
        }).toArray();
       
        this.addressSub = await this.csp.updateAddressSubscription({
          sub: this.addressSub!,
          addressesToRemove: inactiveAddresses.map(a => a.address)
        });
      }
      
      { // Add new addresses
        const activeAddresses = await WalletAddressStorage.collection.find({
          chain: this.chain,
          network: this.network,
          lastQueryTime: { $gte: now - ONE_DAY * 60 }
        }).toArray();
    
        this.addressSub = await this.csp.updateAddressSubscription({
          sub: this.addressSub,
          addressesToAdd: activeAddresses.map(a => a.address),
        });
      }

      // Set subscription to active
      this.addressSub = await this.csp.updateAddressSubscription({
        sub: this.addressSub,
        status: 'active'
      });

      logger[this.addressSub?.status === 'active' ? 'info' : 'warn'](`Address subscription for ${this.chainNetworkStr} is: ${this.addressSub!.status}`);
      return true;
    } catch (err: any) {
      logger.error(`Error subscribing to ${this.chainNetworkStr} address activity: %o`, err.stack || err.message || err);
      return false;
    }
  }

  private async syncAddressActivity() {
    // if this is a reconnect, remove old listeners
    this.webhookTail?.removeAllListeners();
    this.webhookTail = WebhookStorage.getTail({ chain: this.chain, network: this.network });
    logger.info(`Webhook tail initiated for ${this.chainNetworkStr}`);
    this.webhookTail.on('error', (err) => {
      logger.error(`Webhook ${this.chainNetworkStr} tail error: %o`, err.stack || err.message || err);
    });
    this.webhookTail.on('close', async () => {
      // clearInterval(heightInterval);
      if (!this.stopping) {
        logger.error(`Webhook tail for ${this.chainNetworkStr} unexpectedly closed. Trying to reconnect in 5 seconds...`);
        await wait(5000); // wait 5 seconds before trying to reconnect
        this.syncAddressActivity();
      }
    });
    this.webhookTail.on('data', async (webhook: IWebhook) => {
      try {
        let coinEvents: CoinEvent[] = [];
        if (webhook.source !== 'moralis') {
          return;
        }
        coinEvents = this.csp.webhookToCoinEvents({ chain: this.chain, network: this.network, webhook });
        const result = await Promise.allSettled(coinEvents.map(evt => EventStorage.signalAddressCoin(evt))); 
        const someFulfilled = result.some(r => r.status === 'fulfilled');
        if (someFulfilled) {
          await WebhookStorage.setProcessed({ webhook });
        }
      } catch (err: any) {
        logger.error(`Error processing ${this.chainNetworkStr} webhook ${webhook._id?.toString()}: %o`, err.stack || err.message || err);
      }
    });
  }
}

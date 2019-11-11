import logger, { timestamp } from '../../src/logger';
import { BitcoinBlockStorage } from '../../src/models/block';
import { Bitcoin } from '../../src/types/namespaces/Bitcoin';
import { wait } from '../../src/utils/wait';
import { ChainStateProvider } from '../../src/providers/chain-state';
import { BitcoinP2PWorker } from '../../src/modules/bitcoin/p2p';

export class VerificationPeer extends BitcoinP2PWorker {
  setupListeners() {
    this.pool.on('peerready', peer => {
      logger.info(
        `${timestamp()} | Connected to peer: ${peer.host}:${peer.port.toString().padEnd(5)} | Chain: ${
          this.chain
        } | Network: ${this.network}`
      );
    });

    this.pool.on('peerdisconnect', peer => {
      logger.warn(
        `${timestamp()} | Not connected to peer: ${peer.host}:${peer.port.toString().padEnd(5)} | Chain: ${
          this.chain
        } | Network: ${this.network}`
      );
    });

    this.pool.on('peerblock', async (peer, message) => {
      const { block } = message;
      const { hash } = block;
      logger.debug('peer block received', {
        peer: `${peer.host}:${peer.port}`,
        chain: this.chain,
        network: this.network,
        hash
      });

      this.events.emit(hash, message.block);
      this.events.emit('block', message.block);
    });

    this.pool.on('peerheaders', (peer, message) => {
      logger.debug('peerheaders message received', {
        peer: `${peer.host}:${peer.port}`,
        chain: this.chain,
        network: this.network,
        count: message.headers.length
      });
      this.events.emit('headers', message.headers);
    });

    this.pool.on('peerinv', (peer, message) => {
      const filtered = message.inventory.filter(inv => {
        const hash = this.bitcoreLib.encoding
          .BufferReader(inv.hash)
          .readReverse()
          .toString('hex');
        return !this.isCachedInv(inv.type, hash);
      });

      if (filtered.length) {
        peer.sendMessage(this.messages.GetData(filtered));
      }
    });
  }

  async connect() {
    this.setupListeners();
    this.pool.connect();
    this.connectInterval = setInterval(this.pool.connect.bind(this.pool), 5000);
    return new Promise<void>(resolve => {
      this.pool.once('peerready', () => resolve());
    });
  }

  async disconnect() {
    this.pool.removeAllListeners();
    this.pool.disconnect();
    if (this.connectInterval) {
      clearInterval(this.connectInterval);
    }
  }

  public async getHeaders(candidateHashes: string[]): Promise<Bitcoin.Block.HeaderObj[]> {
    let received = false;
    return new Promise<Bitcoin.Block.HeaderObj[]>(async resolve => {
      this.events.once('headers', headers => {
        received = true;
        resolve(headers);
      });
      while (!received) {
        this.pool.sendMessage(this.messages.GetHeaders({ starts: candidateHashes }));
        await wait(1000);
      }
    });
  }

  public async getBlock(hash: string) {
    logger.debug('Getting block, hash:', hash);
    let received = false;
    return new Promise<Bitcoin.Block>(async resolve => {
      this.events.once(hash, (block: Bitcoin.Block) => {
        logger.debug('Received block, hash:', hash);
        received = true;
        resolve(block);
      });
      while (!received) {
        this.pool.sendMessage(this.messages.GetData.forBlock(hash));
        await wait(1000);
      }
    });
  }

  async processBlock(block: Bitcoin.Block): Promise<any> {
    await this.blockModel.addBlock({
      chain: this.chain,
      network: this.network,
      forkHeight: this.chainConfig.forkHeight,
      parentChain: this.chainConfig.parentChain,
      initialSyncComplete: this.initialSyncComplete,
      block
    });
  }

  async resync(from: number, to: number) {
    const { chain, network } = this;
    let currentHeight = Math.max(1, from);
    while (currentHeight < to) {
      const locatorHashes = await ChainStateProvider.getLocatorHashes({
        chain,
        network,
        startHeight: Math.max(1, currentHeight - 30),
        endHeight: currentHeight
      });
      const headers = await this.getHeaders(locatorHashes);
      if (!headers.length) {
        logger.info(`${chain}:${network} up to date.`);
        break;
      }
      const headerCount = Math.min(headers.length, to - currentHeight);
      logger.info(`Re-Syncing ${headerCount} blocks for ${chain} ${network}`);
      let lastLog = Date.now();
      for (let header of headers) {
        if (currentHeight > to) {
          break;
        }
        const block = await this.getBlock(header.hash);
        await BitcoinBlockStorage.processBlock({ chain, network, block, initialSyncComplete: true });
        currentHeight++;
        if (Date.now() - lastLog > 100) {
          logger.info(`Re-Sync `, {
            chain,
            network,
            height: currentHeight
          });
          lastLog = Date.now();
        }
      }
    }
  }
}

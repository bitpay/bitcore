import logger, { timestamp } from '../../logger';
import { BitcoinBlockStorage } from '../../models/block';
import { ChainStateProvider } from '../../providers/chain-state';
import { BitcoinP2PWorker } from '../../modules/bitcoin/p2p';
import { IVerificationPeer } from '../../services/verification';

export class VerificationPeer extends BitcoinP2PWorker implements IVerificationPeer {
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

    this.pool.on('peertx', async (peer, message) => {
      const hash = message.transaction.hash;
      logger.debug('peer tx received', {
        peer: `${peer.host}:${peer.port}`,
        chain: this.chain,
        network: this.network,
        hash
      });
      this.events.emit('transaction', message.transaction);
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

  async getBlockForNumber(currentHeight: number) {
    const { chain, network } = this;
    const locatorHashes = await ChainStateProvider.getLocatorHashes({
      chain,
      network,
      startHeight: Math.max(1, currentHeight - 30),
      endHeight: currentHeight
    });
    const headers = await this.getHeaders(locatorHashes);
    return this.getBlock(headers[0].hash);
  }

  async resync(start: number, end: number) {
    const { chain, network } = this;
    let currentHeight = Math.max(1, start);
    while (currentHeight < end) {
      const locatorHashes = await ChainStateProvider.getLocatorHashes({
        chain,
        network,
        startHeight: Math.max(1, currentHeight - 30),
        endHeight: currentHeight + 1
      });
      const headers = await this.getHeaders(locatorHashes);
      if (!headers.length) {
        logger.info(`${chain}:${network} up to date.`);
        break;
      }
      const headerCount = Math.min(headers.length, end - currentHeight);
      logger.info(`Re-Syncing ${headerCount} blocks for ${chain} ${network}`);
      let lastLog = Date.now();
      for (let header of headers) {
        if (currentHeight < end && currentHeight >= start) {
          const block = await this.getBlock(header.hash);
          console.log('Processing', currentHeight, block.hash);

          await BitcoinBlockStorage.processBlock({ chain, network, block, initialSyncComplete: true });
          const nextBlock = await BitcoinBlockStorage.collection.findOne({
            chain,
            network,
            previousBlockHash: block.hash
          });
          if (nextBlock) {
            await BitcoinBlockStorage.collection.updateOne(
              { chain, network, hash: block.hash },
              { $set: { nextBlockHash: nextBlock.hash } }
            );
          }
        }
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

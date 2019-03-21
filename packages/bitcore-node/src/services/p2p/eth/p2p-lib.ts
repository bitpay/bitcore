import { EventEmitter } from 'events';
import { Ethereum } from "../../../types/namespaces/Ethereum";
const devp2p = require('ethereumjs-devp2p');
const EthereumTx = require('ethereumjs-tx');
const EthereumBlock = require('ethereumjs-block');
const LRUCache = require('lru-cache');
const ms = require('ms');
const chalk = require('chalk');
const assert = require('assert');
const { randomBytes } = require('crypto');

const PRIVATE_KEY = randomBytes(32);
const CHAIN_ID = 4;
const requests = { headers: new Array<string>(), bodies: new Array<any>(), msgTypes: {} };

/*
 *const BOOTNODES = require('ethereum-common')
 *  .bootstrapNodes.filter(node => {
 *    return node.chainId === CHAIN_ID;
 *  })
 *  .map(node => {
 *    return {
 *      address: node.ip,
 *      udpPort: node.port,
 *      tcpPort: node.port
 *    };
 *  });
 */
const REMOTE_CLIENTID_FILTER = ['go1.5', 'go1.6', 'go1.7', 'quorum', 'pirl', 'ubiq', 'gmc', 'gwhale', 'prichain'];

const CHECK_BLOCK_NR = 4370000;

const ETH = {
  NETWORKS: {
    RINKEYBY: {
      networkId: CHAIN_ID,
      td: devp2p._util.int2buffer(1), // total difficulty in genesis block
      bestHash: Buffer.from('6341fd3daf94b748c72ced5a5b26028f2474f5f00d824504e4fa37a75767e177', 'hex'),
      genesisHash: Buffer.from('6341fd3daf94b748c72ced5a5b26028f2474f5f00d824504e4fa37a75767e177', 'hex')
    }
  }
};
const getPeerAddr = peer => `${peer._socket.remoteAddress}:${peer._socket.remotePort}`;

// DPT
const dpt = new devp2p.DPT(PRIVATE_KEY, {
  refreshInterval: 30000,
  endpoint: {
    address: '127.0.0.1',
    udpPort: null,
    tcpPort: null
  }
});

dpt.on('error', err => console.error(chalk.red(`DPT error: ${err}`)));

export class BitcoreP2PEth extends EventEmitter {
  // RLPx
  rlpx = new devp2p.RLPx(PRIVATE_KEY, {
    dpt: dpt,
    maxPeers: 1,
    capabilities: [devp2p.ETH.eth63, devp2p.ETH.eth62],
    remoteClientIdFilter: REMOTE_CLIENTID_FILTER,
    listenPort: null
  });

  blocksCache = new LRUCache({ max: 10000 });
  txCache = new LRUCache({ max: 10000 });

  peers = {};

  constructor() {
    super();
    // connect to local ethereum node (debug)

    this.setupListeners();
  }

  connect() {
    dpt
      .addPeer({ address: '127.0.0.1', udpPort: 30303, tcpPort: 30303 })
      .then(peer => {
        return this.rlpx.connect({
          id: peer.id,
          address: peer.address,
          port: peer.tcpPort
        });
      })
      .catch(err => console.log(`error on connection to local node: ${err.stack || err}`));
    this.establishHeartbeat();
  }

  setupListeners() {
    this.rlpx.on('error', err => console.error(chalk.red(`RLPx error: ${err.stack || err}`)));

    this.rlpx.on('peer:added', peer => {
      const addr = getPeerAddr(peer);
      this.peers[addr] = peer;
      this.emit('peerready', peer);
      const eth = peer.getProtocols()[0];

      const clientId = peer.getHelloMessage().clientId;
      console.log(
        chalk.green(`Add peer: ${addr} ${clientId} (eth${eth.getVersion()}) (total: ${this.rlpx.getPeers().length})`)
      );

      eth.sendStatus(ETH.NETWORKS.RINKEYBY);

      eth.once('status', () => {
        eth.sendMessage(devp2p.ETH.MESSAGE_CODES.GET_BLOCK_HEADERS, [CHECK_BLOCK_NR, 1, 0, 0]);
      });

      eth.on('message', async (code, payload) => {
        if (code in requests.msgTypes) {
          requests.msgTypes[code] += 1;
        } else {
          requests.msgTypes[code] = 1;
        }

        switch (code) {
          case devp2p.ETH.MESSAGE_CODES.NEW_BLOCK_HASHES:
            console.log('MESSAGE:NEW_BLOCK_HASHES');
            for (let item of payload) {
              const blockHash = item[0].toString('hex');
              if (this.blocksCache.has(blockHash)) continue;
              setTimeout(() => {
                eth.sendMessage(devp2p.ETH.MESSAGE_CODES.GET_BLOCK_HEADERS, [blockHash, 1, 0, 0]);
                requests.headers.push(blockHash);
              }, ms('0.1s'));
            }
            break;

          case devp2p.ETH.MESSAGE_CODES.TX:
            console.log('MESSAGE:TX');
            for (let item of payload) {
              const tx = new EthereumTx(item);
              if (this.isValidTx(tx)) this.onNewTx(tx, peer);
            }

            break;

          case devp2p.ETH.MESSAGE_CODES.GET_BLOCK_HEADERS:
            console.log('MESSAGE:GET_BLOCK_HEADERS');
            const headers = new Array<any>();
            if (requests.headers.length === 0 && requests.msgTypes[code] >= 8) {
              peer.disconnect(devp2p.RLPx.DISCONNECT_REASONS.USELESS_PEER);
            } else {
              eth.sendMessage(devp2p.ETH.MESSAGE_CODES.BLOCK_HEADERS, headers);
            }
            break;

          case devp2p.ETH.MESSAGE_CODES.BLOCK_HEADERS:
            console.log('MESSAGE:BLOCK_HEADERS');
            const blockHeaders = payload.map(header => new EthereumBlock.Header(header));
            this.emit('headers', blockHeaders);
            break;

          case devp2p.ETH.MESSAGE_CODES.GET_BLOCK_BODIES:
            console.log('MESSAGE:GET_BLOCK_BODIES');
            if (requests.headers.length === 0 && requests.msgTypes[code] >= 8) {
              peer.disconnect(devp2p.RLPx.DISCONNECT_REASONS.USELESS_PEER);
            } else {
              eth.sendMessage(devp2p.ETH.MESSAGE_CODES.BLOCK_BODIES, []);
            }
            break;

          case devp2p.ETH.MESSAGE_CODES.BLOCK_BODIES:
            console.log('MESSAGE:BLOCK_BODIES');
            let isValidPayload = false;
            while (requests.bodies.length > 0) {
              const header = requests.bodies.shift();
              const block = new EthereumBlock([header.raw, payload[0][0], payload[0][1]]);
              const isValid = await this.isValidBlock(block);
              if (isValid) {
                isValidPayload = true;
                this.emit(block.hash().toString('hex'), block);
                this.onNewBlock(block, peer);
                break;
              }
            }

            if (!isValidPayload) {
              console.log(`${addr} received wrong block body`);
            }

            break;

          case devp2p.ETH.MESSAGE_CODES.NEW_BLOCK:
            console.log('MESSAGE:NEW_BLOCK');
            const newBlock = new EthereumBlock(payload[0]);
            const isValidNewBlock = await this.isValidBlock(newBlock);
            if (isValidNewBlock) this.onNewBlock(newBlock, peer);
            break;

          case devp2p.ETH.MESSAGE_CODES.GET_NODE_DATA:
            console.log('MESSAGE:GET_NODE_DATA');
            if (requests.headers.length === 0 && requests.msgTypes[code] >= 8) {
              peer.disconnect(devp2p.RLPx.DISCONNECT_REASONS.USELESS_PEER);
            } else {
              eth.sendMessage(devp2p.ETH.MESSAGE_CODES.NODE_DATA, []);
            }
            break;

          case devp2p.ETH.MESSAGE_CODES.NODE_DATA:
            console.log('MESSAGE:NODE_DATA');
            break;

          case devp2p.ETH.MESSAGE_CODES.GET_RECEIPTS:
            console.log('MESSAGE:GET_RECEIPTS');
            if (requests.headers.length === 0 && requests.msgTypes[code] >= 8) {
              peer.disconnect(devp2p.RLPx.DISCONNECT_REASONS.USELESS_PEER);
            } else {
              eth.sendMessage(devp2p.ETH.MESSAGE_CODES.RECEIPTS, []);
            }
            break;

          case devp2p.ETH.MESSAGE_CODES.RECEIPTS:
            console.log('MESSAGE:RECEIPTS');
            break;

          default:
            console.log('MESSAGE:', code);
        }
      });
    });

    this.rlpx.on('peer:removed', (peer, reasonCode, disconnectWe) => {
      const who = disconnectWe ? 'we disconnect' : 'peer disconnect';
      const total = this.rlpx.getPeers().length;
      console.log(
        chalk.yellow(
          `Remove peer: ${getPeerAddr(peer)} - ${who}, reason: ${peer.getDisconnectPrefix(reasonCode)} (${String(
            reasonCode
          )}) (total: ${total})`
        )
      );
      this.emit('peerdisconnect', peer);
    });

    this.rlpx.on('peer:error', (peer, err) => {
      if (err.code === 'ECONNRESET') return;

      if (err instanceof assert.AssertionError) {
        const peerId = peer.getId();
        if (peerId !== null) dpt.banPeer(peerId, ms('5m'));

        console.error(chalk.red(`Peer error (${getPeerAddr(peer)}): ${err.message}`));
        return;
      }

      console.error(chalk.red(`Peer error (${getPeerAddr(peer)}): ${err.stack || err}`));
    });
  }

  establishHeartbeat() {
    /*
     *for (let bootnode of BOOTNODES) {
     *  dpt.bootstrap(bootnode).catch(err => {
     *    console.error(chalk.bold.red(`DPT bootstrap error: ${err.stack || err}`));
     *  });
     *}
     */
    setInterval(() => {
      const peersCount = dpt.getPeers().length;
      const openSlots = this.rlpx._getOpenSlots();
      const queueLength = this.rlpx._peersQueue.length;
      const queueLength2 = this.rlpx._peersQueue.filter(o => o.ts <= Date.now()).length;

      console.log(
        chalk.yellow(
          `Total nodes in DPT: ${peersCount}, open slots: ${openSlots}, queue: ${queueLength} / ${queueLength2}`
        )
      );
    }, ms('30s'));
  }

  onNewTx(tx, peer) {
    const txHashHex = tx.hash().toString('hex');
    if (this.txCache.has(txHashHex)) return;
    this.txCache.set(txHashHex, true);
    tx.hash = tx.hash();
    this.emit('peertx', peer, { transaction: tx });
    /*
     *console.log(`New tx: ${txHashHex} (from ${getPeerAddr(peer)})`);
     */
  }

  onNewBlock(block, peer) {
    const blockHashHex = block.hash().toString('hex');
    const blockNumber = devp2p._util.buffer2int(block.header.number);
    if (this.blocksCache.has(blockHashHex)) return;
    this.blocksCache.set(blockHashHex, block);
    console.log(
      `----------------------------------------------------------------------------------------------------------`
    );
    console.log(`New block ${blockNumber}: ${blockHashHex} (from ${getPeerAddr(peer)})`);
    console.log(
      `----------------------------------------------------------------------------------------------------------`
    );
    this.emit('peerblock', peer, { block });
  }

  isValidTx(tx) {
    return tx.validate(false);
  }

  async isValidBlock(block) {
    if (!block.validateUnclesHash()) return false;
    if (!block.transactions.every(this.isValidTx)) return false;
    return new Promise((resolve, reject) => {
      block.genTxTrie(() => {
        try {
          resolve(block.validateTransactionsTrie());
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  sendPoolMessage(message, messageBody) {
    for (let peer of Object.values(this.peers)) {
      this.sendPeerMessage(peer, message, messageBody);
    }
  }

  sendPeerMessage(peer, message, messageBody) {
    const eth = peer.getProtocols()[0];
    eth.sendMessage(message, messageBody);
  }

  getHeaders(bestHeight: number) {
    return new Promise(resolve => {
      const _getHeaders = () => {
        const message = [bestHeight, 2000, 0, 0];
        this.sendPoolMessage(devp2p.ETH.MESSAGE_CODES.GET_BLOCK_HEADERS, message);
      };
      const headersRetry = setInterval(_getHeaders, 10000);
      this.once('headers', headers => {
        clearInterval(headersRetry);
        resolve(headers);
      });
      _getHeaders();
    });
  }

  getBlock(header: Ethereum.Header): Promise<Ethereum.Header> {
    const hashStr = header.hash().toString('hex');
    return new Promise(resolve => {
      const _getBlock = () => {
        console.log('Getting block ', hashStr);
        if (this.blocksCache.has(hashStr)) {
          this.emit(hashStr, this.blocksCache.get(hashStr))
        } else {
          requests.bodies.push(header);
          this.sendPoolMessage(devp2p.ETH.MESSAGE_CODES.GET_BLOCK_BODIES, [header.hash()]);
        }
      };
      const blockRetry = setInterval(_getBlock, 10000);
      this.once(hashStr, block => {
        clearInterval(blockRetry);
        resolve(block);
      });
      _getBlock();
    });
  }

  getBlocks(hashes: Array<string>) {
    this.sendPoolMessage(devp2p.ETH.MESSAGE_CODES.GET_BLOCK_BODIES, hashes);
  }
}

// uncomment, if you want accept incoming connections
// rlpx.listen(30303, '0.0.0.0')
// dpt.bind(30303, '0.0.0.0')

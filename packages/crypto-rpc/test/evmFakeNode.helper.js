import http from 'http';

const GAS_LIMIT = 30000000n;
const hex = (value) => '0x' + BigInt(value).toString(16);

/**
 * A JSON-RPC node serving a chain of blocks, for EthRpc's fee estimates. It answers eth_blockNumber,
 * eth_getBlockByNumber, eth_gasPrice and eth_feeHistory, computing eth_feeHistory as geth does: each block's rewards
 * are its transactions' effective priority fees, sorted from the lowest, at percentiles of the block's gas used.
 *
 * Blocks are { baseFee, txs }, and block 0 is an empty genesis block. Each tx is { tip, maxFee, gas, legacy }:
 * - a type 2 tx declares maxPriorityFeePerGas = tip and maxFeePerGas = maxFee (default baseFee + tip), and pays
 *   min(tip, maxFee - baseFee);
 * - a legacy tx has gasPrice = baseFee + tip and pays tip.
 */
export class FakeEvmNode {
  constructor() {
    this.calls = [];
    this.setChain([]);
    this.server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        const { id, method, params } = JSON.parse(body);
        this.calls.push({ method, params });
        let reply;
        try {
          if (this.failing[method]) {
            throw new Error(this.failing[method]);
          }
          reply = { jsonrpc: '2.0', id, result: this.handle(method, params) };
        } catch (err) {
          reply = { jsonrpc: '2.0', id, error: { code: -32000, message: err.message } };
        }
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(reply));
      });
    });
  }

  async start() {
    await new Promise((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    return { protocol: 'http', host: '127.0.0.1', port: String(this.server.address().port) };
  }

  stop() {
    return new Promise((resolve) => this.server.close(resolve));
  }

  /** Replaces the chain after genesis, and clears the recorded calls and failures. */
  setChain(blocks, { gasPrice = 1n } = {}) {
    this.blocks = [{ baseFee: 1000000000n, txs: [] }, ...blocks].map((block, number) => this.buildBlock(block, number));
    this.gasPrice = gasPrice;
    this.failing = {};
    this.feeHistoryBlocks = Infinity;
    this.editFeeHistory = (history) => history;
    this.calls = [];
  }

  resetCalls() {
    this.calls = [];
  }

  /** Makes eth_feeHistory return at most this many blocks, as a node with a lower limit does. */
  limitFeeHistory(blocks) {
    this.feeHistoryBlocks = blocks;
  }

  /** Changes each eth_feeHistory result before it is sent, to answer as a misbehaving node would. */
  changeFeeHistory(edit) {
    this.editFeeHistory = edit;
  }

  /** Adds blocks after the current tip. */
  addBlocks(blocks) {
    for (const block of blocks) {
      this.blocks.push(this.buildBlock(block, this.blocks.length));
    }
  }

  /** Makes a method answer with an error. */
  fail(method, message = `${method} failed`) {
    this.failing[method] = message;
  }

  count(method) {
    return this.calls.filter((call) => call.method === method).length;
  }

  buildBlock({ baseFee = 10000000000n, txs = [] }, number) {
    return {
      number: BigInt(number),
      baseFee,
      txs: txs.map(({ tip, maxFee, gas = 21000n, legacy = false }, index) => {
        if (legacy) {
          return { legacy, gas, tip, gasPrice: baseFee + tip, effectiveTip: tip, index };
        }
        const feeCap = maxFee ?? baseFee + tip;
        const effectiveTip = tip < feeCap - baseFee ? tip : feeCap - baseFee;
        return { legacy, gas, tip, maxFee: feeCap, gasPrice: baseFee + effectiveTip, effectiveTip, index };
      })
    };
  }

  get tip() {
    return this.blocks.length - 1;
  }

  handle(method, params) {
    switch (method) {
      case 'eth_blockNumber':
        return hex(this.tip);
      case 'eth_gasPrice':
        return hex(this.gasPrice);
      case 'eth_getBlockByNumber':
        return this.blockJson(params[0] === 'latest' ? this.tip : Number(params[0]), params[1]);
      case 'eth_feeHistory':
        return this.editFeeHistory(this.feeHistory(Math.min(Number(params[0]), this.feeHistoryBlocks), params[1], params[2]));
      default:
        throw new Error(`the method ${method} does not exist`);
    }
  }

  blockJson(number, hydrated) {
    const block = this.blocks[number];
    if (!block) {
      return null;
    }
    const hash = '0x' + number.toString(16).padStart(64, '0');
    const transactions = block.txs.map((tx) => {
      const txHash = '0x' + (number * 1000 + tx.index + 1).toString(16).padStart(64, '0');
      if (!hydrated) {
        return txHash;
      }
      const json = {
        hash: txHash,
        blockHash: hash,
        blockNumber: hex(number),
        transactionIndex: hex(tx.index),
        from: '0x' + '11'.repeat(20),
        to: '0x' + '22'.repeat(20),
        value: '0x0',
        nonce: hex(tx.index),
        input: '0x',
        gas: hex(tx.gas),
        gasPrice: hex(tx.gasPrice),
        type: tx.legacy ? '0x0' : '0x2'
      };
      if (!tx.legacy) {
        json.maxPriorityFeePerGas = hex(tx.tip);
        json.maxFeePerGas = hex(tx.maxFee);
      }
      return json;
    });
    return {
      number: hex(number),
      hash,
      parentHash: '0x' + Math.max(number - 1, 0).toString(16).padStart(64, '0'),
      timestamp: hex(1700000000 + number),
      gasLimit: hex(GAS_LIMIT),
      gasUsed: hex(block.txs.reduce((sum, tx) => sum + tx.gas, 0n)),
      baseFeePerGas: hex(block.baseFee),
      transactions
    };
  }

  feeHistory(count, newest, percentiles) {
    for (const [i, p] of percentiles.entries()) {
      if (p < 0 || p > 100) {
        throw new Error(`invalid reward percentile: ${p}`);
      }
      if (i > 0 && p <= percentiles[i - 1]) {
        throw new Error(`invalid reward percentile: #${i - 1}:${percentiles[i - 1]} >= #${i}:${p}`);
      }
    }
    const last = newest === 'latest' ? this.tip : Number(newest);
    const blocks = this.blocks.slice(Math.max(last - count + 1, 0), last + 1);
    return {
      oldestBlock: hex(blocks[0].number),
      // the base fees of the blocks, then of the next block
      baseFeePerGas: [...blocks.map((block) => hex(block.baseFee)), hex(blocks[blocks.length - 1].baseFee + 1000000000n)],
      gasUsedRatio: blocks.map((block) => Number(block.txs.reduce((sum, tx) => sum + tx.gas, 0n)) / Number(GAS_LIMIT)),
      reward: blocks.map((block) => percentiles.map((p) => hex(this.reward(block, p))))
    };
  }

  reward(block, percentile) {
    if (!block.txs.length) {
      return 0n;
    }
    const sorted = [...block.txs].sort((a, b) => a.effectiveTip < b.effectiveTip ? -1 : a.effectiveTip > b.effectiveTip ? 1 : 0);
    const gasUsed = block.txs.reduce((sum, tx) => sum + tx.gas, 0n);
    const threshold = BigInt(Math.floor(Number(gasUsed) * percentile / 100));
    let index = 0;
    let sum = sorted[0].gas;
    while (sum < threshold && index < sorted.length - 1) {
      index++;
      sum += sorted[index].gas;
    }
    return sorted[index].effectiveTip;
  }
}

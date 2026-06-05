/**
 * Block-by-date resolution via average-block-time interpolation.
 *
 * Ported from monosux/ethereum-block-by-date (MIT) and trimmed to what we use:
 *   - getDate(date, after) only (no getEvery / period iteration)
 *   - web3 provider only (no ethers / viem)
 *   - no moment.js (native Date + unix-second arithmetic)
 *
 * Algorithm:
 *   1. Probe genesis and latest to compute average block time across the chain.
 *   2. Interpolate a first guess by dividing the date's offset from genesis by avg block time.
 *   3. Refine recursively: re-estimate local block time between the guess and a neighbor,
 *      step toward the target, repeat until the guess straddles the target.
 *   4. Cache every probed block within the call so the recursion doesn't re-fetch.
 *
 * "after" semantics mirror the upstream library:
 *   - true:  smallest block whose timestamp >= target
 *   - false: largest block whose timestamp <  target  (a.k.a. "block before")
 */

export interface BlockResult {
  block: number;
  timestamp: number;
  date: string;
}

interface SavedBlock {
  number: number;
  timestamp: number;
}

function toUnixSeconds(ts: bigint | number | string): number {
  if (typeof ts === 'bigint') return Number(ts);
  if (typeof ts === 'string') {
    return ts.startsWith('0x') ? parseInt(ts, 16) : parseInt(ts, 10);
  }
  return Number(ts);
}

export class EthDater {
  private web3: any;
  private latestBlock?: SavedBlock;
  private firstBlock?: SavedBlock;
  private blockTime?: number;
  private checkedBlocks: Record<number, number[]> = {};
  private savedBlocks: Record<number, SavedBlock> = {};
  public requests = 0;

  constructor(web3: any) {
    this.web3 = typeof web3?.eth !== 'undefined' ? web3 : { eth: web3 };
  }

  async getDate(input: Date | string | number, after: boolean = true, refresh: boolean = false): Promise<BlockResult> {
    const targetUnix = Math.floor(new Date(input).getTime() / 1000);
    const dateIso = new Date(targetUnix * 1000).toISOString();

    if (!this.firstBlock || !this.latestBlock || this.blockTime === undefined || refresh) {
      await this.getBoundaries();
    }

    if (targetUnix < this.firstBlock!.timestamp) {
      return this.returnWrapper(dateIso, 1);
    }
    if (targetUnix >= this.latestBlock!.timestamp) {
      return this.returnWrapper(dateIso, this.latestBlock!.number);
    }

    this.checkedBlocks[targetUnix] = [];
    const guess = Math.ceil((targetUnix - this.firstBlock!.timestamp) / this.blockTime!);
    const predictedBlock = await this.getBlockWrapper(guess);
    const found = await this.findBetter(targetUnix, predictedBlock, after);
    return this.returnWrapper(dateIso, found);
  }

  private async getBoundaries(): Promise<void> {
    this.latestBlock = await this.getBlockWrapper('latest');
    this.firstBlock = await this.getBlockWrapper(1);
    const span = this.latestBlock.number - 1;
    this.blockTime = span > 0 ? (this.latestBlock.timestamp - this.firstBlock.timestamp) / span : 0;
  }

  private async findBetter(targetUnix: number, predicted: SavedBlock, after: boolean, blockTime: number = this.blockTime!): Promise<number> {
    if (await this.isBetterBlock(targetUnix, predicted, after)) return predicted.number;

    const difference = targetUnix - predicted.timestamp;
    let skip = Math.ceil(difference / (blockTime === 0 ? 1 : blockTime));
    if (skip === 0) skip = difference < 0 ? -1 : 1;

    const nextNum = this.getNextBlock(targetUnix, predicted.number, skip);
    const next = await this.getBlockWrapper(nextNum);

    const localBlockTime = Math.abs(
      (predicted.timestamp - next.timestamp) /
      (predicted.number - next.number || 1)
    );
    return this.findBetter(targetUnix, next, after, localBlockTime);
  }

  private async isBetterBlock(targetUnix: number, predicted: SavedBlock, after: boolean): Promise<boolean> {
    const ts = predicted.timestamp;
    if (after) {
      if (ts < targetUnix) return false;
      const previous = await this.getBlockWrapper(predicted.number - 1);
      return ts >= targetUnix && previous.timestamp < targetUnix;
    } else {
      if (ts >= targetUnix) return false;
      const next = await this.getBlockWrapper(predicted.number + 1);
      return ts < targetUnix && next.timestamp >= targetUnix;
    }
  }

  private getNextBlock(targetUnix: number, currentBlock: number, skip: number): number {
    let next = currentBlock + skip;
    if (next > this.latestBlock!.number) next = this.latestBlock!.number;
    if (this.checkedBlocks[targetUnix].includes(next)) {
      return this.getNextBlock(targetUnix, currentBlock, skip < 0 ? --skip : ++skip);
    }
    this.checkedBlocks[targetUnix].push(next);
    return next < 1 ? 1 : next;
  }

  private returnWrapper(dateIso: string, block: number): BlockResult {
    return { date: dateIso, block, timestamp: this.savedBlocks[block].timestamp };
  }

  private async getBlockWrapper(block: number | 'latest'): Promise<SavedBlock> {
    if (typeof block === 'number' && this.savedBlocks[block]) return this.savedBlocks[block];

    const raw = await this.web3.eth.getBlock(block);
    const number = toUnixSeconds(raw.number);
    const timestamp = toUnixSeconds(raw.timestamp);
    this.savedBlocks[number] = { number, timestamp };
    this.requests++;
    return this.savedBlocks[number];
  }
}

export default EthDater;

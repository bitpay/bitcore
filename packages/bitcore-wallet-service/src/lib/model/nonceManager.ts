import _ from 'lodash';
import { ChainService } from '../chain/index';
import logger from '../logger';
import { WalletService } from '../server';
import { Storage } from '../storage';
import { TxProposal } from './txproposal';
import { IWallet } from './wallet';

const MAX_SLOTS = 50; // max size of slotBuffer and max amount of pending transacitons
const $ = require('preconditions').singleton();
const Errors = require('../errors/errordefinitions');
export class NonceSlot {
  public nonce: number;
  public proposalId: string;
  public broadcasted: boolean;

  constructor(nonce: number, proposalId: string, broadcasted: boolean = false) {
    this.nonce = nonce;
    this.proposalId = proposalId;
    this.broadcasted = broadcasted;
  }

  static fromObj(obj) {
    return new NonceSlot(obj.nonce, obj.proposalId, obj.broadcasted);
  }

  public free(): boolean {
    this.proposalId = undefined;
    this.broadcasted = false;
    return true;
  }

  public assign(proposalId): number {
    this.proposalId = proposalId;
    return this.nonce;
  }

  public setBroadcasted(): boolean {
    this.broadcasted = true;
    return true;
  }

  public isFree(): boolean {
    return this.proposalId ? true : false;
  }
}

export class NonceManager {
  public walletId: string;
  public address: string;
  public chain: string;
  private nextNonce: number;
  private slotBuffer: NonceSlot[]; // implemeted as a ring buffer / circular queue
  private head: number; // front of queue pointer
  private tail: number; // back of queue pointer
  private size: number;

  static create(opts) {
    // , server, wallet){
    opts = opts || {};

    let x = new NonceManager();

    x.size = opts.size <= MAX_SLOTS ? opts.size : MAX_SLOTS;
    x.walletId = opts.walletId;
    x.address = opts.address;
    x.chain = opts.chain;
    x.slotBuffer = [];
    x.nextNonce = 0;
    x.head = 0;
    x.tail = 0;

    return x;
  }

  static fromObj(obj) {
    let x = new NonceManager();

    x.size = obj.size <= MAX_SLOTS ? obj.size : MAX_SLOTS;
    x.walletId = obj.walletId;
    x.address = obj.address;
    x.chain = obj.chain;
    x.slotBuffer = _.map(obj.slotBuffer, slot => {
      return NonceSlot.fromObj(slot);
    });
    x.nextNonce = obj.nextNonce;
    x.head = obj.head;
    x.tail = obj.tail;

    return x;
  }

  toObject() {
    let x: any = _.cloneDeep(this);
    return x;
  }

  increment(index: number): number {
    return (index + 1) % this.size;
  }

  decrement(index: number): number {
    let val = index - 1;
    return val >= 0 ? val % this.size : this.size - 1;
  }

  private enQueue(proposalId: string): number {
    if (!this.isFull()) {
      this.slotBuffer[this.tail] = new NonceSlot(this.nextNonce, proposalId);
      this.nextNonce++;
      this.tail = this.increment(this.tail);
      return this.nextNonce - 1;
    }
    return NaN;
  }

  private deQueue(): number {
    if (!this.isEmpty()) {
      const slot = this.slotBuffer[this.head];
      if (slot) {
        slot.setBroadcasted();
        this.head = this.increment(this.head);
        return slot.nonce;
      }
    }
    return NaN;
  }

  public findSlot(opts): NonceSlot {
    opts = opts || {};
    const nonce = opts.nonce;
    // const all = opts.all || false;
    const freeSlot = opts.freeSlot;
    const proposalId = opts.proposalId;
    // const next = all ? this.nextIndex : this.nextActiveIndex;
    for (let i = this.head; i >= 0; i = this.nextActiveIndex(i)) {
      if (this.slotBuffer[i]) {
        // case: find any free active slot
        if (freeSlot && this.slotBuffer[i].isFree()) {
          return this.slotBuffer[i];
        }
        // case: find any slot that matches opts
        if (!freeSlot) {
          let slot = this.slotBuffer[i];
          if (proposalId && this.slotBuffer[i].proposalId != proposalId) {
            slot = undefined;
          }
          if (nonce && this.slotBuffer[i].nonce != nonce) {
            slot = undefined;
          }
          if (slot) return slot;
        }
      }
    }
    return undefined;
  }

  public getFirstNonce(): number {
    return this.slotBuffer[this.head] ? this.slotBuffer[this.head].nonce : NaN;
  }

  // Get the next index within the entire array stopping before the head
  private nextIndex(index): number {
    const next = this.increment(index);
    return this.head == next ? NaN : next;
  }

  public isActiveIndex(index): boolean {
    const front = this.head;
    const back = this.tail;
    index = index % this.size;
    return index >= front && index <= back ? true : false;
  }

  // Get the next index within the active index's of the circular queue  which stops at the tail
  private nextActiveIndex(index: number): number {
    if (this.isActiveIndex(index)) {
      const next = this.increment(index);
      return this.tail == index ? NaN : next;
    }
    return NaN;
  }

  // use this to clear slots aka set to undefined
  public updateSlot(opts) {}

  public isFull(): boolean {
    return this.increment(this.tail) == this.head;
  }

  public isEmpty(): boolean {
    return this.head == this.tail;
  }

  // Assigns a given TransactionProposal ID to a NonceSlot and returns the assigned nonce
  public async assign(server: WalletService, wallet: IWallet, proposalId: string): Promise<number> {
    $.checkState(wallet.id.toString() === this.walletId, 'Wallet parameter does not match NonceMangers Wallet ID');
    return new Promise(async (resolve, reject) => {
      let curNonce;
      try {
        try {
          // recently broadcasted txp's may still be pending
          curNonce = await server._getPendingTransactionCount({
            address: this.address,
            chain: wallet.chain,
            network: wallet.network
          });
        } catch (err) {
          logger.debug(err);
          logger.debug('Error getting pending transaction count. Trying without pending flag...');
          curNonce = await ChainService.getTransactionCount(server, wallet, this.address);
        }

        if (!curNonce) reject(new Error('No nonce returned'));

        const headNonce = this.getFirstNonce() ? this.getFirstNonce() : 0;

        if (curNonce < headNonce) {
          const slot = this.findSlot({ freeSlot: true }); // there is likely a nonce gap. check for free slots and use if found
          if (slot) return resolve(slot.assign(proposalId));
          // this shouldnt happen. wallet could be corrupted
          this.nextNonce = curNonce;
          // TODO  do a nonceUpdate where we update all slots between head and tail with ascending values starting fron curNonce. make sure to adjust nextNonce
          return resolve(this.enQueue(proposalId));
        }
        if (curNonce > headNonce) {
          this.nextNonce = curNonce; // some nonces were skipped. the address may have executed txs from a different wallet. lets catch up
        }
        return resolve(this.enQueue(proposalId));
      } catch (err) {
        return reject(err);
      }
    });
  }

  public onTxProposalError(txp: TxProposal, action: string) {
    // only freeSlot on error
    switch (action) {
      case 'broadcasted':
      case 'pending':
        const slot = this.findSlot({ proposalId: txp.id, nonce: txp.nonce });
        if (slot) slot.free();
        break;
      default:
        break;
    }
  }

  // Overwrite slot associated with given txp, decrement all procceding slots nonces txp by 1, update the txps
  // Example:
  // slotBuffer = [..., ...A, ...]
  // A = [...LEFT, txp, ...RIGHT] // This is the active queue
  // - txp is the txp to be removed
  // - We want to move LEFT slots + 1 index which will overwrite the txp's slot
  // - Then update all of RIGHT slots nonce's by - 1
  // Result:
  // slotBuffer == [ ... + 1, ...A - 1, ...]
  // A = [...LEFT, ...RIGHT]
  public removeTxNonce(storage: Storage, txp: TxProposal): Promise<boolean> {
    $.checkState(txp.from == this.address, 'Txp address does not match NonceManager address');
    logger.debug(`Removing TX ${txp.id} from the Nonce Manager`);
    return new Promise(async (resolve, reject) => {
      const slot = this.findSlot({ proposalId: txp.id, nonce: txp.nonce });
      if (slot) {
        let index = this.head;
        let prevSlot = this.slotBuffer[this.head];
        let startIndex = this.nextActiveIndex(this.head);
        // LEFT
        for (let i = startIndex; i >= 0; i = this.nextActiveIndex(i)) {
          if (!i) break;
          let curSlot = this.slotBuffer[i];
          this.slotBuffer[i] = prevSlot;
          if (curSlot.proposalId == slot.proposalId) {
            index = this.nextActiveIndex(i);
            break;
          }
          prevSlot = curSlot;
        }
        // LEFT + 1
        this.head = this.increment(this.head);
        // RIGHT
        let txps = {};
        for (let i = index; i >= 0; i = this.nextActiveIndex(i)) {
          const curSlot = this.slotBuffer[i];
          txps[curSlot.proposalId] = { old: curSlot.nonce, new: this.decrement(curSlot.nonce) };
          // RIGHT nonce -1
          this.slotBuffer[i].nonce = curSlot.nonce - 1;
        }
        // UPDATE
        logger.debug(`Decrementing the nonces for the following TXs ${JSON.stringify(txps)}`);
        try {
          await storage.updateTxs(this.walletId, txps);
        } catch (err) {
          logger.error('Failed to update TXs with a new nonce after an active TX deletion');
          logger.error(`Failed updates: ${JSON.stringify(txps)}`);
          reject(err);
        }
        resolve(true);
      }
      resolve(false);
    });
  }

  public onTxProposalAction(txp: TxProposal, action: string, cb) {
    $.checkState(txp.from == this.address, 'Txp address does not match NonceManager address');
    $.checkState(txp.walletId == this.walletId, 'Txp wallet does not match NonceManager wallet');
    return new Promise(async (resolve, reject) => {
      try {
        switch (action) {
          case 'broadcasted':
            resolve(await this.onTxpBroadcast(txp, cb));
          case 'rejected':
            const slot = this.findSlot({ proposalId: txp.id, nonce: txp.nonce });
            resolve(slot ? slot.free() : false);
          case 'sign':
          case 'error': // ?
          default:
            break;
        }
        resolve(false);
      } catch (err) {
        reject(err);
      }
    });
  }

  private onTxpBroadcast(txp, cb) {
    return new Promise(async (resolve, reject) => {
      const front = this.slotBuffer[this.head];
      if (front.nonce != txp.nonce || front.proposalId != txp.id) {
        const slot = this.findSlot({ proposalId: txp.id, nonce: txp.nonce });
        if (slot) slot.free(); // free slot if it exists
        return reject(new Error(Errors.NONCE_MISMATCH)); // add this to error constants
      }
      resolve(this.deQueue()); // will this return the value?
    });
  }

  public save(storage: Storage): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      try {
        await storage.storeNonceManager(this.walletId, this.chain, this.address, this);
        resolve(true);
      } catch (err) {
        reject(err);
      }
    });
  }
}

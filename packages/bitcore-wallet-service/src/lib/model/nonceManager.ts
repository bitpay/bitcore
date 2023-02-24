import logger from '../logger';
import { ChainService } from '../chain/index';

const MAX_SLOTS = 50; // max size of slotBuffer and max amount of pending transacitons
const $ = require('preconditions').singleton();

export class NonceSlot {
  public nonce: number;
  public proposalId: string;

  constructor(nonce: number, proposalId: string) {
    this.nonce = nonce;
    this.proposalId = proposalId;
  }

  public free(): void {
    this.proposalId = undefined;
  }

  public assign(proposalId): number {
    this.proposalId = proposalId;
    return this.nonce;
  }

  public isFree(): boolean {
    return this.proposalId ? true : false;
  }
}

export class NonceManager {
  public walletId: string;
  public address: string;
  public chain: string;
  public nextNonce: number;
  private slotBuffer: NonceSlot[]; // implemeted as a ring buffer / circular queue
  private head: number; // front of queue pointer
  private tail: number; // back of queue pointer

  static create(opts) {
    //, server, wallet){
    opts = opts || {};

    let x = new NonceManager();

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

    // TODO assign what needs to be assigned

    return x;
  }

  // Assigns a given TransactionProposal ID to a NonceSlot and returns the assigned nonce
  public async assign(server, wallet, proposalId) {
    $.checkState(wallet.id.toString() === this.walletId, 'Wallet parameter does not match NonceMangers Wallet ID');
    $.checkState(server.walletID === this.walletId, 'Server wallet does not match NonceMangers wallet');

    let curNonce: number;
    try {
      // TODO make sure we account for pending txs in getTransactionCount
      curNonce = await ChainService.getTransactionCount(server, wallet, this.address);
    } catch (err) {
      logger.debug(err);
      curNonce = this.nextNonce;
    }
    // curNonce will eqaul to head nonce when TXP's havent been broadcasted
    if (curNonce != this.slotBuffer[this.head].nonce) {
      if (curNonce < this.nextNonce) {
        // there is likely a nonce gap. check for free slots and use if found
        let slot = this.getNextFreeSlot();

        if (slot) {
          return slot.assign(proposalId);
        }
        // no free slots. we need to update all nonces in the queue
        this.nextNonce = curNonce;
        // TODO  do a nonceUpdate where we update all slots between head and tail with ascending values starting fron curNonce. make sure to adjust nextNonce
        // then do the following
        return this.enQueue(proposalId);
      }
      if (curNonce > this.nextNonce) {
        // some nonces were skipped. the address may have executed txs from a different wallet. lets catch up
        this.nextNonce = curNonce;
      }
    }

    return this.enQueue(proposalId);
  }

  private enQueue(proposalId: string): number {
    if (this.isFull()) {
      // TODO if isFull attempt a cleanse

      // Check if cleanse worked
      if (this.isFull()) return -1;
    }
    this.slotBuffer[this.tail] = new NonceSlot(this.nextNonce, proposalId);
    this.nextNonce++;
    this.tail = (this.tail + 1) % MAX_SLOTS;
    return this.nextNonce - 1;
  }

  private deQueue(): number {
    if (!this.isEmpty()) {
      const front = this.slotBuffer[this.head];
      this.head = (this.head + 1) % MAX_SLOTS;
      return front.nonce;
    }
    return -1;
  }

  private getNextFreeSlot(): NonceSlot {
    let i = this.head;
    while (this.nextQueueIndex(i) != -1) {
      if (this.slotBuffer[i] && this.slotBuffer[i].isFree()) {
        return this.slotBuffer[i];
      }
      i = this.nextQueueIndex(i);
    }
    return undefined;
  }

  // Get the next index within the circular queue which stops at the tail
  private nextQueueIndex(index): number {
    const next = (index + 1) % MAX_SLOTS;
    return (this.tail + 1) % MAX_SLOTS == next ? -1 : next;
  }

  // Get the next index within the entire array stopping before the head
  private nextIndex(index): number {
    const next = (index + 1) % MAX_SLOTS;
    return this.head % MAX_SLOTS == next ? -1 : next;
  }

  public freeSlotByNonce(nonce: number): boolean {
    let i = this.head;
    while (this.nextIndex(i) != -1) {
      if (this.slotBuffer[i] && this.slotBuffer[i].nonce == nonce) {
        this.slotBuffer[i].free();
        return true;
      }
      i = this.nextIndex(i);
    }
    return false;
  }

  public freeSlotByProposalId(proposalId: string): boolean {
    let i = this.head;
    while (this.nextIndex(i) != -1) {
      if (this.slotBuffer[i] && this.slotBuffer[i].proposalId == proposalId) {
        this.slotBuffer[i].free();
        return true;
      }
      i = this.nextIndex(i);
    }
    return false;
  }

  public clearSlotByNonce(nonce: number): boolean {
    let i = this.head;
    while (this.nextIndex(i) != -1) {
      if (this.slotBuffer[i] && this.slotBuffer[i].nonce == nonce) {
        this.slotBuffer[i] = undefined;
        return true;
      }
      i = this.nextIndex(i);
    }
    return false;
  }

  public clearSlotByProposalId(proposalId: string): boolean {
    let i = this.head;
    while (this.nextIndex(i) != -1) {
      if (this.slotBuffer[i] && this.slotBuffer[i].proposalId == proposalId) {
        this.slotBuffer[i] = undefined;
        return true;
      }
      i = this.nextIndex(i);
    }
    return false;
  }

  // checks to see if there are slots that can be cleared. starts from the head.
  private clearSlots(nonce: number) {
    let idx = 0;
    for (let i = 0; i < this.slotBuffer.length; i++) {
      if (this.slotBuffer[i] && this.slotBuffer[i].nonce === nonce) {
        idx = i;
        break;
      }
    }

    this.slotBuffer = idx ? this.slotBuffer.slice(idx, this.slotBuffer.length) : this.slotBuffer;
  }

  public getSlot(nonce: number): NonceSlot {
    for (let i = 0; i < this.slotBuffer.length; i++) {
      if (this.slotBuffer[i] && this.slotBuffer[i].nonce === nonce) {
        return this.slotBuffer[i];
      }
    }
    return null;
  }

  public isFull(): boolean {
    return (this.tail + 1) % MAX_SLOTS == this.head;
  }

  public isEmpty(): boolean {
    return this.head == this.tail;
  }
}

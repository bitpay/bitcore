import _ from 'lodash';
import { ChainService } from '../chain/index';
import logger from '../logger';
import { Lock } from '../lock';
import { Storage } from '../storage';
import { Address } from './address';
import { AddressManager } from './addressmanager';
import { Copayer } from './copayer';
import { Wallet } from './Wallet';
import { TxProposal } from './txproposal';


export class NonceManager {
  nonce: number;
  chain: string;
  walletId: string;
  priorityQueue: Array<string>; // string of proposalIds
  currentTxp: string;
  lock: Lock;

  create(){
  }

  updateNonce(_nonce){
    this.nonce = Number(_nonce);
  }

  assignNonce(proposalId){
    this.lock.acquire(this.walletId, {}, (err, res) => {
      if (err) { return err };
      this.currentTxp = proposalId;
      return ;
    });
  }

}
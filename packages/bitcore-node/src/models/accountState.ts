import { LoggifyClass } from '../decorators/Loggify';
import { StorageService } from '../services/storage';
import { BaseModel } from './base';

export interface AccountState {
  chain: string;
  network: string;
  blockHeight: number;
  nonce: number;
  balance: number;
  storageRoot: string;
  codeHash: string;
}

@LoggifyClass
class AccountStateModel extends BaseModel<AccountState> {
  allowedPaging = [{ key: 'blockHeight' as 'blockHeight', type: 'number' as 'number' }];
  constructor(storage?: StorageService) {
    super('accountState', storage);
  }

  onConnect() {
    this.collection.createIndex({ chain: 1, network: 1, address: 1, blockHeight: 1 }, { background: true });
    this.collection.createIndex({ chain: 1, network: 1, address: 1, nonce: 1 }, { background: true });
  }
}

export let AccountStateStorage = new AccountStateModel();

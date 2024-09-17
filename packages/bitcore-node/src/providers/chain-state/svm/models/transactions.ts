import { MongoBound } from '../../../../models/base';
import { BaseTransaction } from '../../../../models/baseTransaction';
import { Storage, StorageService } from '../../../../services/storage';
import { TransformOptions } from '../../../../types/TransformOptions';
import { IEVMTransaction } from '../../evm/types'; // TODO change to ISVMTransaction

export class SVMTransactionModel extends BaseTransaction<IEVMTransaction> {
  
  constructor(storage: StorageService = Storage) {
    super(storage);
  }

  _apiTransform(tx: IEVMTransaction | Partial<MongoBound<IEVMTransaction>>, options?: TransformOptions) {
    throw new Error(`Method not implemented${options}${tx}`);
  }
}

export let SVMTransactionStorage = new SVMTransactionModel();
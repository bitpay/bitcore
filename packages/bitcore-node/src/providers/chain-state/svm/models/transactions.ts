import { MongoBound } from '../../../../models/base';
import { BaseTransaction } from '../../../../models/baseTransaction';
import { Storage, StorageService } from '../../../../services/storage';
import { TransformOptions } from '../../../../types/TransformOptions';
import { ISVMTransaction } from '../../svm/types';

export class SVMTransactionModel extends BaseTransaction<ISVMTransaction> {
  
  constructor(storage: StorageService = Storage) {
    super(storage);
  }

  _apiTransform(tx: ISVMTransaction | Partial<MongoBound<ISVMTransaction>>, options?: TransformOptions) {
    throw new Error(`Method not implemented${options}${tx}`);
  }
}

export let SVMTransactionStorage = new SVMTransactionModel();
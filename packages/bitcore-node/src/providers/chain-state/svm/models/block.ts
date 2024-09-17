import { MongoBound } from '../../../../models/base';
import { BaseBlock } from '../../../../models/baseBlock';
import { TransformOptions } from '../../../../types/TransformOptions';
import { IEVMBlock } from '../../evm/types'; // TODO change to ISVMBlock

export class SVMBlockModel extends BaseBlock<IEVMBlock> {

  _apiTransform(block: IEVMBlock | Partial<MongoBound<IEVMBlock>>, options?: TransformOptions) {
    throw new Error(`Method not implemented${options}${block}`);
  }
  
}

export let SVMlockStorage = new SVMBlockModel();
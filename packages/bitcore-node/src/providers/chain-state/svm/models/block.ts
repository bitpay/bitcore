import { MongoBound } from '../../../../models/base';
import { BaseBlock } from '../../../../models/baseBlock';
import { TransformOptions } from '../../../../types/TransformOptions';
import { ISVMBlock } from '../../evm/types'; // TODO change to ISVMBlock

export class SVMBlockModel extends BaseBlock<ISVMBlock> {

  _apiTransform(block: ISVMBlock | Partial<MongoBound<ISVMBlock>>, options?: TransformOptions) {
    throw new Error(`Method not implemented${options}${block}`);
  }
  
}

export let SVMlockStorage = new SVMBlockModel();
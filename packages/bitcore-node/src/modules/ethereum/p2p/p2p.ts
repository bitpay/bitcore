import { EVMP2pWorker } from '../../../providers/chain-state/evm/p2p/p2p';
import type { Web3Types } from '@bitpay-labs/crypto-wallet-core';

export class EthP2pWorker extends EVMP2pWorker {
  getBlockReward(block: Web3Types.Block): number {
    let reward = 5;
    const height = BigInt(block.number);
    const ForkHeights = {
      Byzantium: 4370000n,
      Constantinople: 7280000n
    };

    if (height > ForkHeights.Constantinople) {
      reward = 2;
    } else if (height > ForkHeights.Byzantium) {
      reward = 3;
    }
    return reward;
  }
};

import { Constants, Web3 } from '@bitpay-labs/crypto-wallet-core';
import type { Effect } from '../types';

const web3 = new Web3();
const nativeEmitter = '0xfffffffffffffffffffffffffffffffffffffffe';
const transferInputs = [
  { name: 'from', type: 'address', indexed: true },
  { name: 'to', type: 'address', indexed: true },
  { name: 'value', type: 'uint256', indexed: false }
];
const transferSignature = web3.eth.abi.encodeEventSignature({ type: 'event', name: 'Transfer', inputs: transferInputs });

export function getArcUsdcEffects(logs: Array<any>, effects: Effect[] = []): Effect[] {
  // Receipt events replace native traces and the 6-decimal ERC20 USDC view.
  // Keep unrelated tokens.
  const normalized = effects.filter(effect => effect.contractAddress &&
    ![Constants.ARC.USDC_CONTRACT_ADDRESS, nativeEmitter].includes(effect.contractAddress.toLowerCase()));
  for (const log of logs) {
    if (log.address?.toLowerCase() !== nativeEmitter || log.topics?.[0]?.toLowerCase() !== transferSignature || log.removed) continue;
    const decoded = web3.eth.abi.decodeLog(transferInputs, log.data, log.topics.slice(1));
    normalized.push({
      from: String(decoded.from),
      to: String(decoded.to),
      amount: String(decoded.value),
      callStack: String(log.logIndex)
    });
  }
  return normalized;
}

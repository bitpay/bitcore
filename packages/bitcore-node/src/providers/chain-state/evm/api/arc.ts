import { Constants, Web3 } from '@bitpay-labs/crypto-wallet-core';
import type { Effect } from '../types';

const web3 = new Web3();
const nativeEmitter = '0xfffffffffffffffffffffffffffffffffffffffe';
const legacyEmitter = '0x1800000000000000000000000000000000000000';
const zeroAddress = '0x0000000000000000000000000000000000000000';
const transferInputs = [
  { name: 'from', type: 'address', indexed: true },
  { name: 'to', type: 'address', indexed: true },
  { name: 'value', type: 'uint256', indexed: false }
];
const transferSignature = web3.eth.abi.encodeEventSignature({ type: 'event', name: 'Transfer', inputs: transferInputs });
const legacyTransferSignature = web3.eth.abi.encodeEventSignature('NativeCoinTransferred(address,address,uint256)');
const legacyMintSignature = web3.eth.abi.encodeEventSignature('NativeCoinMinted(address,uint256)');
const legacyBurnSignature = web3.eth.abi.encodeEventSignature('NativeCoinBurned(address,uint256)');
const legacyAccountInputs = [
  { name: 'account', type: 'address', indexed: true },
  { name: 'value', type: 'uint256', indexed: false }
];

export function getArcUsdcEffects(logs: Array<any>, effects: Effect[] = [], network?: string): Effect[] {
  // Receipt events replace native traces and the 6-decimal ERC20 USDC view.
  // Keep unrelated tokens.
  const normalized = effects.filter(effect => effect.contractAddress &&
    ![Constants.ARC.USDC_CONTRACT_ADDRESS, nativeEmitter, legacyEmitter].includes(effect.contractAddress.toLowerCase()));
  for (const log of logs) {
    if (log.removed) continue;
    const address = log.address?.toLowerCase();
    const signature = log.topics?.[0]?.toLowerCase();
    // Pre-Zero5 testnet used NativeCoinAuthority events; mainnet has always used Transfer.
    const isLegacy = network === 'testnet' && address === legacyEmitter;
    const isTransfer = (address === nativeEmitter && signature === transferSignature) ||
      (isLegacy && signature === legacyTransferSignature);
    const isMint = isLegacy && signature === legacyMintSignature;
    const isBurn = isLegacy && signature === legacyBurnSignature;
    if (!isTransfer && !isMint && !isBurn) continue;
    const decoded = web3.eth.abi.decodeLog(isTransfer ? transferInputs : legacyAccountInputs, log.data, log.topics.slice(1));
    normalized.push({
      from: String(isMint ? zeroAddress : isBurn ? decoded.account : decoded.from),
      to: String(isBurn ? zeroAddress : isMint ? decoded.account : decoded.to),
      amount: String(decoded.value),
      callStack: String(log.logIndex)
    });
  }
  return normalized;
}

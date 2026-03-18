import type { API } from '../lib/api';
import type { Key } from '../lib/key';
import type { EventEmitter } from 'events';


export class ServerAssistedImportEvents extends EventEmitter {
  /** Total number of key configurations to be checked (not all configurations will necessarily be processed, as the process may exit early if wallets are found) */
  on(event: 'keyConfig.count', listener: (count: number) => void): this;
  /** Index of the current key configuration being processed */
  on(event: 'keyConfig.start', listener: (index: number) => void): this;
  /** A key was successfully created from the provided backup data */
  on(event: 'keyConfig.keyCreated', listener: () => void): this;
  /** Total number of permutations of [chain/coin, network, and derivation strategy] to be checked for each key configuration */
  on(event: 'chainPermutations.count', listener: (count: number) => void): this;
  /** Index of the current permutation being processed; the key is derived along the permutation to be sent to BWS for existence check */
  on(event: 'chainPermutations.getKey', listener: (index: number) => void): this;
  /** Number of copayers being sent to BWS to check for existence. Called inside a loop and may fire more than once */
  on(event: 'findingCopayers', listener: (num: number) => void): this;
  /** Number of copayers found in BWS for a single loop iteration (not the running total) */
  on(event: 'foundCopayers', listener: (num: number) => void): this;
  /** Total number of copayers found in BWS — sum of all `foundCopayers` events, emitted when the copayer-check loop is complete */
  on(event: 'foundCopayers.count', listener: (count: number) => void): this;
  /** No copayers were found for the current key configuration; moving on to the next one (if any) */
  on(event: 'keyConfig.noCopayersFound', listener: () => void): this;
  /** Client credentials are being created for the found copayers */
  on(event: 'creatingCredentials', listener: () => void): this;
  /** Wallet statuses are being fetched from BWS for the found copayers */
  on(event: 'gettingStatuses', listener: () => void): this;
  /** Number of wallets being processed to gather wallet info */
  on(event: 'gatheringWalletsInfos', listener: (num: number) => void): this;
  /** Token info is being gathered for a wallet of the given chain/network */
  on(event: 'walletInfo.gatheringTokens', listener: (data: { chain: string; network: string }) => void): this;
  /** Gathering token info failed for a wallet of the given chain/network */
  on(event: 'walletInfo.gatheringTokens.error', listener: (data: { chain: string; network: string; error: Error }) => void): this;
  /** A token wallet is being imported for a wallet of the given chain/network */
  on(event: 'walletInfo.importingToken', listener: (data: { chain: string; network: string; tokenName: string; tokenAddress: string }) => void): this;
  /** Multisig info is being gathered for a wallet of the given chain/network */
  on(event: 'walletInfo.gatheringMultisig', listener: (data: { chain: string; network: string }) => void): this;
  /** Multisig wallet credentials are being created for a wallet of the given chain/network */
  on(event: 'walletInfo.multisig.creatingCredentials', listener: (data: { chain: string; network: string; walletName: string; multisigContractAddress: string; m: number; n: number }) => void): this;
  /** A token wallet is being imported for a multisig wallet of the given chain/network */
  on(event: 'walletInfo.multisig.importingToken', listener: (data: { chain: string; network: string; walletName: string; multisigContractAddress: string; tokenName: string; tokenAddress: string }) => void): this;
  /** Terminating error that was thrown during the process */
  on(event: 'error', listener: (error: Error) => void): this;
  /** Final result containing the recovered key and all imported wallet clients */
  on(event: 'done', listener: (data: { key: Key; clients: API[] }) => void): this;

  /** Total number of key configurations to be checked (not all configurations will necessarily be processed, as the process may exit early if wallets are found) */
  once(event: 'keyConfig.count', listener: (count: number) => void): this;
  /** Index of the current key configuration being processed */
  once(event: 'keyConfig.start', listener: (index: number) => void): this;
  /** A key was successfully created from the provided backup data */
  once(event: 'keyConfig.keyCreated', listener: () => void): this;
  /** Total number of permutations of [chain/coin, network, and derivation strategy] to be checked for each key configuration */
  once(event: 'chainPermutations.count', listener: (count: number) => void): this;
  /** Index of the current permutation being processed; the key is derived along the permutation to be sent to BWS for existence check */
  once(event: 'chainPermutations.getKey', listener: (index: number) => void): this;
  /** Number of copayers being sent to BWS to check for existence. Called inside a loop and may fire more than once */
  once(event: 'findingCopayers', listener: (num: number) => void): this;
  /** Number of copayers found in BWS for a single loop iteration (not the running total) */
  once(event: 'foundCopayers', listener: (num: number) => void): this;
  /** Total number of copayers found in BWS — sum of all `foundCopayers` events, emitted when the copayer-check loop is complete */
  once(event: 'foundCopayers.count', listener: (count: number) => void): this;
  /** No copayers were found for the current key configuration; moving on to the next one (if any) */
  once(event: 'keyConfig.noCopayersFound', listener: () => void): this;
  /** Client credentials are being created for the found copayers */
  once(event: 'creatingCredentials', listener: () => void): this;
  /** Wallet statuses are being fetched from BWS for the found copayers */
  once(event: 'gettingStatuses', listener: () => void): this;
  /** Number of wallets being processed to gather wallet info */
  once(event: 'gatheringWalletsInfos', listener: (num: number) => void): this;
  /** Token info is being gathered for a wallet of the given chain/network */
  once(event: 'walletInfo.gatheringTokens', listener: (data: { chain: string; network: string }) => void): this;
  /** Gathering token info failed for a wallet of the given chain/network */
  once(event: 'walletInfo.gatheringTokens.error', listener: (data: { chain: string; network: string; error: Error }) => void): this;
  /** A token wallet is being imported for a wallet of the given chain/network */
  once(event: 'walletInfo.importingToken', listener: (data: { chain: string; network: string; tokenName: string; tokenAddress: string }) => void): this;
  /** Multisig info is being gathered for a wallet of the given chain/network */
  once(event: 'walletInfo.gatheringMultisig', listener: (data: { chain: string; network: string }) => void): this;
  /** Multisig wallet credentials are being created for a wallet of the given chain/network */
  once(event: 'walletInfo.multisig.creatingCredentials', listener: (data: { chain: string; network: string; walletName: string; multisigContractAddress: string; m: number; n: number }) => void): this;
  /** A token wallet is being imported for a multisig wallet of the given chain/network */
  once(event: 'walletInfo.multisig.importingToken', listener: (data: { chain: string; network: string; walletName: string; multisigContractAddress: string; tokenName: string; tokenAddress: string }) => void): this;
  /** Terminating error that was thrown during the process */
  once(event: 'error', listener: (error: Error) => void): this;
  /** Final result containing the recovered key and all imported wallet clients */
  once(event: 'done', listener: (data: { key: Key; clients: API[] }) => void): this;

  /** Total number of key configurations to be checked (not all configurations will necessarily be processed, as the process may exit early if wallets are found) */
  addListener(event: 'keyConfig.count', listener: (count: number) => void): this;
  /** Index of the current key configuration being processed */
  addListener(event: 'keyConfig.start', listener: (index: number) => void): this;
  /** A key was successfully created from the provided backup data */
  addListener(event: 'keyConfig.keyCreated', listener: () => void): this;
  /** Total number of permutations of [chain/coin, network, and derivation strategy] to be checked for each key configuration */
  addListener(event: 'chainPermutations.count', listener: (count: number) => void): this;
  /** Index of the current permutation being processed; the key is derived along the permutation to be sent to BWS for existence check */
  addListener(event: 'chainPermutations.getKey', listener: (index: number) => void): this;
  /** Number of copayers being sent to BWS to check for existence. Called inside a loop and may fire more than once */
  addListener(event: 'findingCopayers', listener: (num: number) => void): this;
  /** Number of copayers found in BWS for a single loop iteration (not the running total) */
  addListener(event: 'foundCopayers', listener: (num: number) => void): this;
  /** Total number of copayers found in BWS — sum of all `foundCopayers` events, emitted when the copayer-check loop is complete */
  addListener(event: 'foundCopayers.count', listener: (count: number) => void): this;
  /** No copayers were found for the current key configuration; moving on to the next one (if any) */
  addListener(event: 'keyConfig.noCopayersFound', listener: () => void): this;
  /** Client credentials are being created for the found copayers */
  addListener(event: 'creatingCredentials', listener: () => void): this;
  /** Wallet statuses are being fetched from BWS for the found copayers */
  addListener(event: 'gettingStatuses', listener: () => void): this;
  /** Number of wallets being processed to gather wallet info */
  addListener(event: 'gatheringWalletsInfos', listener: (num: number) => void): this;
  /** Token info is being gathered for a wallet of the given chain/network */
  addListener(event: 'walletInfo.gatheringTokens', listener: (data: { chain: string; network: string }) => void): this;
  /** Gathering token info failed for a wallet of the given chain/network */
  addListener(event: 'walletInfo.gatheringTokens.error', listener: (data: { chain: string; network: string; error: Error }) => void): this;
  /** A token wallet is being imported for a wallet of the given chain/network */
  addListener(event: 'walletInfo.importingToken', listener: (data: { chain: string; network: string; tokenName: string; tokenAddress: string }) => void): this;
  /** Multisig info is being gathered for a wallet of the given chain/network */
  addListener(event: 'walletInfo.gatheringMultisig', listener: (data: { chain: string; network: string }) => void): this;
  /** Multisig wallet credentials are being created for a wallet of the given chain/network */
  addListener(event: 'walletInfo.multisig.creatingCredentials', listener: (data: { chain: string; network: string; walletName: string; multisigContractAddress: string; m: number; n: number }) => void): this;
  /** A token wallet is being imported for a multisig wallet of the given chain/network */
  addListener(event: 'walletInfo.multisig.importingToken', listener: (data: { chain: string; network: string; walletName: string; multisigContractAddress: string; tokenName: string; tokenAddress: string }) => void): this;
  /** Terminating error that was thrown during the process */
  addListener(event: 'error', listener: (error: Error) => void): this;
  /** Final result containing the recovered key and all imported wallet clients */
  addListener(event: 'done', listener: (data: { key: Key; clients: API[] }) => void): this;

  removeListener(event: 'keyConfig.count', listener: (count: number) => void): this;
  removeListener(event: 'keyConfig.start', listener: (index: number) => void): this;
  removeListener(event: 'keyConfig.keyCreated', listener: () => void): this;
  removeListener(event: 'chainPermutations.count', listener: (count: number) => void): this;
  removeListener(event: 'chainPermutations.getKey', listener: (index: number) => void): this;
  removeListener(event: 'findingCopayers', listener: (num: number) => void): this;
  removeListener(event: 'foundCopayers', listener: (num: number) => void): this;
  removeListener(event: 'foundCopayers.count', listener: (count: number) => void): this;
  removeListener(event: 'keyConfig.noCopayersFound', listener: () => void): this;
  removeListener(event: 'creatingCredentials', listener: () => void): this;
  removeListener(event: 'gettingStatuses', listener: () => void): this;
  removeListener(event: 'gatheringWalletsInfos', listener: (num: number) => void): this;
  removeListener(event: 'walletInfo.gatheringTokens', listener: (data: { chain: string; network: string }) => void): this;
  removeListener(event: 'walletInfo.gatheringTokens.error', listener: (data: { chain: string; network: string; error: Error }) => void): this;
  removeListener(event: 'walletInfo.importingToken', listener: (data: { chain: string; network: string; tokenName: string; tokenAddress: string }) => void): this;
  removeListener(event: 'walletInfo.gatheringMultisig', listener: (data: { chain: string; network: string }) => void): this;
  removeListener(event: 'walletInfo.multisig.creatingCredentials', listener: (data: { chain: string; network: string; walletName: string; multisigContractAddress: string; m: number; n: number }) => void): this;
  removeListener(event: 'walletInfo.multisig.importingToken', listener: (data: { chain: string; network: string; walletName: string; multisigContractAddress: string; tokenName: string; tokenAddress: string }) => void): this;
  removeListener(event: 'error', listener: (error: Error) => void): this;
  removeListener(event: 'done', listener: (data: { key: Key; clients: API[] }) => void): this;
}

import url from 'url';
import * as prompt from '@clack/prompts';
import { TssSign } from 'bitcore-wallet-client';
import { type Types as CWCTypes, Transactions } from 'crypto-wallet-core';
import {
  type TssKeyType,
  type WalletData
} from '../types/wallet';
import { UserCancelled } from './errors';

/**
 * Sign a message using TSS
 * @returns hex-encoded signature and public key
 */
export async function sign(args: {
  host: string;
  chain: string;
  walletData: WalletData;
  messageHash: Buffer;
  derivationPath: string;
  password?: string;
  id?: string;
  logMessageWaiting?: string;
  logMessageCompleted?: string;
}): Promise<CWCTypes.Message.ISignedMessage<string>> {
  const { host, chain, walletData, messageHash, derivationPath, password, id, logMessageWaiting, logMessageCompleted } = args;

  const transformISignature = (signature: TssSign.ISignature): string => {
    return Transactions.transformSignatureObject({ chain, obj: signature });
  };

  const tssSign = new TssSign.TssSign({
    baseUrl: url.resolve(host, '/bws/api'),
    credentials: walletData.credentials,
    tssKey: walletData.key as TssKeyType
  });

  try {
    await tssSign.start({
      id,
      messageHash,
      derivationPath,
      password
    });
  } catch (err) {
    if (err.message?.startsWith('TSS_ROUND_ALREADY_DONE')) {
      const sig = await tssSign.getSignatureFromServer();
      if (!sig) {
        throw new Error('It looks like the TSS signature session was interrupted. Try deleting this proposal and creating a new one.');
      }
      return {
        signature: transformISignature(sig),
        publicKey: sig.pubKey
      };
    }
    throw err;
  }
  const spinner = prompt.spinner({ indicator: 'timer' });
  spinner.start(logMessageWaiting || 'Waiting for all parties to join...');

  const sig = await new Promise<CWCTypes.Message.ISignedMessage<string>>((resolve, reject) => {
    process.on('SIGINT', () => {
      tssSign.unsubscribe();
      spinner.stop('Cancelled by user');
      reject(new UserCancelled());
    });

    tssSign.subscribe();
    tssSign.on('roundsubmitted', (round) => spinner.message(`Round ${round} submitted`));
    tssSign.on('error', prompt.log.error);
    tssSign.on('complete', async () => {
      try {
        spinner.stop(logMessageCompleted || 'TSS signature generated');
        const signature: TssSign.ISignature = tssSign.getSignature();
        const sigString = transformISignature(signature);
        resolve({
          signature: sigString,
          publicKey: signature.pubKey
        });
      } catch (err) {
        reject(err);
      }
    });
  });

  return sig;
}
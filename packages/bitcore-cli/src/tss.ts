import fs from 'fs';
import path from 'path';
import url from 'url';
import { Encryption, Errors, TssSign } from '@bitpay-labs/bitcore-wallet-client';
import { type Types as CWCTypes, Transactions } from '@bitpay-labs/crypto-wallet-core';
import * as prompt from '@clack/prompts';
import {
  type TssKeyType,
  type WalletData
} from '../types/wallet';
import { ProcessCancelled, UserCancelled } from './errors';

/**
 * Sign a message using TSS
 * @returns hex-encoded signature and public key
 */
export async function sign(args: {
  host: string;
  chain: string;
  walletData: WalletData;
  stateStoragePath: string;
  messageHash: Buffer;
  derivationPath: string;
  password: string;
  id: string;
  logMessageWaiting?: string;
  logMessageCompleted?: string;
}): Promise<CWCTypes.Message.ISignedMessage<string>> {
  const { host, chain, walletData, stateStoragePath, messageHash, derivationPath, password, id, logMessageWaiting, logMessageCompleted } = args;
  const storedSessionFile = path.join(stateStoragePath, id);

  const transformISignature = (signature: TssSign.ISignature): string => {
    return Transactions.transformSignatureObject({ chain, obj: signature });
  };

  const storeSession = (session: string) => {
    const encrypted = JSON.stringify(Encryption.encryptWithPassword(session, password));
    fs.writeFileSync(storedSessionFile, encrypted, 'utf8');
  };

  const tssSign = new TssSign.TssSign({
    baseUrl: url.resolve(host, '/bws/api'),
    credentials: walletData.credentials,
    tssKey: walletData.key as TssKeyType
  });

  // Restore a previously-interrupted TSS session if it exists
  if (fs.existsSync(storedSessionFile)) {
    const storedSession = Encryption.decryptWithPassword(fs.readFileSync(storedSessionFile, 'utf8'), password);
    await tssSign.restoreSession({ session: storedSession.toString(), password });
    storedSession.fill(0); // Clear sensitive data from memory

  // ...otherwise, start a new TSS session
  } else {
    try {
      await tssSign.start({
        id,
        messageHash,
        derivationPath,
        password
      });
      storeSession(tssSign.exportSession());
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
  }

  const spinner = prompt.spinner({ indicator: 'timer', onCancel: () => { tssSign.unsubscribe(); } });
  spinner.start(logMessageWaiting || 'Waiting for all parties to join...');

  const sig = await new Promise<CWCTypes.Message.ISignedMessage<string>>((resolve, reject) => {
    tssSign.subscribe();
    tssSign.on('roundsubmitted', (round) => {
      storeSession(tssSign.exportSession());
      spinner.message(`Round ${round} submitted`);
    });
    tssSign.on('error', e => {
      if (e instanceof Errors.NOT_AUTHORIZED && e.message === 'Session not found') {
        tssSign.unsubscribe({ clearEvents: true });
        spinner.cancel('TSS session not found. It may have been deleted by another party.');
        return reject(new ProcessCancelled());
      }
      prompt.log.error('Unexpected error during TSS signing: ' + (e.stack || e));
    });
    tssSign.on('complete', async () => {
      try {
        spinner.stop(logMessageCompleted || 'TSS signature generated');
        // Clean up the stored session file after successful signing
        fs.rmSync(storedSessionFile, { force: true });
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
    tssSign.on('unsubscribe', () => {
      reject(new UserCancelled());
    });
  });

  return sig;
}
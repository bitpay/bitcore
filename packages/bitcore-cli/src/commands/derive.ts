import os from 'os';
import { Deriver } from '@bitpay-labs/crypto-wallet-core';
import * as prompt from '@clack/prompts';
import { Command } from 'commander';
import { UserCancelled } from '../errors';
import { getAction } from '../prompts';
import type { CommonArgs } from '../../types/cli';

export function command() {
  return new Command('derive')
    .description('Derive a key or address from the wallet')
    .optionsGroup('Derivation Options')
    .option('--path <path>', 'Derivation path to use (e.g. m/0/1)');
}

export async function deriveKey(args: CommonArgs<{ path?: string }>) {
  const { wallet, opts } = args;

  const promptAction = async () => {
    const a = await getAction({
      options: [
        { label: '↻ Redo', value: 'again', hint: 'Derive another key' },
      ]
    });
    if (prompt.isCancel(a)) {
      throw new UserCancelled();
    }
    return a;
  };

  let action: string;
  do {
    try {
      const path = opts.path || await prompt.text({
        message: 'Enter the derivation path:',
        placeholder: 'e.g. m/0/1',
        validate: (input) => {
          if (!input || !input.startsWith('m/')) {
            return 'Invalid derivation path. It should start with "m/"';
          }
          return null; // Valid input
        }
      });
      if (prompt.isCancel(path)) {
        throw new UserCancelled();
      }

      const hardened = path.includes('\'');


      if (hardened) {
        // hardened paths can only be derived from a private key
        const xPrivKey = await wallet.getXPrivKey();
        const derived = Deriver.derivePrivateKeyWithPath(
          wallet.client.credentials.chain,
          wallet.client.credentials.network,
          xPrivKey,
          path,
          wallet.client.credentials.addressType || 'P2PKH'
        );
        const lines = [];
        lines.push(`Address: ${derived.address}`);
        lines.push(`Public Key: ${derived.pubKey}`);
        lines.push(`Private Key: ${derived.privKey}`);
        prompt.note(lines.join(os.EOL), `Derived Key (${path})`);
      } else {
        const xPubKey = wallet.getXPubKey();
        const address = Deriver.deriveAddressWithPath(
          wallet.client.credentials.chain,
          wallet.client.credentials.network,
          xPubKey,
          path,
          wallet.client.credentials.addressType || 'P2PKH'
        );
        prompt.note(`${address}`, `Derived Address (${path})`);
      }

      action = opts.command ? 'exit' : await promptAction();
    } catch (err) {
      if (!(err instanceof UserCancelled)) {
        prompt.log.error(opts.verbose ? (err.stack || err.message) : err.message);
      }
      action = opts.command ? 'exit' : await promptAction();
    }
  } while (action === 'again');

  return { action };
};

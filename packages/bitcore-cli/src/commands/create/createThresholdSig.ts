import crypto from 'crypto';
import os from 'os';
import url from 'url';
import { Key, type Network, TssKey } from '@bitpay-labs/bitcore-wallet-client';
import * as prompt from '@clack/prompts';
import { UserCancelled } from '../../errors';
import { getAddressType, getCopayerName, getPassword, promptKeyshareBackup } from '../../prompts';
import { Utils } from '../../utils';
import { exportWallet } from '../export';
import type { CommonArgs } from '../../../types/cli';


export async function createThresholdSigWallet(
  args: CommonArgs<{ mnemonic?: string }> & {
    chain: string;
    network: Network;
    m: number;
    n: number;
  }
) {
  const { wallet, chain, network, m, n, opts } = args;
  const { verbose, mnemonic } = opts;

  if (chain.toLowerCase() === 'sol') {
    throw new Error('Threshold signature wallets are not currently supported for Solana.');
  }

  const copayerName = await getCopayerName();
  const addressType = await getAddressType({ chain, network, isMultiSig: false, isTss: true });
  const password = await getPassword('Lock your wallet with a password:', { hidden: false });

  let key;
  if (mnemonic) {
    key = new Key({ seedType: 'mnemonic', seedData: mnemonic, password });
  } else {
    key = new Key({ seedType: 'new', password });
  }
  
  const tss = new TssKey.TssKeyGen({
    chain,
    network,
    baseUrl: url.resolve(opts.host, '/bws/api'),
    key,
    password
  });
  
  const tssPassword = crypto.randomBytes(20).toString('hex');
  await tss.newKey({ m, n, password: tssPassword });
  
  prompt.note(
    'Next, you will be asked to enter party 1\'s public key. Once you enter it, ' +
    'a personal join code will be generated for you to give to them.' + os.EOL +
    'To get their public key, party 1 should go ahead and start the join process ' +
    'for their wallet by running bitcore-cli and selecting `Join Wallet`. Then they follow the ' +
    'prompts until it tells them to share the public key with the session leader (you).' + os.EOL + os.EOL +
    'Repeat this process for the other party members. Once all members have joined, the TSS ' +
    'wallet creation process will finish.'
  );

  for (let i = 1; i < n; i++) {
    const pubkey = await prompt.text({
      message: `Enter party ${i}'s public key:`,
      validate: (input) => input ? undefined : 'Public key cannot be empty.',
    });
    if (prompt.isCancel(pubkey)) {
      throw new UserCancelled();
    }
    
    const joinCode = await tss.createJoinCode({
      partyId: i,
      partyPubKey: pubkey,
      extra: tssPassword
    });

    let joinCodeAction: 'copy' | 'continue' | 'goBack' | symbol;
    do {
      joinCodeAction = await prompt.select({
        message: joinCodeAction === 'copy' ? 'Copied!' : `Join code for party ${i}:${os.EOL}${joinCode}`,
        initialValue: joinCodeAction === 'copy' ? 'continue' : 'copy',
        options: [
          {
            label: 'Continue →',
            value: 'continue'
          },
          {
            label: 'Copy to clipboard ⎘',
            value: 'copy'
          },
          {
            label: '↩ Go Back',
            value: 'goBack',
            hint: `Re-enter party ${i}'s public key`
          }
        ]
      });
      if (prompt.isCancel(joinCodeAction)) {
        throw new UserCancelled();
      }

      switch (joinCodeAction) {
        case 'goBack':
          i--; // Retry this party
          break;
        case 'copy':
          try {
            Utils.copyToClipboard(joinCode);
          } catch (error) {
            prompt.log.error(`Error copying to clipboard: ${error instanceof Error ? error.message : String(error)}`);
            joinCodeAction = null; // Reset to re-prompt the user
          }
          break;
        case 'continue':
          break;
      }
    } while (joinCodeAction !== 'continue');
  }

  const spinner = prompt.spinner({ indicator: 'timer' });
  spinner.start('Waiting for all parties to join...');

  await new Promise<void>((resolve, reject) => {
    process.on('SIGINT', () => {
      tss.unsubscribe();
      spinner.stop('Cancelled by user');
      reject(new UserCancelled());
    });

    tss.subscribe({
      walletName: wallet.name,
      copayerName,
      createWalletOpts: Utils.getSegwitInfo(addressType)
    });
    tss.on('roundsubmitted', (round) => spinner.message(`Round ${round} submitted`));
    tss.on('error', prompt.log.error);
    tss.on('wallet', async (_wallet) => {
      // TODO: what to do with the wallet?
      // console.log('Created wallet at BWS:', wallet);
    });
    tss.on('complete', async () => {
      try {
        spinner.stop('TSS Key Generation Complete!');

        const key = tss.getTssKey(password);
        await wallet.createFromTss({
          key,
          chain,
          network,
          password,
          addressType,
          copayerName
        });

        verbose && prompt.log.step(`Wallet file saved to: ${Utils.colorText(wallet.filename, 'blue')}`);

        // const pubKey = CWC.BitcoreLib.HDPublicKey(key.getXPubKey()).publicKey;
        // const address = CWC.Deriver.getAddress(chain, network, pubKey);
        // console.log('Address:', address);

        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });


  // Keyshare backup
  const ok = await promptKeyshareBackup();
  if (ok) {
    await exportWallet({ wallet, opts: { ...opts, readonly: false } });
  }

  return {
    // TSS wallets cannot be restored from a mnemonic alone, so we return null here. All the wallet recovery information is in the keyshare backup file.
    mnemonic: null
  };
}

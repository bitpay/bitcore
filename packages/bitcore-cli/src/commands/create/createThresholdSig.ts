import * as prompt from '@clack/prompts';
import { Key, Network, TssKey } from 'bitcore-wallet-client'
import crypto from 'crypto';
import os from 'os';
import url from 'url';
import { UserCancelled } from '../../errors';
import { getAddressType, getCopayerName, getPassword } from '../../prompts';
import { Utils } from '../../utils';
import { Wallet } from '../../wallet';


export async function createThresholdSigWallet(args: {
  wallet: Wallet;
  chain: string;
  network: Network;
  m: number;
  n: number;
  opts: {
    dir: string;
    host: string;
    verbose: boolean;
    mnemonic?: string;
  };
}) {
  const { wallet, chain, network, m, n, opts } = args;
  const { verbose, mnemonic } = opts;

  const copayerName = await getCopayerName();
  const addressType = await getAddressType({ chain, network, isMultiSig: false }); // TSS is treated as a single-sig
  const password = await getPassword('Enter a password for the wallet:', { hidden: false });

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
  
  for (let i = 1; i < n; i++) {
    const pubkey = await prompt.text({
      message: `Enter party ${i}'s public key:`,
      validate: (input) => !!input ? undefined : 'Public key cannot be empty.',
    });
    if (prompt.isCancel(pubkey)) {
      throw new UserCancelled();
    }
    
    const joinCode = await tss.createJoinCode({
      partyId: i,
      partyPubKey: pubkey,
      extra: tssPassword
    });

    const goBack = await prompt.select({
      message: `Join code for party ${i}:${os.EOL}${joinCode}`,
      initialValue: false,
      options: [
        {
          label: 'Continue →',
          value: false
        },
        {
          label: '↩ Go Back',
          value: true,
          hint: `Re-enter party ${i}'s public key`
        }
      ]
    });
    if (prompt.isCancel(goBack)) {
      throw new UserCancelled();
    }

    if (goBack) {
      i--; // Retry this party
    }
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
    tss.on('wallet', async (wallet) => {
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

  return {
    mnemonic: key.get(password).mnemonic
  };
}

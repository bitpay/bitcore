import * as prompt from '@clack/prompts';
import { Key, TssKey } from 'bitcore-wallet-client'
import os from 'os';
import url from 'url';
import { UserCancelled } from '../../errors';
import { getCopayerName, getNetwork, getPassword } from '../../prompts';
import { Utils } from '../../utils';
import { Wallet } from '../../wallet';
import { ICliOptions } from '../../../types/cli';

export async function joinThresholdSigWallet(args: {
  wallet: Wallet;
  chain: string;
  opts: ICliOptions & {
    mnemonic?: string;
  };
}) {
  const { wallet, chain, opts } = args;
  const { verbose, mnemonic } = opts;
  
  const network = await getNetwork();
  const copayerName = await getCopayerName();
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
  
  const authPubKey = tss.getAuthPublicKey();
  const done = await prompt.select({
    message: `Give the following public key to the session leader:${os.EOL}${Utils.colorText(authPubKey, 'blue')}`,
    options: [{ label: 'Done', value: true, hint: 'Hit Enter/Return to continue' }]
  });
  if (prompt.isCancel(done)) {
    throw new UserCancelled();
  }

  const joinCode = await prompt.text({
    message: 'Enter the join code from the session leader:',
    validate: (code) => {
      try {
        const decryptedJoinCode = tss.checkJoinCode({ code });
        if (decryptedJoinCode.chain.toLowerCase() !== chain || decryptedJoinCode.network.toLowerCase() !== network) {
          return `Join code chain + network (${decryptedJoinCode.chain}:${decryptedJoinCode.network}) does not match what you specified for this wallet (${chain}:${network}).`;
        }
        return null; // Valid join code
      } catch (err) {
        return 'Invalid join code: ' + (verbose ? err.stack : err.message);
      }
    }
  });
  if (prompt.isCancel(joinCode)) {
    throw new UserCancelled();
  }

  if (verbose) {
    const decryptedJoinCode = tss.checkJoinCode({ code: joinCode });
    const ans = await prompt.confirm({
      message: `${JSON.stringify(decryptedJoinCode, null, 2)}${os.EOL}Is this correct?`,
      initialValue: true,
    });
    if (prompt.isCancel(ans) || !ans) {
      throw new UserCancelled();
    }
  }

  await tss.joinKey({ code: joinCode });

  const spinner = prompt.spinner({ indicator: 'timer' });
  spinner.start('Waiting for all parties to join...');

  await new Promise<void>((resolve, reject) => {
    process.on('SIGINT', () => {
      tss.unsubscribe();
      spinner.stop('Cancelled by user');
      reject(new UserCancelled());
    });
    tss.subscribe({ copayerName });
    tss.on('roundsubmitted', (round) => spinner.message(`Round ${round} submitted`));
    tss.on('error', prompt.log.error);
    tss.on('wallet', async (wallet) => {
      // TOOD: what to do with this?
      // console.log('Joined wallet at BWS:', wallet);
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
    })
  });

  return {
    mnemonic: key.get(password).mnemonic
  };
}
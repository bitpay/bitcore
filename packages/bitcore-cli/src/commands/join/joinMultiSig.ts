import * as prompt from '@clack/prompts';
import BWC from 'bitcore-wallet-client';
import { ICliOptions } from '../../../types/cli';
import { getCopayerName, getPassword } from '../../prompts';
import { Utils } from '../../utils';
import { Wallet } from '../../wallet';

export async function joinMultiSigWallet(args: {
  wallet: Wallet;
  opts: ICliOptions & {
    mnemonic?: string;
  }
}) {
  const { wallet, opts } = args;
  const { verbose, mnemonic } = opts;

  const secret = (await prompt.text({
    message: 'Enter the secret to join the wallet:',
    validate: (input) => !!input?.trim() ? null : 'Secret cannot be empty.',
  })).toString().trim();
  
  const parsed = BWC.parseSecret(secret);
  const {
    coin: chain,
    network
  } = parsed;

  const copayerName = await getCopayerName();
  const password = await getPassword('Enter a password for the wallet:', { hidden: false });
  const { key, creds } = await wallet.create({ chain, network, account: 0, n: 2, password, mnemonic, copayerName }); // n gets overwritten
  const joinedWallet = await wallet.client.joinWallet(secret, copayerName, { chain, network });
  await wallet.load(); // Is this needed after joining?
  
  prompt.log.success(Utils.colorText(`Wallet joined: ${joinedWallet.name}`, 'green'));
  verbose && prompt.log.step(`Wallet file saved to: ${Utils.colorText(wallet.filename, 'blue')}`);
  
  return {
    mnemonic: key.get(password).mnemonic,
  }
};
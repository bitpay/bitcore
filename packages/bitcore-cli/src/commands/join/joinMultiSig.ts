import BWC from '@bitpay-labs/bitcore-wallet-client';
import * as prompt from '@clack/prompts';
import { UserCancelled } from '../../errors';
import { getCopayerName, getPassword } from '../../prompts';
import { Utils } from '../../utils';
import type { CommonArgs } from '../../../types/cli';

export async function joinMultiSigWallet(args: CommonArgs<{ mnemonic?: string }>) {
  const { wallet, opts } = args;
  const { verbose, mnemonic } = opts;

  const joinSecret = await prompt.text({
    message: 'Enter the secret to join the wallet:',
    validate: (input) => input?.trim() ? null : 'Secret cannot be empty.',
  });
  if (prompt.isCancel(joinSecret)) {
    throw new UserCancelled();
  }
  
  const parsed = BWC.parseSecret(joinSecret.trim());
  const {
    coin: chain,
    network
  } = parsed;

  const copayerName = await getCopayerName();
  const password = await getPassword('Enter a password for the wallet:', { hidden: false });
  const { key, joinedWalletName } = await wallet.create({ chain, network, account: 0, n: 2, m: 1, password, mnemonic, copayerName, joinSecret }); // n gets overwritten
  
  prompt.log.success(Utils.colorText(`Wallet joined: ${joinedWalletName}`, 'green'));
  verbose && prompt.log.step(`Wallet file saved to: ${Utils.colorText(wallet.filename, 'blue')}`);
  
  return {
    mnemonic: key.get(password).mnemonic,
  };
};
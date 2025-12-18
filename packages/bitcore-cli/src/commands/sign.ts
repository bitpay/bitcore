import os from 'os';
import prompt from '@clack/prompts';
import { type Types as CWCTypes, Deriver, Validation } from 'crypto-wallet-core';
import { type CommonArgs } from '../../types/cli';
import { UserCancelled } from '../errors';
import { Utils } from '../utils';

type ISignedMessage = CWCTypes.Message.ISignedMessage<string>;

export function command(args: CommonArgs) {
  const { program } = args;
  program
    .description('Sign an arbitrary message with a wallet address')
    .usage('<walletName> --command sign [options]')
    .optionsGroup('Sign Options')
    .option('--message <message>', 'Message to sign')
    .option('--address <address>', 'Address to use for signing. Mutually exclusive with --path')
    .option('--path <path>', 'Derivation path to use for signing. Mutually exclusive with --address')
    .parse(process.argv);

  const opts = program.opts();
  if (opts.help) {
    program.help();
  }
  
  if (opts.path && opts.address) {
    throw new Error('Cannot use both --path and --address options. Use one of them to specify the signing address.');
  }
  
  return opts;
}


export async function signMessage(args: CommonArgs<{ message?: string; path?: string; address?: string }>) {
  const { wallet, opts } = args;
  if (opts.command) {
    Object.assign(opts, command(args));
  }

  if (wallet.isReadOnly()) {
    throw new Error('Read-only wallets cannot sign messages');
  }

  if (wallet.isMultiSig()) {
    throw new Error('MultiSig wallets cannot sign arbitrary messages');
  }

  const message = opts.message || await prompt.text({
    message: 'Enter the message to sign:',
    placeholder: 'Your message here',
    validate: (value) => {
      if (!value) {
        return 'Message cannot be empty';
      }
      return null; // Valid input
    }
  });

  if (prompt.isCancel(message)) {
    throw new UserCancelled();
  }

  let path: string | symbol = opts.path;
  const bal = await wallet.client.getBalance({});
  if (bal.byAddress.length <= 1) {
    path = bal.byAddress[0]?.path || 'm/0/0'; // Default to first address path if only one address exists
  } else if (opts.path) {
    path = opts.path;
    if (path !== 'm' && !path.startsWith('m/')) {
      throw new Error(`Invalid derivation path: ${path}. It should start with 'm/' (e.g., 'm/0/0')`);
    }
  } else if (opts.address) {
    const addresses = await wallet.client.getAddresses({ addresses: [opts.address] });
    if (!addresses[0] || !addresses[0].address) {
      throw new Error(`Address ${opts.address} not found in wallet`);
    }
    path = addresses[0]?.path;
  } else {
    do {
      const top10 = bal.byAddress.toSorted((a, b) => b.amount - a.amount).slice(0, 10);
      path = await prompt.select({
        message: 'Which address to use for signing?',
        options: top10.map((a) => ({
          label: `${a.address} (${Utils.renderAmount(wallet.chain, a.amount)} )`,
          value: a.path,
        })).concat([{
          label: 'Custom...',
          value: 'custom',
          hint: 'Specify a derivation path or address',
        }])
      });
      if (prompt.isCancel(path)) {
        throw new UserCancelled();
      }
      if (path === 'custom') {
        path = await prompt.text({
          message: 'Enter the derivation path or address to use for signing:',
          placeholder: 'm/0/0',
          validate: (value) => {
            if (!value) {
              return 'Value cannot be empty';
            }
            if (!value.match(/^m(\/\d+)+$/) && !Validation.validateAddress(wallet.chain, wallet.network, value)) {
              return 'Invalid derivation path or address';
            }
            return null; // Valid input
          }
        });
        if (prompt.isCancel(path)) {
          throw new UserCancelled();
        }
        if (!(path == 'm' || path.startsWith('m/'))) {
          const addresses = await wallet.client.getAddresses({ addresses: [path] });
          if (!addresses[0]?.path) {
            throw new Error(`Address ${path} not found in wallet`);
          }
          path = addresses[0].path;
        }
      }
    } while (!path);
  }

  const signature = await wallet.signMessage({
    message,
    derivationPath: path as string,
    encoding: 'hex'
  }) as ISignedMessage;

  const chain = wallet.client.credentials.chain;
  const network = wallet.client.credentials.network;
  const addressType = wallet.client.credentials.addressType;
  const address = Deriver.getAddress(chain, network, signature.publicKey, addressType);

  prompt.log.success(
    Utils.colorText('Signature: ', 'green') + signature.signature + os.EOL +
    Utils.colorText('Public Key: ', 'red') + signature.publicKey + os.EOL +
    Utils.colorText('Address: ', 'yellow') + address
  );
};


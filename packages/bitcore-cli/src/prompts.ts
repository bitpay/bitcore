import * as prompt from '@clack/prompts';
import { Network } from 'bitcore-wallet-client';
import { BitcoreLib, BitcoreLibLtc, Constants as CWCConst } from 'crypto-wallet-core';
import { Constants } from './constants';
import { UserCancelled } from './errors';
import { Utils } from './utils';


const libs = {
  btc: BitcoreLib,
  ltc: BitcoreLibLtc,
};

export async function getChain(): Promise<string> {
  const defaultVal = process.env['BITCORE_CLI_CHAIN'] || 'btc';
  const chain = await prompt.text({
    message: 'Chain:',
    placeholder: `Default: ${defaultVal}`,
    defaultValue: defaultVal,
    validate: (input) => {
      if (!input || CWCConst.CHAINS.includes(input?.toLowerCase())) {
        return; // valid input
      }
      return `Invalid chain '${input}'. Valid options are: ${CWCConst.CHAINS.join(', ')}`;
    }
  });
  if (prompt.isCancel(chain)) {
    throw new UserCancelled();
  }
  return (chain as string).toLowerCase();
}

export async function getNetwork(): Promise<Network> {
  const defaultVal = process.env['BITCORE_CLI_NETWORK'] || 'mainnet';
  const network = await prompt.text({
    message: 'Network:',
    placeholder: `Default: ${defaultVal}`,
    defaultValue: defaultVal,
    validate: (input) => {
      // TODO: validate network with BWS
      const validNetworks = ['mainnet', 'livenet', 'testnet', 'regtest'];
      return (!input || validNetworks.includes(input.toLowerCase())) ? null : `Invalid network '${input}'. Valid options are: ${validNetworks.join(', ')}`;
    }
  });
  if (prompt.isCancel(network)) {
    throw new UserCancelled();
  }
  return network === 'mainnet' ? 'livenet' : network as Network;
};


export async function getPassword(msg?: string, opts?: { minLength?: number; hidden?: boolean; validate?: (input: string) => string | null }): Promise<string> {
  opts = opts || {};
  opts.minLength = opts.minLength ?? 0;
  const hidden = opts.hidden ?? true;

  const password = await prompt.password({
    message: (msg || 'Password:') + (hidden ? ' (hidden)' : ''),
    mask: hidden ? '' : undefined,
    clearOnError: hidden,
    validate: (input) => {
      if (input?.length < opts.minLength) {
        return `Password must be at least ${opts.minLength} characters long.`;
      }
      return opts.validate?.(input);
    }
  });
  if (prompt.isCancel(password)) {
    throw new UserCancelled();
  }
  return password as string;
};

export async function getMofN() {
  const defaultVal = process.env['BITCORE_CLI_MULTIPARTY_M_N'] || '2-3';
  const mOfN = await prompt.text({
    message: 'M-N:',
    placeholder: `Default: ${defaultVal}. Type 'help' for more info.`,
    defaultValue: defaultVal,
    validate: (input) => {
      try {
        if (input === 'help') {
          return 'Multi-signature wallets require you to specify how many signatures are required to spend from the wallet ' +
            '(M) and how many total wallet members there are (N). The format is M-N, where M is the number of signatures ' +
            'required and N is the total number of wallet members. For example, 2-3 means 2 signatures are required out ' +
            'of 3 wallet members.';
        }
        input = input || defaultVal;
        const [m, n] = Utils.parseMN(input);
        if (isNaN(m) || isNaN(n)) {
          return 'M and N must be numbers';
        } else if (m < 1 || n < 2) {
          return 'M must be at least 1 and N must be at least 2';
        } else if (m > n) {
          return 'M cannot be greater than N';
        }
        return; // valid input
      } catch (e) {
        return e.message;
      }
    }
  });
  if (prompt.isCancel(mOfN)) {
    throw new UserCancelled();
  }
  return mOfN as string;
};

export async function getIsMultiParty() {
  const isMultiParty = await prompt.confirm({
    message: 'Is this a multi-party wallet?',
    initialValue: process.env['BITCORE_CLI_MULTIPARTY'] === 'true' || false,
  });
  if (prompt.isCancel(isMultiParty)) {
    throw new UserCancelled();
  }
  return isMultiParty;
}

export async function getMultiPartyScheme() {
  const scheme = await prompt.select({
    message: 'Which multi-party scheme do you want to use?',
    options: [
      {
        label: 'MultiSig - On-chain Multi-Signature Scheme',
        value: 'multisig',
        hint: 'Easier setup and backup (only need 12 words). Higher transaction fees.'
      },
      {
        label: 'TSS - Threshold Signature Scheme',
        value: 'tss',
        hint: 'More complicated setup and backup. Lower transaction fees.'
      },
    ],
    initialValue: process.env['BITCORE_CLI_MULTIPARTY_SCHEME'] || 'multisig',
  });
  if (prompt.isCancel(scheme)) {
    throw new UserCancelled();
  }
  return scheme as 'multisig' | 'tss';
};

export async function getCopayerName() {
  const defaultVal = process.env['BITCORE_CLI_COPAYER_NAME'] || process.env.USER;
  const copayerName = await prompt.text({
    message: 'Your name (helps to identify you):',
    placeholder: `Default: ${defaultVal}`,
    defaultValue: defaultVal,
  });
  if (prompt.isCancel(copayerName)) {
    throw new UserCancelled();
  }
  return copayerName as string;
};

export async function getAddressType(args: { chain: string; network?: Network; isMultiSig?: boolean; isTss?: boolean; }) {
  const { chain, network, isMultiSig, isTss } = args;
  let addressTypes = Constants.ADDRESS_TYPE[chain.toUpperCase()];
  if (!addressTypes) {
    return Constants.ADDRESS_TYPE.default;
  }

  if (isMultiSig) {
    addressTypes = addressTypes.multiSig;
  } else if (isTss) {
    addressTypes = addressTypes.thresholdSig;
  } else {
    addressTypes = addressTypes.singleSig;
  }

  const segwitPrefix = libs[chain]?.Networks.get(network).bech32prefix;
  const descriptions = {
    P2PKH: 'Standard public key address',
    P2SH: 'Standard script address',
    P2WPKH: `Native SegWit address - starts with ${segwitPrefix}1q`,
    P2WSH: `Native SegWit address - starts with ${segwitPrefix}1q`,
    P2TR: `Taproot address - starts with ${segwitPrefix}1p`,
  };

  const addressType = await prompt.select({
    message: 'Address type:',
    options: Object.entries(addressTypes).map(([label, value], i) => ({
      label, value, hint: descriptions[label] + (i === 0 ? '. *Recommended*' : ''),
    })),
    initialValue: process.env['BITCORE_CLI_ADDRESS_TYPE'] || Object.values(addressTypes)[0],
  });
  if (prompt.isCancel(addressType)) {
    throw new UserCancelled();
  }
  return addressType as string;
}

export async function getAction({ options, initialValue }: { options?: prompt.Option<string>[]; initialValue?: string } = {}) {
  options = [].concat(options || []).concat([
    { label: 'Main Menu', value: 'menu', hint: 'Go to the commands menu' },
    { label: 'Exit', value: 'exit', hint: 'Exit the wallet CLI' },
  ]);
  const action = await prompt.select({
    message: 'Actions:',
    options,
    initialValue: initialValue || 'menu',
  });

  return action;
}

export async function getFileName(args: { message?: string; defaultValue: string }) {
  const { message, defaultValue } = args;
  const fileName = await prompt.text({
    message: message || 'Enter file path:',
    initialValue: defaultValue,
    validate: (value) => {
      if (!value) return 'File path is required';
      return; // valid value
    }
  });
  if (prompt.isCancel(fileName)) {
    throw new UserCancelled();
  }
  return Utils.replaceTilde(fileName);
}

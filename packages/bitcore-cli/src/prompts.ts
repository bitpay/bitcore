import { Network } from '@bitpay-labs/bitcore-wallet-client';
import { BitcoreLib, BitcoreLibLtc, Constants as CWCConst } from '@bitpay-labs/crypto-wallet-core';
import * as prompt from '@clack/prompts';
import { Constants } from './constants';
import { UserCancelled } from './errors';
import { Utils } from './utils';


const bech32Libs = {
  btc: BitcoreLib,
  ltc: BitcoreLibLtc,
};

/**
 * Prompts the user to enter a chain and validates it against the supported chains in crypto-wallet-core.
 * The default value is taken from the BITCORE_CLI_CHAIN environment variable or 'btc' if not set.
 * @returns Lower-cased chain string (e.g. 'btc', 'eth', 'sol')
 */
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
  return chain.toLowerCase();
}

/**
 * Prompts the user to enter a network and validates it against the supported networks.
 * The default value is taken from the BITCORE_CLI_NETWORK environment variable or 'mainnet' if not set.
 * Note: 'mainnet' is converted to 'livenet' to align with bitcore-wallet-client conventions.
 * @returns Lower-cased network string (e.g. 'livenet', 'testnet', 'regtest')
 */
export async function getNetwork(): Promise<Network> {
  const defaultVal = process.env['BITCORE_CLI_NETWORK'] || 'mainnet';
  const network = await prompt.text({
    message: 'Network:',
    placeholder: `Default: ${defaultVal}`,
    defaultValue: defaultVal,
    validate: (input) => {
      const validNetworks = ['mainnet', 'livenet', 'testnet', 'regtest'];
      return (!input || validNetworks.includes(input.toLowerCase())) ? null : `Invalid network '${input}'. Valid options are: ${validNetworks.join(', ')}`;
    }
  });
  if (prompt.isCancel(network)) {
    throw new UserCancelled();
  }
  return (network === 'mainnet' ? 'livenet' : network).toLowerCase() as Network;
};

/**
 * Prompts the user to enter a password with optional validation and hidden input.
 * By default, the input is hidden and there is no minimum length requirement.
 * @returns The entered password as a string.
 */
export async function getPassword(
  /** Optional message to display to the user. Otherwise, defaults to 'Password:' */
  msg?: string,
  /** Optional settings for the password prompt. */
  opts?: {
    /** Minimum length for the password. Defaults to 0. */
    minLength?: number;
    /** Whether the password input should be hidden. Defaults to true. */
    hidden?: boolean;
    /** Custom validation function for the password input. Note, this does NOT override the minimum length check. */
    validate?: (input: string) => string | null;
  }
): Promise<string> {
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

/**
 * Prompts the user to enter an M-of-N scheme for multi-signature wallets, with validation.
 * The default value is taken from the BITCORE_CLI_MULTIPARTY_M_N environment variable or '2-3' if not set.
 * @returns The M-of-N scheme as 'M-N' (e.g. '3-5')
 */
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

/**
 * Prompts the user to confirm if the wallet is a multi-party wallet.
 * The default value is taken from the BITCORE_CLI_MULTIPARTY environment variable or false if not set.
 * Note, BITCORE_CLI_MULTIPARTY should be set to 'true' (not '1', etc) to default to a multi-party wallet.
 * @returns A boolean indicating whether the wallet is multi-party.
 */
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

/**
 * Prompts the user to select a multi-party scheme (MultiSig or TSS) for supported chains.
 * This prompt should only be shown for chains that support multiple types of multi-party wallets (e.g. UTXO chains).
 * The default value is taken from the BITCORE_CLI_MULTIPARTY_SCHEME environment variable or 'multisig' if not set.
 * @returns The selected multi-party scheme as 'multisig' or 'tss'.
 */
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

/**
 * Prompts the user to enter a name for their copayer, which helps identify them in multi-party wallets.
 * The default value is taken from the BITCORE_CLI_COPAYER_NAME environment variable or the USER environment variable if not set.
 * @returns The entered copayer name as a string.
 */
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

/**
 * Prompts the user to select an address type for the specified chain and network.
 * Some chains, like EVM, only have 1 address type which is returned without prompting.
 * The default value is taken from the BITCORE_CLI_ADDRESS_TYPE environment variable or the first available address type if not set.
 * @returns The selected address type as a string.
 */
export async function getAddressType(
  /** Arguments for selecting the address type */
  args: {
    chain: string;
    network?: Network;
    /** Show address types for a multisig wallet (e.g. P2WSH). Mutually exclusive with `isTss` */
    isMultiSig?: boolean;
    /** Show address types for a TSS wallet. Mutually exclusive with `isMultiSig` */
    isTss?: boolean;
  }
) {
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

  const segwitPrefix = bech32Libs[chain]?.Networks.get(network).bech32prefix;
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

/**
 * Prompts the user to select an action from a list of options.
 * 'Main Menu' and 'Exit' are always included as options.
 * @returns The selected action as a string.
 */
export async function getAction(
  args: {
    /** Additional action options for user to choose from */
    options?: prompt.Option<string>[];
    /** Initial value for the action prompt */
    initialValue?: string;
  } = {}
) {
  const { initialValue } = args;
  let { options } = args;

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

/**
 * Prompts the user to enter a file path, with basic, non-empty validation
 * @returns 
 */
export async function getFileName(
  args: {
    /** Message to prompt the user with. Defaults to 'Enter file path:' */
    message?: string;
    /** Default value for the file path */
    defaultValue?: string;
  } = {}
) {
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

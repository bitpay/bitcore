import { type ICliOptions } from '../types/cli';
import { type IWallet } from '../types/wallet';
import { Utils } from './utils';

export function getCommands(args: { wallet: IWallet; opts?: ICliOptions }) {
  const { wallet } = args;

  const COMMANDS = {
    EXIT: { label: 'Exit', value: 'exit', hint: 'Exit the wallet CLI' },
    NEW: [
      { label: 'Create Wallet', value: 'create', hint: 'Create a fresh, new wallet (multi or single sig)' },
      { label: 'Join Wallet', value: 'join', hint: 'Join an existing multi-sig wallet session' },
      { label: 'Import Seed', value: 'import-seed', hint: 'Import using a 12-24 word mnemonic phrase' },
      { label: 'Import File', value: 'import-file', hint: 'Import using a file' },
    ],
    BASIC: [
      { label: ({ token }) => `Token${token ? ` (${Utils.colorText(token, 'orange')})` : ''}`, value: 'token', hint: 'Manage the token context for this session', show: () => wallet.isTokenChain(), noCmd: true },
      { label: ({ ppNum }) => `Proposals${ppNum}`, value: 'txproposals', hint: 'Get pending transaction proposals' },
      { label: 'Send', value: 'transaction', hint: 'Create a transaction to send funds' },
      { label: 'Receive', value: 'address', hint: 'Get an address to receive funds to' },
      { label: 'History', value: 'history', hint: 'Get the transaction history of your wallet' },
      { label: 'Balance', value: 'balance', hint: 'Get the balance of your wallet' },
      { label: 'Status', value: 'status', hint: 'Get the status of your wallet' },
    ],
    SHOW_ADVANCED: { label: 'Show Advanced...', value: 'advanced', hint: 'Show advanced actions' },
    ADVANCED: [
      { label: 'Message', value: 'sign', hint: 'Sign an arbitrary message with your wallet\'s private key' },
      { label: 'Addresses', value: 'addresses', hint: 'List all of your wallet\'s addresses' },
      { label: 'UTXOs', value: 'utxos', hint: 'Get the unspent transaction outputs of your wallet' },
      { label: 'Preferences', value: 'preferences', hint: 'Get or set wallet preferences' },
      { label: 'Derive', value: 'derive', hint: 'Derive a key along a path you will specify' },
      { label: 'Export', value: 'export', hint: 'Export the wallet to a file' },
      { label: 'Scan', value: 'scan', hint: 'Scan the wallet for funds' },
      { label: 'Register', value: 'register', hint: 'Register the wallet with the Bitcore Wallet Service' },
      { label: 'Clear Cache', value: 'clearcache', hint: 'Clear the wallet cache' }
    ]
  } as const;
  return COMMANDS;
}
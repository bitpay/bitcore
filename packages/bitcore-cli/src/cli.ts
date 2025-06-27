#!/usr/bin/env node

import * as prompt from '@clack/prompts';
import { program } from 'commander';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as commands from './commands';
import { bitcoreLogo } from './constants';
import * as Errors from './errors';
import { getAction } from './prompts';
import { Utils } from './utils';
import { Wallet } from './wallet';

const { version } = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json')).toString());

program
  .addHelpText('beforeAll', bitcoreLogo)
  .usage('<walletName> [options]')
  .description('A command line tool for Bitcore wallets')
  .argument('<walletName>', 'Name of the wallet you want to create, join, or interact with')
  .option('-d, --dir <directory>', 'Directory to look for the wallet', process.env['BITCORE_CLI_DIR'] || path.join(os.homedir(), '.wallets'))
  .option('-H, --host <host>', 'Bitcore Wallet Service base URL', process.env['BITCORE_CLI_HOST'] || 'https://bws.bitpay.com/')
  .option('-x, --exit', 'Exit after running a command')
  .option('-s, --pageSize <number>', 'Number of items per page of a list output', (value) => parseInt(value, 10), 10)
  .option('-V, --verbose', 'Show more data and logs')
  .option('--walletId <walletId>', 'Support Staff Only: Wallet ID to provide support for')
  .helpOption('-h, --help [command]', 'Display help for command')
  .version(version, '-v, --version', 'Output the version number of this tool')
  .parse(process.argv);


const walletName = program.args[0];
const opts = program.opts() as ICliOptions;

Wallet.setVerbose(opts.verbose);

const wallet = new Wallet({
  name: walletName,
  dir: opts.dir,
  host: opts.host,
  verbose: opts.verbose,
  walletId: opts.walletId
});

wallet.getClient({
  mustExist: false
}).then(async () => {
  if (!wallet.client?.credentials) {
    prompt.intro(`No wallet found named ${Utils.colorText(walletName, 'orange')}`);
    const cmdParams = { wallet, opts: Object.assign({}, opts, { mnemonic: null }) };
    const action = await prompt.select({
      message: 'What would you like to do?',
      options: [
        { label: 'Create Wallet', value: 'create', hint: 'Create a fresh, new wallet (multi or single sig)' },
        { label: 'Join Wallet', value: 'join', hint: 'Join an existing multi-sig wallet session' },
        { label: 'Import Seed', value: 'import-seed', hint: 'Import using a 12-24 word mnemonic phrase' },
        { label: 'Import File', value: 'import-file', hint: 'Import using a file' },
        { label: 'Exit', value: 'exit', hint: 'Exit the wallet CLI' },
      ]
    });
    switch (action) {
      case 'create':
        await commands.createWallet(cmdParams);
        break;
      case 'join':
        await commands.joinWallet(cmdParams);
        break;
      case 'import-seed':
        cmdParams.opts.mnemonic = await prompt.password({
          message: 'Enter your 12-24 word mnemonic phrase:',
          mask: '*',
          validate: (input) => input.split(' ').length >= 12 && input.split(' ').length <= 24 ? undefined : 'Mnemonic must be between 12 and 24 words.',
        });
        await commands.createWallet(cmdParams);
        break;
      case 'import-file':
        await commands.importWallet(cmdParams);
        break;
      case 'exit':
      default:
        opts.exit = true;
        break;
    }
    !opts.exit && prompt.outro(`${Utils.colorText('✔', 'green')} Wallet ${Utils.colorText(walletName, 'orange')} created successfully!`);
  } else {
    

    prompt.intro(`Status for ${Utils.colorText(walletName, 'orange')}`);
    const status = await commands.walletStatus({ wallet, opts });
    prompt.outro('Welcome to the Bitcore CLI!');

    const cmdParams = { wallet, opts, status };
    let advancedActions = false;
    do {
      prompt.intro(`${Utils.colorText('~~ Main Menu ~~', 'blue')} (${Utils.colorText(walletName, 'orange')})`);
      status.pendingTxps = await wallet.client.getTxProposals({});
      const ppNum = status.pendingTxps.length ? Utils.colorText(` (${status.pendingTxps.length})`, 'yellow') : '';
      const menuAction = await prompt.select({
        message: 'What would you like to do?',
        options: [
          { label: `Proposals${ppNum}`, value: 'txproposals', hint: 'Get pending transaction proposals' },
          { label: 'Send', value: 'createtx', hint: 'Create a transaction to send funds' },
          { label: 'Receive', value: 'address', hint: 'Get an address to receive funds to' },
          { label: 'History', value: 'history', hint: 'Get the transaction history of your wallet' },
          { label: 'Balance', value: 'balance', hint: 'Get the balance of your wallet' },
          { label: 'Status', value: 'status', hint: 'Get the status of your wallet' },
        ].concat(
          !advancedActions ? [
            { label: 'Show Advanced...', value: 'advanced', hint: 'Show advanced actions' }
          ] : [
            // TODO: Add a separator for each section when clack supports it
            // feature request here: https://github.com/bombshell-dev/clack/issues/197
            { label: 'Addresses', value: 'addresses', hint: 'List all of your wallet\'s addresses' },
            { label: 'UTXOs', value: 'utxos', hint: 'Get the unspent transaction outputs of your wallet' },
            { label: 'Preferences', value: 'preferences', hint: 'Get or set wallet preferences' },
            { label: 'Derive', value: 'derive', hint: 'Derive a key along a path you will specify' },
            { label: 'Export', value: 'export', hint: 'Export the wallet to a file' },
            { label: 'Scan', value: 'scan', hint: 'Scan the wallet for funds' },
            { label: 'Register', value: 'register', hint: 'Register the wallet with the Bitcore Wallet Service' }
          ]
        ).concat([
          { label: 'Exit', value: 'exit', hint: 'Exit the wallet CLI' }
        ])
      });

      let action: string | symbol | undefined;
      advancedActions = false;
      try {
        switch (menuAction) {
          case 'address':
            await commands.createAddress(cmdParams);
            break;
          case 'balance':
            cmdParams.status.balance = await commands.getBalance(cmdParams);
            break;
          case 'history':
            await commands.getTxHistory(cmdParams);
            break;
          case 'createtx':
            await commands.createTransaction(cmdParams);
            break;
          case 'txproposals':
            ({ action } = await commands.getTxProposals(cmdParams));
            break;
          case 'status':
            cmdParams.status = await commands.walletStatus(cmdParams);
            break;
          case 'advanced':
            advancedActions = true;
            action = 'advanced';
            break;
          case 'addresses':
            await commands.getAddresses(cmdParams);
            break;
          case 'utxos':
            await commands.getUtxos(cmdParams);
            break;
          case 'preferences':
            await commands.getPreferences(cmdParams);
            break;
          case 'derive':
            ({ action } = await commands.deriveKey(cmdParams));
            break;
          case 'export':
            await commands.exportWallet(cmdParams);
            break;
          case 'scan':
            await commands.scanWallet(cmdParams);
            break;
          case 'register':
            await wallet.register({ copayerName: wallet.client.credentials.copayerName });
            break;
          default:
          case 'exit':
            opts.exit = true;
            break;
        }

        if (action === 'exit' || prompt.isCancel(action)) {
          opts.exit = true;
        }
      } catch (err) {
        if (err instanceof Errors.UserCancelled) {
          prompt.log.warn('Action cancelled by user.');
        } else {
          prompt.log.error((opts.verbose ? err.stack : err.message) || err.message || err);
        }
      }
      
      if (!opts.exit && !action) {
        action = await getAction();
        if (action === 'exit' || prompt.isCancel(action)) {
          opts.exit = true;
        }
      } 

      prompt.outro();

    } while (!opts.exit);
    
    Utils.goodbye();
  }
})
.catch(Utils.die);


export interface ICliOptions {
  dir: string;
  host: string;
  verbose: boolean;
  exit: boolean;
  pageSize: number;
  walletId?: string;
};
#!/usr/bin/env node

import * as prompt from '@clack/prompts';
import { Errors as BWCErrors, Status } from 'bitcore-wallet-client';
import Mnemonic from 'bitcore-mnemonic';
import { program } from 'commander';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CommonArgs, ICliOptions } from '../types/cli';
import { getCommands } from './cli-commands';
import * as commands from './commands';
import { bitcoreLogo } from './constants';
import * as Errors from './errors';
import { getAction } from './prompts';
import { Utils } from './utils';
import { Wallet } from './wallet';

const { version } = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json')).toString());

program
  .addHelpText('beforeAll', bitcoreLogo)
  .usage('<walletName> [options]')
  .description('A command line tool for Bitcore wallets')
  .argument('<walletName>', 'Name of the wallet you want to create, join, or interact with. Use "list" to see all wallets in the specified directory.')
  .optionsGroup('Global Options')
  .option('-d, --dir <directory>', 'Directory to look for the wallet', process.env['BITCORE_CLI_DIR'] || path.join(os.homedir(), '.wallets'))
  .option('-H, --host <host>', 'Bitcore Wallet Service base URL', process.env['BITCORE_CLI_HOST'] || 'http://localhost:3232')
  .option('-c, --command <command>', 'Run a specific command without entering the interactive CLI. Use "help" to see available commands', (value) => value.toLowerCase())
  .option('--no-status', 'Do not display the wallet status on startup. Defaults to true when running with --command')
  .option('-s, --pageSize <number>', 'Number of items per page of a list output', (value) => parseInt(value, 10), 10)
  .option('-v, --verbose', 'Show more data and logs')
  .option('--list', 'See all wallets in the specified directory')
  .option('--register', 'Register the wallet with the Bitcore Wallet Service if it does not exist')
  .option('--walletId <walletId>', 'Support Staff Only: Wallet ID to provide support for')
  .option('-h, --help', 'Display help message. Use with --command to get help for a specific command')
  .version(version, '--version', 'Output the version number of this tool')
  // .parse(process.argv);
  // .parseOptions(process.argv)


const opts = program.opts() as ICliOptions;
const walletName = program.parseOptions(process.argv).operands.slice(-1)[0];

if (opts.help && !opts.command) {
  program.help();
}

const isCmdHelp = opts.command && opts.help;
opts.exit = !!opts.command;
opts.status = opts.command ? false : opts.status; // Always hide the status when running a command directly



Wallet.setVerbose(opts.verbose);

export const wallet = new Wallet({
  name: walletName,
  dir: opts.dir,
  host: opts.host,
  verbose: opts.verbose,
  walletId: opts.walletId
});

export const COMMANDS = getCommands({ wallet, opts });

type NewCommand = (typeof COMMANDS.NEW)[number]['value'] | 'exit';
type Command = (typeof COMMANDS.BASIC)[number]['value'] | (typeof COMMANDS.ADVANCED)[number]['value'] | 'advanced' | 'exit';


if (require.main === module) {

  if (opts.command === 'help') {
    const padLen = 18;
    program
    .addHelpText('after', os.EOL +
      // 'New Wallet Commands:' + os.EOL +
      // COMMANDS.NEW.map(cmd => `  ${cmd.value.padEnd(padLen)}${cmd.hint}`).join(os.EOL) + os.EOL + os.EOL +
      'Wallet Commands:' + os.EOL +
      COMMANDS.BASIC.filter(cmd => !cmd['noCmd']).map(cmd => `  ${cmd.value.padEnd(padLen)}${cmd.hint}`).join(os.EOL) + os.EOL + os.EOL +
      'Advanced Commands:' + os.EOL +
      COMMANDS.ADVANCED.filter(cmd => !cmd['noCmd']).map(cmd => `  ${cmd.value.padEnd(padLen)}${cmd.hint}`).join(os.EOL)
    )
    .help();
  } else if (isCmdHelp) {
    if (!commands[opts.command]) {
      Utils.die(`Unknown command "${opts.command}"`);
    } else if (!commands[opts.command].command) {
      Utils.die(`Running "${opts.command}" directly is not supported. Use the interactive CLI`);
    }
    commands[opts.command].command({ wallet, program });
  }

  wallet.getClient({
    mustExist: false,
    doNotComplete: isCmdHelp || opts.register
  })
  .catch((err) => {
    if (err instanceof BWCErrors.NOT_AUTHORIZED) {
      if (opts.register) {
        return commands.register.registerWallet({ wallet, opts });
      } else {
        prompt.log.error('This wallet does not appear to be registered with the Bitcore Wallet Service. Use --register to do so.');
        Utils.die(err);
      }
    } else {
      Utils.die(err);
    }
  })
  .then(async () => {
    if (walletName === 'list') {
      for (const file of fs.readdirSync(opts.dir)) {
        if (file.endsWith('.json')) {
          console.log(`- ${file.replace('.json', '')}`);
        }
      }
      return;
    }

    const cmdParams: CommonArgs<any> = {
      wallet,
      program: opts.command ? program : undefined,
      opts,
      status: null as Status
    };

    if (!wallet.client?.credentials) {
      prompt.intro(`No wallet found named ${Utils.colorText(walletName, 'orange')}`);
      const action: NewCommand | symbol = await prompt.select({
        message: 'What would you like to do?',
        options: [].concat(COMMANDS.NEW, COMMANDS.EXIT)
      });
      switch (action) {
        case 'create':
          await commands.create.createWallet(cmdParams);
          break;
        case 'join':
          await commands.join.joinWallet(cmdParams);
          break;
        case 'import-seed':
          const mnemonic = await prompt.password({
            message: 'Enter your 12-24 word mnemonic phrase:',
            validate: (input) => !Mnemonic.isValid(input) ? 'Invalid mnemonic. Please check your spelling and try again' : undefined,
          });
          if (prompt.isCancel(mnemonic)) {
            throw new Errors.UserCancelled();
          }
          cmdParams.opts.mnemonic = mnemonic;
          await commands.create.createWallet(cmdParams);
          break;
        case 'import-file':
          await commands.import.importWallet(cmdParams);
          break;
        case 'exit':
        default:
          opts.exit = true;
          break;
      }
      prompt.outro(`${Utils.colorText('✔', 'green')} Wallet ${Utils.colorText(walletName, 'orange')} created successfully!`);
    } else {

      if (opts.status) {
        prompt.intro(`Status for ${Utils.colorText(walletName, 'orange')}`);
        const status = await commands.status.walletStatus({ wallet, opts });
        cmdParams.status = status;
        prompt.outro('Welcome to the Bitcore CLI!');
      }

      let advancedActions = false;
      do {
        // Don't display the intro if running a specific command
        !opts.command && prompt.intro(`${Utils.colorText('~~ Main Menu ~~', 'blue')} (${Utils.colorText(walletName, 'orange')})`);
        cmdParams.status.pendingTxps = opts.command ? [] : await wallet.client.getTxProposals({});
        
        const dynamicCmdArgs = {
          ppNum: cmdParams.status.pendingTxps.length ? Utils.colorText(` (${cmdParams.status.pendingTxps.length})`, 'yellow') : '',
          sNum: Utils.colorText(` (${'TODO'})`, 'yellow'),
          token: cmdParams.opts?.token
        };

        const BASIC = COMMANDS.BASIC
          .filter(cmd => cmd['show']?.() ?? true)
          .map(cmd => ({ ...cmd, label: typeof cmd.label === 'function' ? cmd.label(dynamicCmdArgs) : cmd.label }))
        const ADVANCED = COMMANDS.ADVANCED
          .filter(cmd => cmd['show']?.() ?? true)

        const menuAction: Command | symbol = opts.command as Command || (opts.register 
          ? 'register'
          : await prompt.select({
            message: 'What would you like to do?',
            options: (BASIC as Array<any>)
              .concat(advancedActions ? ADVANCED : [COMMANDS.SHOW_ADVANCED])
              .concat(COMMANDS.EXIT),
            initialValue: advancedActions ? ADVANCED[0].value : BASIC[0].value,
          }));

        let action: string | symbol | undefined;
        advancedActions = false;
        try {
          switch (menuAction as Command) {
            case 'token':
              const result = await commands.token.setToken(cmdParams);
              const { tokenObj } = result;
              action = result.action;
              // If context has changed...
              if (cmdParams.opts?.tokenAddress?.toLowerCase() !== tokenObj?.contractAddress.toLowerCase()) {
                // ...update status
                cmdParams.status = await wallet.client.getStatus({ tokenAddress: tokenObj?.contractAddress })
              }
              cmdParams.opts.tokenAddress = tokenObj?.contractAddress;
              cmdParams.opts.token = tokenObj?.displayCode;
              break;
            case 'address':
              await commands.address.createAddress(cmdParams);
              break;
            case 'balance':
              const balance = await commands.balance.getBalance(cmdParams);
              if (cmdParams.status) {
                cmdParams.status.balance = balance;
              }
              break;
            case 'history':
              ({ action } = await commands.history.getTxHistory(cmdParams));
              break;
            case 'transaction':
              await commands.transaction.createTransaction(cmdParams);
              break;
            case 'txproposals':
              ({ action } = await commands.txproposals.getTxProposals(cmdParams));
              break;
            case 'status':
              cmdParams.status = await commands.status.walletStatus(cmdParams);
              break;
            case 'sign':
              await commands.sign.signMessage(cmdParams);
              break;
            case 'advanced':
              advancedActions = true;
              action = 'advanced';
              break;
            case 'addresses':
              await commands.addresses.getAddresses(cmdParams);
              break;
            case 'utxos':
              await commands.utxos.getUtxos(cmdParams);
              break;
            case 'preferences':
              await commands.preferences.getPreferences(cmdParams);
              break;
            case 'derive':
              ({ action } = await commands.derive.deriveKey(cmdParams));
              break;
            case 'export':
              await commands.export.exportWallet(cmdParams);
              break;
            case 'scan':
              await commands.scan.scanWallet(cmdParams);
              break;
            case 'register':
              await commands.register.registerWallet(cmdParams);
              break;
            case 'clearcache':
              await commands.clearcache.clearCache(cmdParams);
              break;
            default:
              if (opts.command) {
                throw new Error(`Unknown command: ${menuAction as string}`);
              }
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
        
        if (opts.command) {
          // always exit when in command mode
          opts.exit = true;
        } else if (!opts.exit && !action) {
          action = await getAction();
          if (action === 'exit' || prompt.isCancel(action)) {
            opts.exit = true;
          }
        } 

        !opts.command && prompt.outro();

      } while (!opts.exit);
      
      !opts.command && Utils.goodbye();
    }
  })
  .catch(Utils.die);
}
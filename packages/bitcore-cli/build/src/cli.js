#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMANDS = exports.wallet = void 0;
const commands = __importStar(require("./commands"));
const Errors = __importStar(require("./errors"));
const prompt = __importStar(require("@clack/prompts"));
const bitcore_wallet_client_1 = require("bitcore-wallet-client");
const constants_1 = require("./constants");
const fs_1 = __importDefault(require("fs"));
const prompts_1 = require("./prompts");
const cli_commands_1 = require("./cli-commands");
const bitcore_mnemonic_1 = __importDefault(require("bitcore-mnemonic"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const commander_1 = require("commander");
const utils_1 = require("./utils");
const wallet_1 = require("./wallet");
const { version } = JSON.parse(fs_1.default.readFileSync(path_1.default.join(__dirname, '../../package.json')).toString());
commander_1.program
    .addHelpText('beforeAll', constants_1.bitcoreLogo)
    .usage('<walletName> [options]')
    .description('A command line tool for Bitcore wallets')
    .argument('<walletName>', 'Name of the wallet you want to create, join, or interact with. Use "list" to see all wallets in the specified directory.')
    .optionsGroup('Global Options')
    .option('-d, --dir <directory>', 'Directory to look for the wallet', process.env['BITCORE_CLI_DIR'] || path_1.default.join(os_1.default.homedir(), '.wallets'))
    .option('-H, --host <host>', 'Bitcore Wallet Service base URL', process.env['BITCORE_CLI_HOST'] || 'http://localhost:3232')
    .option('-c, --command <command>', 'Run a specific command without entering the interactive CLI. Use "help" to see available commands', (value) => value.toLowerCase())
    .option('--no-status', 'Do not display the wallet status on startup. Defaults to true when running with --command')
    .option('-s, --pageSize <number>', 'Number of items per page of a list output', (value) => parseInt(value, 10), 10)
    .option('-v, --verbose', 'Show more data and logs')
    .option('--list', 'See all wallets in the specified directory')
    .option('--register', 'Register the wallet with the Bitcore Wallet Service if it does not exist')
    .option('--walletId <walletId>', 'Support Staff Only: Wallet ID to provide support for')
    .option('-h, --help', 'Display help message. Use with --command to get help for a specific command')
    .version(version, '--version', 'Output the version number of this tool');
const opts = commander_1.program.opts();
const walletName = commander_1.program.parseOptions(process.argv).operands.slice(-1)[0];
if (opts.help && !opts.command) {
    commander_1.program.help();
}
const isCmdHelp = opts.command && opts.help;
opts.exit = !!opts.command;
opts.status = opts.command ? false : opts.status;
wallet_1.Wallet.setVerbose(opts.verbose);
exports.wallet = new wallet_1.Wallet({
    name: walletName,
    dir: opts.dir,
    host: opts.host,
    verbose: opts.verbose,
    walletId: opts.walletId
});
exports.COMMANDS = (0, cli_commands_1.getCommands)({ wallet: exports.wallet, opts });
if (require.main === module) {
    if (opts.command === 'help') {
        const padLen = 18;
        commander_1.program
            .addHelpText('after', os_1.default.EOL +
            'Wallet Commands:' + os_1.default.EOL +
            exports.COMMANDS.BASIC.filter(cmd => !cmd['noCmd']).map(cmd => `  ${cmd.value.padEnd(padLen)}${cmd.hint}`).join(os_1.default.EOL) + os_1.default.EOL + os_1.default.EOL +
            'Advanced Commands:' + os_1.default.EOL +
            exports.COMMANDS.ADVANCED.filter(cmd => !cmd['noCmd']).map(cmd => `  ${cmd.value.padEnd(padLen)}${cmd.hint}`).join(os_1.default.EOL))
            .help();
    }
    else if (isCmdHelp) {
        if (!commands[opts.command]) {
            utils_1.Utils.die(`Unknown command "${opts.command}"`);
        }
        else if (!commands[opts.command].command) {
            utils_1.Utils.die(`Running "${opts.command}" directly is not supported. Use the interactive CLI`);
        }
        commands[opts.command].command({ wallet: exports.wallet, program: commander_1.program });
    }
    exports.wallet.getClient({
        mustExist: false,
        doNotComplete: isCmdHelp || opts.register
    })
        .catch((err) => {
        if (err instanceof bitcore_wallet_client_1.Errors.NOT_AUTHORIZED) {
            if (opts.register) {
                return commands.register.registerWallet({ wallet: exports.wallet, opts });
            }
            else {
                prompt.log.error('This wallet does not appear to be registered with the Bitcore Wallet Service. Use --register to do so.');
                utils_1.Utils.die(err);
            }
        }
        else {
            utils_1.Utils.die(err);
        }
    })
        .then(async () => {
        if (walletName === 'list') {
            for (const file of fs_1.default.readdirSync(opts.dir)) {
                if (file.endsWith('.json')) {
                    console.log(`- ${file.replace('.json', '')}`);
                }
            }
            return;
        }
        const cmdParams = {
            wallet: exports.wallet,
            program: opts.command ? commander_1.program : undefined,
            opts,
            status: null
        };
        if (!exports.wallet.client?.credentials) {
            prompt.intro(`No wallet found named ${utils_1.Utils.colorText(walletName, 'orange')}`);
            const action = await prompt.select({
                message: 'What would you like to do?',
                options: [].concat(exports.COMMANDS.NEW, exports.COMMANDS.EXIT)
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
                        validate: (input) => !bitcore_mnemonic_1.default.isValid(input) ? 'Invalid mnemonic. Please check your spelling and try again' : undefined,
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
            prompt.outro(`${utils_1.Utils.colorText('✔', 'green')} Wallet ${utils_1.Utils.colorText(walletName, 'orange')} created successfully!`);
        }
        else {
            if (opts.status) {
                prompt.intro(`Status for ${utils_1.Utils.colorText(walletName, 'orange')}`);
                const status = await commands.status.walletStatus({ wallet: exports.wallet, opts });
                cmdParams.status = status;
                prompt.outro('Welcome to the Bitcore CLI!');
            }
            let advancedActions = false;
            do {
                !opts.command && prompt.intro(`${utils_1.Utils.colorText('~~ Main Menu ~~', 'blue')} (${utils_1.Utils.colorText(walletName, 'orange')})`);
                cmdParams.status.pendingTxps = opts.command ? [] : await exports.wallet.client.getTxProposals({});
                const dynamicCmdArgs = {
                    ppNum: cmdParams.status.pendingTxps.length ? utils_1.Utils.colorText(` (${cmdParams.status.pendingTxps.length})`, 'yellow') : '',
                    sNum: utils_1.Utils.colorText(` (${'TODO'})`, 'yellow'),
                    token: cmdParams.opts?.token
                };
                const BASIC = exports.COMMANDS.BASIC
                    .filter(cmd => cmd['show']?.() ?? true)
                    .map(cmd => ({ ...cmd, label: typeof cmd.label === 'function' ? cmd.label(dynamicCmdArgs) : cmd.label }));
                const ADVANCED = exports.COMMANDS.ADVANCED
                    .filter(cmd => cmd['show']?.() ?? true);
                const menuAction = opts.command || (opts.register
                    ? 'register'
                    : await prompt.select({
                        message: 'What would you like to do?',
                        options: BASIC
                            .concat(advancedActions ? ADVANCED : [exports.COMMANDS.SHOW_ADVANCED])
                            .concat(exports.COMMANDS.EXIT),
                        initialValue: advancedActions ? ADVANCED[0].value : BASIC[0].value,
                    }));
                let action;
                advancedActions = false;
                try {
                    switch (menuAction) {
                        case 'token':
                            const result = await commands.token.setToken(cmdParams);
                            const { tokenObj } = result;
                            action = result.action;
                            if (cmdParams.opts?.tokenAddress?.toLowerCase() !== tokenObj?.contractAddress.toLowerCase()) {
                                cmdParams.status = await exports.wallet.client.getStatus({ tokenAddress: tokenObj?.contractAddress });
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
                        case 'exit':
                            if (opts.command) {
                                throw new Error(`Unknown command: ${menuAction}`);
                            }
                            opts.exit = true;
                            break;
                    }
                    if (action === 'exit' || prompt.isCancel(action)) {
                        opts.exit = true;
                    }
                }
                catch (err) {
                    if (err instanceof Errors.UserCancelled) {
                        prompt.log.warn('Action cancelled by user.');
                    }
                    else {
                        prompt.log.error((opts.verbose ? err.stack : err.message) || err.message || err);
                    }
                }
                if (opts.command) {
                    opts.exit = true;
                }
                else if (!opts.exit && !action) {
                    action = await (0, prompts_1.getAction)();
                    if (action === 'exit' || prompt.isCancel(action)) {
                        opts.exit = true;
                    }
                }
                !opts.command && prompt.outro();
            } while (!opts.exit);
            !opts.command && utils_1.Utils.goodbye();
        }
    })
        .catch(utils_1.Utils.die);
}
//# sourceMappingURL=cli.js.map
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
const prompt = __importStar(require("@clack/prompts"));
const commander_1 = require("commander");
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const commands = __importStar(require("./commands"));
const constants_1 = require("./constants");
const Errors = __importStar(require("./errors"));
const prompts_1 = require("./prompts");
const utils_1 = require("./utils");
const wallet_1 = require("./wallet");
const { version } = JSON.parse(fs_1.default.readFileSync(path_1.default.join(__dirname, '../package.json')).toString());
commander_1.program
    .addHelpText('beforeAll', constants_1.bitcoreLogo)
    .usage('<walletName> [options]')
    .description('A command line tool for Bitcore wallets')
    .argument('<walletName>', 'Name of the wallet you want to create, join, or interact with')
    .option('-d, --dir <directory>', 'Directory to look for the wallet', process.env['BITCORE_CLI_DIR'] || path_1.default.join(os_1.default.homedir(), '.wallets'))
    .option('-H, --host <host>', 'Bitcore Wallet Service base URL', process.env['BITCORE_CLI_HOST'] || 'http://localhost:3232')
    .option('-c, --command <command>', 'Run a specific command without entering the interactive CLI. Use "help" to see available commands', (value) => value.toLowerCase())
    .option('-x, --exit', 'Exit after running a command')
    .option('-s, --pageSize <number>', 'Number of items per page of a list output', (value) => parseInt(value, 10), 10)
    .option('-V, --verbose', 'Show more data and logs')
    .option('--walletId <walletId>', 'Support Staff Only: Wallet ID to provide support for')
    .helpOption('-h, --help [command]', 'Display help for command')
    .version(version, '-v, --version', 'Output the version number of this tool')
    .parse(process.argv);
const walletName = commander_1.program.args[0];
const opts = commander_1.program.opts();
const COMMANDS = {
    EXIT: { label: 'Exit', value: 'exit', hint: 'Exit the wallet CLI' },
    NEW: [
        { label: 'Create Wallet', value: 'create', hint: 'Create a fresh, new wallet (multi or single sig)' },
        { label: 'Join Wallet', value: 'join', hint: 'Join an existing multi-sig wallet session' },
        { label: 'Import Seed', value: 'import-seed', hint: 'Import using a 12-24 word mnemonic phrase' },
        { label: 'Import File', value: 'import-file', hint: 'Import using a file' },
    ],
    EXISTS: [
        { label: (ppNum) => `Proposals${ppNum}`, value: 'txproposals', hint: 'Get pending transaction proposals' },
        { label: 'Send', value: 'createtx', hint: 'Create a transaction to send funds' },
        { label: 'Receive', value: 'address', hint: 'Get an address to receive funds to' },
        { label: 'History', value: 'history', hint: 'Get the transaction history of your wallet' },
        { label: 'Balance', value: 'balance', hint: 'Get the balance of your wallet' },
        { label: 'Status', value: 'status', hint: 'Get the status of your wallet' },
    ],
    EXISTS_ADVANCED: [
        { label: 'Addresses', value: 'addresses', hint: 'List all of your wallet\'s addresses' },
        { label: 'UTXOs', value: 'utxos', hint: 'Get the unspent transaction outputs of your wallet' },
        { label: 'Preferences', value: 'preferences', hint: 'Get or set wallet preferences' },
        { label: 'Derive', value: 'derive', hint: 'Derive a key along a path you will specify' },
        { label: 'Export', value: 'export', hint: 'Export the wallet to a file' },
        { label: 'Scan', value: 'scan', hint: 'Scan the wallet for funds' },
        { label: 'Register', value: 'register', hint: 'Register the wallet with the Bitcore Wallet Service' }
    ]
};
if (opts.command === 'help') {
    const padLen = 18;
    commander_1.program
        .addHelpText('after', os_1.default.EOL +
        'New Wallet Commands:' + os_1.default.EOL +
        COMMANDS.NEW.map(cmd => `  ${cmd.value.padEnd(padLen)}${cmd.hint}`).join(os_1.default.EOL) + os_1.default.EOL + os_1.default.EOL +
        'Existing Wallet Commands:' + os_1.default.EOL +
        COMMANDS.EXISTS.map(cmd => `  ${cmd.value.padEnd(padLen)}${cmd.hint}`).join(os_1.default.EOL) + os_1.default.EOL + os_1.default.EOL +
        'Advanced Commands:' + os_1.default.EOL +
        COMMANDS.EXISTS_ADVANCED.map(cmd => `  ${cmd.value.padEnd(padLen)}${cmd.hint}`).join(os_1.default.EOL))
        .help();
}
wallet_1.Wallet.setVerbose(opts.verbose);
const wallet = new wallet_1.Wallet({
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
        prompt.intro(`No wallet found named ${utils_1.Utils.colorText(walletName, 'orange')}`);
        const cmdParams = { wallet, opts: Object.assign({}, opts, { mnemonic: null }) };
        const action = opts.command || await prompt.select({
            message: 'What would you like to do?',
            options: [].concat(COMMANDS.NEW, COMMANDS.EXIT)
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
        !opts.exit && prompt.outro(`${utils_1.Utils.colorText('✔', 'green')} Wallet ${utils_1.Utils.colorText(walletName, 'orange')} created successfully!`);
    }
    else {
        prompt.intro(`Status for ${utils_1.Utils.colorText(walletName, 'orange')}`);
        const status = await commands.walletStatus({ wallet, opts });
        prompt.outro('Welcome to the Bitcore CLI!');
        const cmdParams = { wallet, opts, status };
        let advancedActions = false;
        do {
            prompt.intro(`${utils_1.Utils.colorText('~~ Main Menu ~~', 'blue')} (${utils_1.Utils.colorText(walletName, 'orange')})`);
            status.pendingTxps = await wallet.client.getTxProposals({});
            const ppNum = status.pendingTxps.length ? utils_1.Utils.colorText(` (${status.pendingTxps.length})`, 'yellow') : '';
            const menuAction = await prompt.select({
                message: 'What would you like to do?',
                options: COMMANDS.EXISTS.map(cmd => ({ ...cmd, label: typeof cmd.label === 'function' ? cmd.label(ppNum) : cmd.label }))
                    .concat(advancedActions ? COMMANDS.EXISTS_ADVANCED : [{ label: 'Show Advanced...', value: 'advanced', hint: 'Show advanced actions' }])
                    .concat(COMMANDS.EXIT)
            });
            let action;
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
            }
            catch (err) {
                if (err instanceof Errors.UserCancelled) {
                    prompt.log.warn('Action cancelled by user.');
                }
                else {
                    prompt.log.error((opts.verbose ? err.stack : err.message) || err.message || err);
                }
            }
            if (!opts.exit && !action) {
                action = await (0, prompts_1.getAction)();
                if (action === 'exit' || prompt.isCancel(action)) {
                    opts.exit = true;
                }
            }
            prompt.outro();
        } while (!opts.exit);
        utils_1.Utils.goodbye();
    }
})
    .catch(utils_1.Utils.die);
//# sourceMappingURL=cli.js.map
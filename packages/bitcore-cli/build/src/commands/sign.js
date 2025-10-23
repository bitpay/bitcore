"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.command = command;
exports.signMessage = signMessage;
const os_1 = __importDefault(require("os"));
const prompts_1 = __importDefault(require("@clack/prompts"));
const crypto_wallet_core_1 = require("crypto-wallet-core");
const errors_1 = require("../errors");
const utils_1 = require("../utils");
function command(args) {
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
async function signMessage(args) {
    const { wallet, opts } = args;
    if (opts.command) {
        Object.assign(opts, command(args));
    }
    if (wallet.isMultiSig()) {
        throw new Error('MultiSig wallets cannot sign arbitrary messages');
    }
    const message = opts.message || await prompts_1.default.text({
        message: 'Enter the message to sign:',
        placeholder: 'Your message here',
        validate: (value) => {
            if (!value) {
                return 'Message cannot be empty';
            }
            return null;
        }
    });
    if (prompts_1.default.isCancel(message)) {
        throw new errors_1.UserCancelled();
    }
    let path = opts.path;
    const bal = await wallet.client.getBalance({});
    if (bal.byAddress.length <= 1) {
        path = bal.byAddress[0]?.path || 'm/0/0';
    }
    else if (opts.path) {
        path = opts.path;
        if (path !== 'm' && !path.startsWith('m/')) {
            throw new Error(`Invalid derivation path: ${path}. It should start with 'm/' (e.g., 'm/0/0')`);
        }
    }
    else if (opts.address) {
        const addresses = await wallet.client.getAddresses({ addresses: [opts.address] });
        if (!addresses[0] || !addresses[0].address) {
            throw new Error(`Address ${opts.address} not found in wallet`);
        }
        path = addresses[0]?.path;
    }
    else {
        do {
            const top10 = bal.byAddress.toSorted((a, b) => b.amount - a.amount).slice(0, 10);
            path = await prompts_1.default.select({
                message: 'Which address to use for signing?',
                options: top10.map((a) => ({
                    label: `${a.address} (${utils_1.Utils.renderAmount(wallet.chain, a.amount)} )`,
                    value: a.path,
                })).concat([{
                        label: 'Custom...',
                        value: 'custom',
                        hint: 'Specify a derivation path or address',
                    }])
            });
            if (prompts_1.default.isCancel(path)) {
                throw new errors_1.UserCancelled();
            }
            if (path === 'custom') {
                path = await prompts_1.default.text({
                    message: 'Enter the derivation path or address to use for signing:',
                    placeholder: 'm/0/0',
                    validate: (value) => {
                        if (!value) {
                            return 'Value cannot be empty';
                        }
                        if (!value.match(/^m(\/\d+)+$/) && !crypto_wallet_core_1.Validation.validateAddress(wallet.chain, wallet.network, value)) {
                            return 'Invalid derivation path or address';
                        }
                        return null;
                    }
                });
                if (prompts_1.default.isCancel(path)) {
                    throw new errors_1.UserCancelled();
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
        derivationPath: path,
        encoding: 'hex'
    });
    const chain = wallet.client.credentials.chain;
    const network = wallet.client.credentials.network;
    const addressType = wallet.client.credentials.addressType;
    const address = crypto_wallet_core_1.Deriver.getAddress(chain, network, signature.publicKey, addressType);
    prompts_1.default.log.success(utils_1.Utils.colorText('Signature: ', 'green') + signature.signature + os_1.default.EOL +
        utils_1.Utils.colorText('Public Key: ', 'red') + signature.publicKey + os_1.default.EOL +
        utils_1.Utils.colorText('Address: ', 'yellow') + address);
}
;
//# sourceMappingURL=sign.js.map
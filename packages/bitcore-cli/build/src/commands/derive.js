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
exports.command = command;
exports.deriveKey = deriveKey;
const os_1 = __importDefault(require("os"));
const prompt = __importStar(require("@clack/prompts"));
const crypto_wallet_core_1 = require("crypto-wallet-core");
const errors_1 = require("../errors");
const prompts_1 = require("../prompts");
function command(args) {
    const { program } = args;
    program
        .description('Derive a key or address from the wallet')
        .usage('<walletName> --command derive [options]')
        .optionsGroup('Derivation Options')
        .option('--path <path>', 'Derivation path to use (e.g. m/0/1)')
        .parse(process.argv);
    const opts = program.opts();
    if (opts.help) {
        program.help();
    }
    return opts;
}
async function deriveKey(args) {
    const { wallet, opts } = args;
    if (opts.command) {
        Object.assign(opts, command(args));
    }
    const promptAction = async () => {
        const a = await (0, prompts_1.getAction)({
            options: [
                { label: '↻ Redo', value: 'again', hint: 'Derive another key' },
            ]
        });
        if (prompt.isCancel(a)) {
            throw new errors_1.UserCancelled();
        }
        return a;
    };
    let action;
    do {
        try {
            const path = opts.path || await prompt.text({
                message: 'Enter the derivation path:',
                placeholder: 'e.g. m/0/1',
                validate: (input) => {
                    if (!input || !input.startsWith('m/')) {
                        return 'Invalid derivation path. It should start with "m/"';
                    }
                    return null;
                }
            });
            if (prompt.isCancel(path)) {
                throw new errors_1.UserCancelled();
            }
            const hardened = path.includes('\'');
            if (hardened) {
                const xPrivKey = await wallet.getXPrivKey();
                const derived = crypto_wallet_core_1.Deriver.derivePrivateKeyWithPath(wallet.client.credentials.chain, wallet.client.credentials.network, xPrivKey, path, wallet.client.credentials.addressType || 'P2PKH');
                const lines = [];
                lines.push(`Address: ${derived.address}`);
                lines.push(`Public Key: ${derived.pubKey}`);
                lines.push(`Private Key: ${derived.privKey}`);
                prompt.note(lines.join(os_1.default.EOL), `Derived Key (${path})`);
            }
            else {
                const xPubKey = wallet.getXPubKey();
                const address = crypto_wallet_core_1.Deriver.deriveAddressWithPath(wallet.client.credentials.chain, wallet.client.credentials.network, xPubKey, path, wallet.client.credentials.addressType || 'P2PKH');
                prompt.note(`${address}`, `Derived Address (${path})`);
            }
            action = opts.command ? 'exit' : await promptAction();
        }
        catch (err) {
            if (!(err instanceof errors_1.UserCancelled)) {
                prompt.log.error(opts.verbose ? (err.stack || err.message) : err.message);
            }
            action = opts.command ? 'exit' : await promptAction();
        }
    } while (action === 'again');
    return { action };
}
;
//# sourceMappingURL=derive.js.map
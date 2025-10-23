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
exports.createThresholdSigWallet = createThresholdSigWallet;
const crypto_1 = __importDefault(require("crypto"));
const os_1 = __importDefault(require("os"));
const url_1 = __importDefault(require("url"));
const prompt = __importStar(require("@clack/prompts"));
const bitcore_wallet_client_1 = require("bitcore-wallet-client");
const errors_1 = require("../../errors");
const prompts_1 = require("../../prompts");
const utils_1 = require("../../utils");
async function createThresholdSigWallet(args) {
    const { wallet, chain, network, m, n, opts } = args;
    const { verbose, mnemonic } = opts;
    const copayerName = await (0, prompts_1.getCopayerName)();
    const addressType = await (0, prompts_1.getAddressType)({ chain, network, isMultiSig: false });
    const password = await (0, prompts_1.getPassword)('Enter a password for the wallet:', { hidden: false });
    let key;
    if (mnemonic) {
        key = new bitcore_wallet_client_1.Key({ seedType: 'mnemonic', seedData: mnemonic, password });
    }
    else {
        key = new bitcore_wallet_client_1.Key({ seedType: 'new', password });
    }
    const tss = new bitcore_wallet_client_1.TssKey.TssKeyGen({
        chain,
        network,
        baseUrl: url_1.default.resolve(opts.host, '/bws/api'),
        key,
        password
    });
    const tssPassword = crypto_1.default.randomBytes(20).toString('hex');
    await tss.newKey({ m, n, password: tssPassword });
    for (let i = 1; i < n; i++) {
        const pubkey = await prompt.text({
            message: `Enter party ${i}'s public key:`,
            validate: (input) => input ? undefined : 'Public key cannot be empty.',
        });
        if (prompt.isCancel(pubkey)) {
            throw new errors_1.UserCancelled();
        }
        const joinCode = await tss.createJoinCode({
            partyId: i,
            partyPubKey: pubkey,
            extra: tssPassword
        });
        const goBack = await prompt.select({
            message: `Join code for party ${i}:${os_1.default.EOL}${joinCode}`,
            initialValue: false,
            options: [
                {
                    label: 'Continue →',
                    value: false
                },
                {
                    label: '↩ Go Back',
                    value: true,
                    hint: `Re-enter party ${i}'s public key`
                }
            ]
        });
        if (prompt.isCancel(goBack)) {
            throw new errors_1.UserCancelled();
        }
        if (goBack) {
            i--;
        }
    }
    const spinner = prompt.spinner({ indicator: 'timer' });
    spinner.start('Waiting for all parties to join...');
    await new Promise((resolve, reject) => {
        process.on('SIGINT', () => {
            tss.unsubscribe();
            spinner.stop('Cancelled by user');
            reject(new errors_1.UserCancelled());
        });
        tss.subscribe({
            walletName: wallet.name,
            copayerName,
            createWalletOpts: utils_1.Utils.getSegwitInfo(addressType)
        });
        tss.on('roundsubmitted', (round) => spinner.message(`Round ${round} submitted`));
        tss.on('error', prompt.log.error);
        tss.on('wallet', async (_wallet) => {
        });
        tss.on('complete', async () => {
            try {
                spinner.stop('TSS Key Generation Complete!');
                const key = tss.getTssKey(password);
                await wallet.createFromTss({
                    key,
                    chain,
                    network,
                    password,
                    addressType,
                    copayerName
                });
                verbose && prompt.log.step(`Wallet file saved to: ${utils_1.Utils.colorText(wallet.filename, 'blue')}`);
                resolve();
            }
            catch (err) {
                reject(err);
            }
        });
    });
    return {
        mnemonic: key.get(password).mnemonic
    };
}
//# sourceMappingURL=createThresholdSig.js.map
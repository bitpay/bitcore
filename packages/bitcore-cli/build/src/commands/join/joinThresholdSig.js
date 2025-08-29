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
exports.joinThresholdSigWallet = joinThresholdSigWallet;
const prompt = __importStar(require("@clack/prompts"));
const bitcore_wallet_client_1 = require("bitcore-wallet-client");
const os_1 = __importDefault(require("os"));
const url_1 = __importDefault(require("url"));
const errors_1 = require("../../errors");
const prompts_1 = require("../../prompts");
const utils_1 = require("../../utils");
async function joinThresholdSigWallet(args) {
    const { wallet, chain, opts } = args;
    const { verbose, mnemonic } = opts;
    const network = await (0, prompts_1.getNetwork)();
    const copayerName = await (0, prompts_1.getCopayerName)();
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
    const authPubKey = tss.getAuthPublicKey();
    const done = await prompt.select({
        message: `Give the following public key to the session leader:${os_1.default.EOL}${utils_1.Utils.colorText(authPubKey, 'blue')}`,
        options: [{ label: 'Done', value: true, hint: 'Hit Enter/Return to continue' }]
    });
    if (prompt.isCancel(done)) {
        throw new errors_1.UserCancelled();
    }
    const joinCode = await prompt.text({
        message: 'Enter the join code from the session leader:',
        validate: (code) => {
            try {
                const decryptedJoinCode = tss.checkJoinCode({ code });
                if (decryptedJoinCode.chain.toLowerCase() !== chain || decryptedJoinCode.network.toLowerCase() !== network) {
                    return `Join code chain + network (${decryptedJoinCode.chain}:${decryptedJoinCode.network}) does not match what you specified for this wallet (${chain}:${network}).`;
                }
                return null;
            }
            catch (err) {
                return 'Invalid join code: ' + (verbose ? err.stack : err.message);
            }
        }
    });
    if (prompt.isCancel(joinCode)) {
        throw new errors_1.UserCancelled();
    }
    if (verbose) {
        const decryptedJoinCode = tss.checkJoinCode({ code: joinCode });
        const ans = await prompt.confirm({
            message: `${JSON.stringify(decryptedJoinCode, null, 2)}${os_1.default.EOL}Is this correct?`,
            initialValue: true,
        });
        if (prompt.isCancel(ans) || !ans) {
            throw new errors_1.UserCancelled();
        }
    }
    await tss.joinKey({ code: joinCode });
    const spinner = prompt.spinner({ indicator: 'timer' });
    spinner.start('Waiting for all parties to join...');
    await new Promise((resolve, reject) => {
        process.on('SIGINT', () => {
            tss.unsubscribe();
            spinner.stop('Cancelled by user');
            reject(new errors_1.UserCancelled());
        });
        tss.subscribe({ copayerName });
        tss.on('roundsubmitted', (round) => spinner.message(`Round ${round} submitted`));
        tss.on('error', prompt.log.error);
        tss.on('wallet', async (wallet) => {
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
//# sourceMappingURL=joinThresholdSig.js.map
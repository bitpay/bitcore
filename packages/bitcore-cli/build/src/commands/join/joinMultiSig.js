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
exports.joinMultiSigWallet = joinMultiSigWallet;
const prompt = __importStar(require("@clack/prompts"));
const bitcore_wallet_client_1 = __importDefault(require("bitcore-wallet-client"));
const prompts_1 = require("../../prompts");
const utils_1 = require("../../utils");
async function joinMultiSigWallet(args) {
    const { wallet, opts } = args;
    const { verbose, mnemonic } = opts;
    const secret = (await prompt.text({
        message: 'Enter the secret to join the wallet:',
        validate: (input) => !!input?.trim() ? null : 'Secret cannot be empty.',
    })).toString().trim();
    const parsed = bitcore_wallet_client_1.default.parseSecret(secret);
    const { coin: chain, network } = parsed;
    const copayerName = await (0, prompts_1.getCopayerName)();
    const password = await (0, prompts_1.getPassword)('Enter a password for the wallet:', { hidden: false });
    const { key, creds } = await wallet.create({ chain, network, account: 0, n: 2, password, mnemonic, copayerName });
    const joinedWallet = await wallet.client.joinWallet(secret, copayerName, { chain });
    await wallet.load();
    prompt.log.success(utils_1.Utils.colorText(`Wallet joined: ${joinedWallet.name}`, 'green'));
    verbose && prompt.log.step(`Wallet file saved to: ${utils_1.Utils.colorText(wallet.filename, 'blue')}`);
    return {
        mnemonic: key.get(password).mnemonic,
    };
}
;
//# sourceMappingURL=joinMultiSig.js.map
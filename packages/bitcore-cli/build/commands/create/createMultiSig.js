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
exports.createMultiSigWallet = createMultiSigWallet;
const prompt = __importStar(require("@clack/prompts"));
const os_1 = __importDefault(require("os"));
const prompts_1 = require("../../prompts");
const utils_1 = require("../../utils");
async function createMultiSigWallet(args) {
    const { wallet, chain, network, m, n, opts } = args;
    const { verbose, mnemonic } = opts;
    const copayerName = await (0, prompts_1.getCopayerName)();
    const addressType = await (0, prompts_1.getAddressType)({ chain, network, isMultiSig: true });
    const password = await (0, prompts_1.getPassword)('Enter a password for the wallet:', { hidden: false });
    const { key, secret } = await wallet.create({ chain, network, account: 0, n, m, password, mnemonic, addressType, copayerName });
    prompt.log.success(utils_1.Utils.colorText(`${chain.toUpperCase()} ${network} wallet created`, 'green'));
    verbose && prompt.log.step(`Wallet file saved to: ${utils_1.Utils.colorText(wallet.filename, 'blue')}`);
    await prompt.select({
        message: `Share this secret with the other participants:${os_1.default.EOL}${utils_1.Utils.colorText(secret, 'blue')}`,
        options: [{ label: 'Done', value: true, hint: 'Hit Enter/Return to continue' }]
    });
    return {
        mnemonic: key.get(password).mnemonic,
    };
}
//# sourceMappingURL=createMultiSig.js.map
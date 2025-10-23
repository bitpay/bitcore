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
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinWallet = joinWallet;
const prompt = __importStar(require("@clack/prompts"));
const crypto_wallet_core_1 = require("crypto-wallet-core");
const prompts_1 = require("../../prompts");
const utils_1 = require("../../utils");
const joinMultiSig_1 = require("./joinMultiSig");
const joinThresholdSig_1 = require("./joinThresholdSig");
async function joinWallet(args) {
    const { wallet, opts } = args;
    const chain = await (0, prompts_1.getChain)();
    let useTss = true;
    if (crypto_wallet_core_1.Constants.MULTISIG_CHAINS.includes(chain)) {
        const scheme = await prompt.select({
            message: 'Which scheme is the wallet?',
            options: [
                {
                    label: 'MultiSig - On-chain Multi-Signature Scheme',
                    value: 'multisig',
                    hint: 'Easier setup and backup (only need 12 words). Higher transaction fees.'
                },
                {
                    label: 'TSS - Threshold Signature Scheme',
                    value: 'tss',
                    hint: 'More complicated setup and backup. Lower transaction fees.'
                },
            ],
            initialValue: process.env['BITCORE_CLI_MULTISIG_SCHEME'] || 'multisig',
        });
        useTss = scheme === 'tss';
    }
    let mnemonic;
    if (useTss) {
        ({ mnemonic } = await (0, joinThresholdSig_1.joinThresholdSigWallet)(Object.assign({}, args, { chain })));
    }
    else {
        ({ mnemonic } = await (0, joinMultiSig_1.joinMultiSigWallet)(args));
    }
    if (!opts.mnemonic) {
        await utils_1.Utils.showMnemonic(wallet.name, mnemonic, opts);
    }
}
;
//# sourceMappingURL=index.js.map
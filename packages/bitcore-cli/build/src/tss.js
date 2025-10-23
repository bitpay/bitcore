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
exports.sign = sign;
const url_1 = __importDefault(require("url"));
const prompt = __importStar(require("@clack/prompts"));
const bitcore_wallet_client_1 = require("bitcore-wallet-client");
const crypto_wallet_core_1 = require("crypto-wallet-core");
const errors_1 = require("./errors");
async function sign(args) {
    const { host, chain, walletData, messageHash, derivationPath, password, id, logMessageWaiting, logMessageCompleted } = args;
    const isEvm = bitcore_wallet_client_1.Utils.isEvmChain(chain);
    const transformISignature = (signature) => {
        if (isEvm) {
            return crypto_wallet_core_1.ethers.Signature.from(signature).serialized;
        }
    };
    const tssSign = new bitcore_wallet_client_1.TssSign.TssSign({
        baseUrl: url_1.default.resolve(host, '/bws/api'),
        credentials: walletData.creds,
        tssKey: walletData.key
    });
    try {
        await tssSign.start({
            id,
            messageHash,
            derivationPath,
            password
        });
    }
    catch (err) {
        if (err.message?.startsWith('TSS_ROUND_ALREADY_DONE')) {
            const sig = await tssSign.getSignatureFromServer();
            if (!sig) {
                throw new Error('It looks like the TSS signature session was interrupted. Try deleting this proposal and creating a new one.');
            }
            return {
                signature: transformISignature(sig),
                publicKey: sig.pubKey
            };
        }
        throw err;
    }
    const spinner = prompt.spinner({ indicator: 'timer' });
    spinner.start(logMessageWaiting || 'Waiting for all parties to join...');
    const sig = await new Promise((resolve, reject) => {
        process.on('SIGINT', () => {
            tssSign.unsubscribe();
            spinner.stop('Cancelled by user');
            reject(new errors_1.UserCancelled());
        });
        tssSign.subscribe();
        tssSign.on('roundsubmitted', (round) => spinner.message(`Round ${round} submitted`));
        tssSign.on('error', prompt.log.error);
        tssSign.on('complete', async () => {
            try {
                spinner.stop(logMessageCompleted || 'TSS signature generated');
                const signature = tssSign.getSignature();
                const sigString = transformISignature(signature);
                resolve({
                    signature: sigString,
                    publicKey: signature.pubKey
                });
            }
            catch (err) {
                reject(err);
            }
        });
    });
    return sig;
}
//# sourceMappingURL=tss.js.map
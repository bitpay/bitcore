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
exports.walletStatus = walletStatus;
const prompt = __importStar(require("@clack/prompts"));
const moment_1 = __importDefault(require("moment"));
const os_1 = __importDefault(require("os"));
const utils_1 = require("../utils");
const balance_1 = require("./balance");
async function walletStatus(args) {
    const { wallet, opts } = args;
    const { tokenName } = opts;
    const status = await wallet.client.getStatus({});
    const w = status.wallet;
    const statusLines = [`ID: ${w.id}`];
    statusLines.push(`${w.coin.toUpperCase()} ${utils_1.Utils.capitalize(w.network)}`);
    statusLines.push(`${w.m}-of-${w.n}${w.tssKeyId ? ' (TSS)' : ''}${w.singleAddress ? ' single-address' : ''} [${w.derivationStrategy} ${w.addressType}]`);
    statusLines.push(`Status: ${utils_1.Utils.renderStatus(w.status)}`);
    statusLines.push(`Created on: ${(0, moment_1.default)(w.createdOn * 1000)}`);
    if (w.status !== 'complete') {
        statusLines.push('');
        statusLines.push(`Missing ${(w.n - w.copayers.length)} copayers`);
        statusLines.push(`Secret: ${utils_1.Utils.colorText(w.secret, 'yellow')}`);
    }
    prompt.note(statusLines.join(os_1.default.EOL), `${tokenName ? '(Linked) ' : ''}Wallet info`);
    (0, balance_1.displayBalance)(status.balance, w.coin, Object.assign({}, opts, { showByAddress: false }));
    if (status.pendingTxps?.length) {
        prompt.log.warn(utils_1.Utils.colorText(`${status.pendingTxps?.length} pending tx proposals`, 'yellow'));
    }
    else {
        prompt.log.info('No pending tx proposals');
    }
    return status;
}
;
//# sourceMappingURL=status.js.map
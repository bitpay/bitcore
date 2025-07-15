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
exports.getBalance = getBalance;
exports.displayBalance = displayBalance;
const prompt = __importStar(require("@clack/prompts"));
const os_1 = __importDefault(require("os"));
const utils_1 = require("../utils");
async function getBalance(args) {
    const { wallet, opts } = args;
    if (!wallet.isComplete()) {
        prompt.log.warn('Wallet is not complete. Check the wallet status for more details.');
        return {};
    }
    const bal = await wallet.client.getBalance(opts);
    const coin = wallet.client.credentials.coin;
    displayBalance(bal, coin);
    return bal;
}
;
function displayBalance(bal, coin, opts) {
    const format = (amount) => utils_1.Utils.renderAmount(amount, coin, opts);
    const lines = [`Total: ${format(bal.totalAmount)} (${format(bal.lockedAmount)} locked)`];
    lines.push(`Confirmed: ${format(bal.totalConfirmedAmount)} (${format(bal.lockedConfirmedAmount)} locked)`);
    lines.push(`Available: ${format(bal.availableAmount)} (${format(bal.availableConfirmedAmount)} confirmed / ${format(bal.availableAmount - bal.availableConfirmedAmount)} unconfirmed)`);
    if (opts?.showByAddress && bal.byAddress?.length > 0) {
        lines.push('');
        lines.push('By address:');
        for (const item of bal.byAddress) {
            lines.push(`  ${item.address} (${item.path}): ${format(item.amount)}`);
        }
    }
    prompt.note(lines.join(os_1.default.EOL), `${coin.toUpperCase()} Balance ${opts?.contractAddress ? `(${opts.code} - ${opts.contractAddress})` : ''}`);
}
//# sourceMappingURL=balance.js.map
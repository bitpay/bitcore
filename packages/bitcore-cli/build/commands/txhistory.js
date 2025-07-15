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
exports.getTxHistory = getTxHistory;
const prompt = __importStar(require("@clack/prompts"));
const fs_1 = __importDefault(require("fs"));
const moment_1 = __importDefault(require("moment"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("../utils");
async function getTxHistory(args) {
    const { wallet, opts } = args;
    const { pageSize } = opts;
    const token = {};
    let compact = true;
    let printRaw = false;
    await utils_1.Utils.paginate(async (page, viewAction) => {
        if (viewAction === 'f') {
            compact = !compact;
            printRaw = false;
        }
        printRaw = viewAction === 'r' ? !printRaw : printRaw;
        const exportToFile = viewAction === 'e';
        const history = await wallet.client.getTxHistory({
            includeExtendedInfo: true,
            tokenAddress: token.contractAddress,
            limit: pageSize,
            skip: (page - 1) * pageSize
        });
        const extraChoices = [
            compact ? { value: 'f', label: 'Expand format' } : { value: 'f', label: 'Compact format' },
            printRaw ? { value: 'r', label: 'Print pretty' } : { value: 'r', label: 'Print raw tx objects' },
            { value: 'e', label: 'Export to file' }
        ];
        if (exportToFile) {
            await fs_1.default.promises.writeFile(path_1.default.join(os_1.default.homedir(), `${wallet.name}-tx-history[${page}].json`), JSON.stringify(history, null, 2));
            prompt.log.info(`Page ${page} exported to: ~/${wallet.name}-tx-history[${page}].json`);
            return { result: history, extraChoices };
        }
        if (printRaw) {
            prompt.log.info(`Raw Tx History:${os_1.default.EOL}` + JSON.stringify(history, null, 2));
            return { result: history, extraChoices };
        }
        const lines = [];
        let sum = 0;
        for (const tx of history) {
            const timestamp = (0, moment_1.default)(tx.time * 1000);
            let time = timestamp.toString();
            if (compact) {
                time = timestamp.format('YYYY-MM-DD HH:mm:ss');
            }
            const txid = compact ? utils_1.Utils.compactString(tx.txid) : tx.txid;
            const amount = utils_1.Utils.renderAmount(tx.amount, wallet.client.credentials.coin, token);
            const confirmations = tx.confirmations || 0;
            let direction = '';
            switch (tx.action) {
                case 'received':
                    direction = '<=';
                    sum = sum + tx.amount;
                    break;
                case 'moved':
                    sum = sum - tx.fees;
                    direction = '==';
                    break;
                case 'sent':
                    direction = '=>';
                    sum = sum - tx.amount - tx.fees;
                    break;
            }
            const action = compact ? '' : ` ${tx.action}`;
            if (tx.size) {
                lines.push(`[${time}] ${txid} ${direction}${action} ${amount} (${(tx.fees / tx.size).toFixed(2)} sats/b) (${confirmations} confs)`);
            }
            else {
                lines.push(`[${time}] ${txid} ${direction}${action} ${amount} (${tx.fees} fee) (${confirmations} confs)`);
            }
        }
        prompt.note(lines.join(os_1.default.EOL), `Tx History (page ${page})`);
        return { result: history, extraChoices };
    }, {
        pageSize,
    });
}
;
//# sourceMappingURL=txhistory.js.map
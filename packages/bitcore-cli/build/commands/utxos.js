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
exports.getUtxos = getUtxos;
const prompt = __importStar(require("@clack/prompts"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("../utils");
async function getUtxos(args) {
    const { wallet, opts } = args;
    const utxos = await wallet.client.getUtxos({});
    if (utxos.length === 0) {
        prompt.log.info('No UTXOs found for this wallet.');
        return;
    }
    let action;
    let compact = true;
    let printRaw = false;
    let sort = 'time';
    let sortDir = 1;
    do {
        if (action === 'f') {
            compact = !compact;
            printRaw = false;
        }
        if (action === 'r') {
            printRaw = !printRaw;
        }
        if (action === 's') {
            if (sort === 'amount') {
                sort = 'time';
                utxos.sort((a, b) => {
                    return sortDir == -1 ? (b.confirmations || 0) - (a.confirmations || 0) : (a.confirmations || 0) - (b.confirmations || 0);
                });
            }
            else {
                sort = 'amount';
                utxos.sort((a, b) => {
                    return sortDir == -1 ? b.amount - a.amount : a.amount - b.amount;
                });
            }
        }
        if (action === '~') {
            sortDir *= -1;
            utxos.reverse();
        }
        if (action === 'e') {
            const filename = path_1.default.join(os_1.default.homedir(), `${wallet.name}-utxos-${new Date().toISOString()}.json`);
            await fs_1.default.promises.writeFile(filename, JSON.stringify(utxos));
            prompt.log.info(`UTXOs exported to: ${filename}`);
        }
        else if (printRaw) {
            prompt.log.info(`Raw UTXOs:${os_1.default.EOL}` + JSON.stringify(utxos, null, 2));
        }
        else {
            const lines = [];
            for (const utxo of utxos) {
                const address = compact ? utils_1.Utils.compactString(utxo.address) : utxo.address;
                const txid = compact ? utils_1.Utils.compactString(utxo.txid) : utxo.txid;
                const amount = utils_1.Utils.renderAmount(utxo.satoshis, wallet.client.credentials.coin);
                lines.push(`[${txid}:${utxo.vout}] ${amount} ${address} (${utxo.path}) (${utxo.confirmations || 0} confs)`);
            }
            ;
            prompt.note(lines.join(os_1.default.EOL), 'UTXOs');
        }
        action = await prompt.selectKey({
            message: 'Page Controls:',
            options: [
                compact ? { value: 'f', label: 'Expand format' } : { value: 'f', label: 'Compact format' },
                sort === 'amount' ? { value: 's', label: 'Sort by time' } : { value: 's', label: 'Sort by amount' },
                sortDir === -1 ? { value: '~', label: 'Sort ascending' } : { value: '~', label: 'Sort descending' },
                printRaw ? { value: 'r', label: 'Print pretty' } : { value: 'r', label: 'Print raw UTXOs' },
                { value: 'e', label: 'Export to file' },
                { value: 'x', label: 'Close' }
            ]
        });
    } while (action !== 'x');
}
;
//# sourceMappingURL=utxos.js.map
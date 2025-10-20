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
exports.command = command;
exports.getUtxos = getUtxos;
const prompt = __importStar(require("@clack/prompts"));
const fs_1 = __importDefault(require("fs"));
const prompts_1 = require("../prompts");
const os_1 = __importDefault(require("os"));
const utils_1 = require("../utils");
function command(args) {
    const { wallet, program } = args;
    program
        .description('List unspent transaction outputs (UTXOs) for a wallet')
        .usage('<walletName> --command utxos [options]')
        .optionsGroup('UTXOs Options')
        .option('--expand', 'Display in expanded format')
        .option('--sortBy <field>', 'Sort by "amount" or "time"', 'time')
        .option('--sortDir <direction>', 'Sort direction "asc" or "desc"', 'asc')
        .option('--raw', 'Print raw UTXO objects instead of formatted output')
        .option('--export [filename]', `Export UTXOs to a file (default: ~/${wallet.name}_utxos_<timestamp>.json)`)
        .parse(process.argv);
    const opts = program.opts();
    if (opts.help) {
        program.help();
    }
    return opts;
}
async function getUtxos(args) {
    const { wallet, opts } = args;
    if (opts.command) {
        Object.assign(opts, command(args));
    }
    const utxos = await wallet.client.getUtxos({});
    if (utxos.length === 0) {
        prompt.log.info('No UTXOs found for this wallet.');
        return;
    }
    let ACTIONS;
    (function (ACTIONS) {
        ACTIONS["FORMAT"] = "f";
        ACTIONS["SORT"] = "s";
        ACTIONS["REVERSE_SORT"] = "~";
        ACTIONS["PRINT_RAW"] = "r";
        ACTIONS["EXPORT"] = "e";
        ACTIONS["EXIT"] = "x";
    })(ACTIONS || (ACTIONS = {}));
    ;
    let action = opts.export ? ACTIONS.EXPORT : undefined;
    let compact = !opts.expand;
    let printRaw = opts.raw ?? false;
    let sort = opts.sortBy || 'time';
    let sortDir = opts.sortDir === 'desc' ? -1 : 1;
    do {
        if (action === ACTIONS.FORMAT) {
            compact = !compact;
            printRaw = false;
        }
        if (action === ACTIONS.PRINT_RAW) {
            printRaw = !printRaw;
        }
        if (action === ACTIONS.SORT) {
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
        if (action === ACTIONS.REVERSE_SORT) {
            sortDir *= -1;
            utxos.reverse();
        }
        if (action === ACTIONS.EXPORT) {
            const defaultValue = `~/${wallet.name}_utxos_${new Date().toISOString()}.json`;
            const filename = opts.command
                ? utils_1.Utils.replaceTilde(typeof opts.export === 'string' ? opts.export : defaultValue)
                : await (0, prompts_1.getFileName)({
                    message: 'Enter output file name:',
                    defaultValue: `~/${wallet.name}_utxos_${new Date().toISOString()}.json`
                });
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
                const amount = utils_1.Utils.renderAmount(wallet.client.credentials.coin, utxo.satoshis);
                lines.push(`[${txid}:${utxo.vout}] ${amount} ${address} (${utxo.path}) (${utxo.confirmations || 0} confs)`);
            }
            ;
            prompt.note(lines.join(os_1.default.EOL), 'UTXOs');
        }
        action = opts.command ? ACTIONS.EXIT : await prompt.selectKey({
            message: 'Page Controls:',
            options: [
                compact ? { value: ACTIONS.FORMAT, label: 'Expand format' } : { value: ACTIONS.FORMAT, label: 'Compact format' },
                sort === 'amount' ? { value: ACTIONS.SORT, label: 'Sort by time' } : { value: ACTIONS.SORT, label: 'Sort by amount' },
                sortDir === -1 ? { value: ACTIONS.REVERSE_SORT, label: 'Sort ascending' } : { value: ACTIONS.REVERSE_SORT, label: 'Sort descending' },
                printRaw ? { value: ACTIONS.PRINT_RAW, label: 'Print pretty' } : { value: ACTIONS.PRINT_RAW, label: 'Print raw UTXOs' },
                { value: ACTIONS.EXPORT, label: 'Export to file' },
                { value: ACTIONS.EXIT, label: 'Close' }
            ]
        });
    } while (action !== ACTIONS.EXIT);
}
;
//# sourceMappingURL=utxos.js.map
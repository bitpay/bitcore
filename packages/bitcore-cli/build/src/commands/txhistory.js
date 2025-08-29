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
exports.getTxHistory = getTxHistory;
const prompt = __importStar(require("@clack/prompts"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const prompts_1 = require("../prompts");
const utils_1 = require("../utils");
function command(args) {
    const { wallet, program } = args;
    program
        .description('Get transaction history for a wallet')
        .usage('<walletName> --command history [options]')
        .optionsGroup('Transaction History Options')
        .option('--page <page>', 'Page number to display', '1')
        .option('--token <token>', 'Token to get the balance for (e.g. USDC)')
        .option('--tokenAddress <address>', 'Token contract address to get the balance for')
        .option('--expand', 'Display in expanded format')
        .option('--raw', 'Print raw transaction objects instead of formatted output')
        .option('--export [filename]', `Export the transaction history to a file (default: ~/${wallet.name}_txhistory_<date>_<page>.json)`)
        .parse(process.argv);
    const opts = program.opts();
    if (opts.help) {
        program.help();
    }
    return opts;
}
async function getTxHistory(args) {
    const { wallet, opts } = args;
    if (opts.command) {
        Object.assign(opts, command(args));
    }
    let tokenObj;
    if (opts.token || opts.tokenAddress) {
        tokenObj = await wallet.getToken(opts);
        if (!tokenObj) {
            throw new Error(`Unknown token "${opts.tokenAddress || opts.token}" on ${wallet.chain}:${wallet.network}`);
        }
    }
    const currency = tokenObj?.displayCode || wallet.client.credentials.coin;
    let ViewAction;
    (function (ViewAction) {
        ViewAction["TOGGLE_FORMAT"] = "f";
        ViewAction["TOGGLE_RAW"] = "r";
        ViewAction["EXPORT"] = "e";
    })(ViewAction || (ViewAction = {}));
    let compact = !opts.expand;
    let printRaw = !!opts.raw;
    await utils_1.Utils.paginate(async (page, viewAction) => {
        if (viewAction === ViewAction.TOGGLE_FORMAT) {
            compact = !compact;
            printRaw = false;
        }
        printRaw = viewAction === ViewAction.TOGGLE_RAW ? !printRaw : printRaw;
        const exportToFile = !!opts.export || viewAction === ViewAction.EXPORT;
        const history = await wallet.client.getTxHistory({
            includeExtendedInfo: true,
            tokenAddress: tokenObj?.contractAddress,
            limit: opts.pageSize,
            skip: (page - 1) * opts.pageSize
        });
        const extraChoices = [
            compact ? { value: ViewAction.TOGGLE_FORMAT, label: 'Expand format' } : { value: ViewAction.TOGGLE_FORMAT, label: 'Compact format' },
            printRaw ? { value: ViewAction.TOGGLE_RAW, label: 'Print pretty' } : { value: ViewAction.TOGGLE_RAW, label: 'Print raw tx objects' },
            { value: ViewAction.EXPORT, label: 'Export to file' }
        ];
        if (exportToFile) {
            const d = new Date();
            const dateStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
            const defaultValue = `~/${wallet.name}_txhistory_${dateStr}_${page}.json`;
            const outputFile = opts.command
                ? utils_1.Utils.replaceTilde(typeof opts.export === 'string' ? opts.export : defaultValue)
                : await (0, prompts_1.getFileName)({
                    message: 'Enter output file path to save proposal:',
                    defaultValue,
                });
            await fs_1.default.promises.writeFile(outputFile, JSON.stringify(history, null, 2));
            prompt.log.info(`Page ${page} exported to: ${outputFile}`);
        }
        else if (printRaw) {
            prompt.log.info(`Raw Tx History:${os_1.default.EOL}` + JSON.stringify(history, null, 2));
        }
        else {
            const lines = [];
            let sum = 0;
            for (const tx of history) {
                const timestamp = new Date(tx.time * 1000);
                const time = compact ? utils_1.Utils.formatDateCompact(timestamp) : utils_1.Utils.formatDate(timestamp);
                const txid = compact ? utils_1.Utils.compactString(tx.txid) : tx.txid;
                const amount = utils_1.Utils.renderAmount(currency, tx.amount, tokenObj);
                const confirmations = tx.confirmations || 0;
                let direction = '';
                let contractCall = false;
                switch (tx.action) {
                    case 'received':
                        if (!tx.amount && tx.effects?.length && !tokenObj) {
                            continue;
                        }
                        direction = '<=';
                        sum = sum + tx.amount;
                        break;
                    case 'moved':
                        direction = '==';
                        sum = sum - tx.fees;
                        break;
                    case 'sent':
                        direction = '=>';
                        sum = sum - tx.amount - tx.fees;
                        contractCall = !tx.amount && tx.effects?.length > 0;
                        break;
                }
                const action = compact ? '' : ` ${tx.action}`;
                if (tx.size) {
                    lines.push(`[${time}] ${txid} ${direction}${action} ${amount} (${(tx.fees / tx.size).toFixed(2)} sats/b) (${confirmations} confs)`);
                }
                else {
                    const contractStr = !contractCall ? '' : compact ? '*' : ' [Contract*]';
                    lines.push(`[${time}] ${txid} ${direction}${action} ${amount}${contractStr} (${tx.fees} fee) (${confirmations} confs)`);
                }
            }
            prompt.note(lines.join(os_1.default.EOL), `Tx History (page ${page})`);
        }
        if (opts.command) {
            return { result: [] };
        }
        return { result: history, extraChoices };
    }, {
        pageSize: opts.pageSize,
        initialPage: opts.page,
        exitOn1Page: !!opts.command
    });
    return { action: 'menu' };
}
;
//# sourceMappingURL=txhistory.js.map
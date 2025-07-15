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
exports.getTxProposals = getTxProposals;
const prompt = __importStar(require("@clack/prompts"));
const fs_1 = __importDefault(require("fs"));
const moment_1 = __importDefault(require("moment"));
const os_1 = __importDefault(require("os"));
const errors_1 = require("../errors");
const prompts_1 = require("../prompts");
const utils_1 = require("../utils");
async function getTxProposals(args) {
    const { wallet, opts } = args;
    const myCopayerId = wallet.client.credentials.copayerId;
    const txps = await wallet.client.getTxProposals({
        forAirGapped: false,
    });
    let action;
    let i = 0;
    let printRaw = false;
    do {
        const txp = txps[i];
        if (!txp) {
            prompt.log.info('No more proposals');
        }
        else if (printRaw) {
            prompt.log.info(`ID: ${txp.id}` + os_1.default.EOL + JSON.stringify(txp, null, 2));
        }
        else {
            const lines = [];
            const chain = txp.chain || txp.coin;
            const currency = chain.toUpperCase();
            const feeCurrency = currency;
            lines.push(`Chain: ${chain.toUpperCase()}`);
            lines.push(`Network: ${utils_1.Utils.capitalize(txp.network)}`);
            txp.tokenAddress && lines.push(`Token: ${txp.tokenAddress}`);
            lines.push(`Amount: ${utils_1.Utils.amountFromSats(chain, txp.amount)} ${currency}`);
            lines.push(`Fee: ${utils_1.Utils.amountFromSats(chain, txp.fee)} ${feeCurrency}`);
            lines.push(`Total Amount: ${utils_1.Utils.amountFromSats(chain, txp.amount + txp.fee)} ${currency}`);
            txp.gasPrice && lines.push(`Gas Price: ${utils_1.Utils.displayFeeRate(chain, txp.gasPrice)}`);
            txp.gasLimit && lines.push(`Gas Limit: ${txp.gasLimit}`);
            txp.feePerKb && lines.push(`Fee Rate: ${utils_1.Utils.displayFeeRate(chain, txp.feePerKb)}`);
            txp.nonce != null && lines.push(`Nonce: ${txp.nonce}`);
            lines.push(`Status: ${txp.status}`);
            lines.push(`Creator: ${txp.creatorName}`);
            lines.push(`Created: ${(0, moment_1.default)(txp.createdOn * 1000)}`);
            txp.message && lines.push(`Message: ${txp.message}`);
            lines.push('---------------------------');
            lines.push('Recipients:');
            lines.push(...txp.outputs.map(o => {
                return ` → ${utils_1.Utils.maxLength(o.toAddress)}${o.tag ? `:${o.tag}` : ''}: ${utils_1.Utils.amountFromSats(chain, o.amount)} ${currency}${o.message ? ` (${o.message})` : ''}`;
            }));
            txp.changeAddress && lines.push(`Change Address: ${utils_1.Utils.maxLength(txp.changeAddress.address)} (${txp.changeAddress.path})`);
            lines.push('---------------------------');
            if (txp.actions?.length) {
                lines.push('Actions:');
                lines.push(...txp.actions.map(a => {
                    return ` → ${a.copayerName}: ${a.type}${a.comment ? ` "${a.comment}"` : ''}${a.createdOn ? ` (${(0, moment_1.default)(a.createdOn * 1000)})` : ''}`;
                }));
                lines.push('---------------------------');
            }
            if (txp.txid) {
                lines.push(`Txid: ${utils_1.Utils.colorText(txp.txid, 'green')}`);
            }
            else {
                const missingSigsCnt = txp.requiredSignatures - txp.actions.filter(a => a.type === 'accept').length;
                lines.push(utils_1.Utils.colorText(`Missing Signatures: ${missingSigsCnt}`, missingSigsCnt ? 'yellow' : 'green'));
            }
            prompt.note(lines.join(os_1.default.EOL), `ID: ${txp.id}`);
        }
        const options = [];
        let initialValue;
        if (txp) {
            if (txp.status !== 'broadcasted' && !txp.actions.find(a => a.copayerId === myCopayerId)) {
                options.push({ label: 'Accept', value: 'accept', hint: 'Accept and sign this proposal' });
                options.push({ label: 'Reject', value: 'reject', hint: 'Reject this proposal' });
                initialValue = 'accept';
            }
            if (txp.status !== 'broadcasted' && txp.actions.filter(a => a.type === 'accept').length >= txp.requiredSignatures) {
                options.push({ label: 'Broadcast', value: 'broadcast', hint: 'Broadcast this proposal' });
                initialValue = 'broadcast';
            }
            if (i > 0) {
                options.push({ label: 'Previous', value: 'prev' });
                initialValue = 'prev';
            }
            if (i < txps.length - 1) {
                options.push({ label: 'Next', value: 'next' });
                initialValue = 'next';
            }
            if (printRaw) {
                options.push({ label: 'Print Pretty', value: 'pretty' });
            }
            else {
                options.push({ label: 'Print Raw Object', value: 'raw' });
            }
            if (txp.status !== 'broadcasted') {
                options.push({ label: 'Delete', value: 'delete', hint: 'Delete this proposal' });
            }
            options.push({ label: 'Export', value: 'export', hint: 'Save to a file' });
        }
        action = await (0, prompts_1.getAction)({
            options,
            initialValue
        });
        if (prompt.isCancel(action)) {
            throw new errors_1.UserCancelled();
        }
        switch (action) {
            case 'accept':
                txps[i] = await wallet.signAndBroadcastTxp({ txp });
                if (txps[i].status === 'broadcasted') {
                    prompt.log.success(`Proposal ${txp.id} broadcasted.`);
                }
                else {
                    prompt.log.info(`Proposal ${txps[i].id} signed. More signatures needed to broadcast.`);
                }
                break;
            case 'reject':
                const rejectReason = await prompt.text({
                    message: 'Enter rejection reason:'
                });
                if (prompt.isCancel(rejectReason)) {
                    throw new errors_1.UserCancelled();
                }
                txps[i] = await wallet.client.rejectTxProposal(txp, rejectReason);
                break;
            case 'broadcast':
                txps[i] = await wallet.client.broadcastTxProposal(txp);
                if (txps[i].status === 'broadcasted') {
                    prompt.log.success(`Proposal ${txp.id} broadcasted.`);
                }
                break;
            case 'prev':
                i--;
                printRaw = false;
                break;
            case 'next':
                i++;
                printRaw = false;
                break;
            case 'raw':
            case 'pretty':
                printRaw = !printRaw;
                break;
            case 'delete':
                const confirmDelete = await prompt.confirm({
                    message: `Are you sure you want to delete proposal ${txp.id}?`,
                    initialValue: false
                });
                if (prompt.isCancel(confirmDelete)) {
                    throw new errors_1.UserCancelled();
                }
                if (confirmDelete) {
                    await wallet.client.removeTxProposal(txp);
                    txps.splice(i, 1);
                    if (i >= txps.length) {
                        i = txps.length - 1;
                    }
                    prompt.log.success(`Proposal ${txp.id} deleted.`);
                }
                else {
                    prompt.log.step(`Proposal ${txp.id} not deleted.`);
                }
                break;
            case 'export':
                const outputFile = await prompt.text({
                    message: 'Enter output file path to save proposal:',
                    initialValue: `./${txp.id}.json`,
                    validate: (value) => {
                        if (!value)
                            return 'Output file path is required';
                        return;
                    }
                });
                if (prompt.isCancel(outputFile)) {
                    throw errors_1.UserCancelled;
                }
                fs_1.default.writeFileSync(outputFile, JSON.stringify(txp, null, 2));
                break;
        }
    } while (!['menu', 'exit'].includes(action));
    return { action };
}
;
//# sourceMappingURL=txproposals.js.map
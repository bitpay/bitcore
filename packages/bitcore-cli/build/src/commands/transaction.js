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
exports.createTransaction = createTransaction;
const os_1 = __importDefault(require("os"));
const prompt = __importStar(require("@clack/prompts"));
const crypto_wallet_core_1 = require("crypto-wallet-core");
const errors_1 = require("../errors");
const utils_1 = require("../utils");
function command(args) {
    const { program } = args;
    program
        .description('Create and send a transaction')
        .usage('<walletName> --command transaction [options]')
        .optionsGroup('Transaction Options')
        .option('--to <address>', 'Recipient address')
        .option('--amount <amount>', 'Amount to send (in BTC/ETH/etc). Use "max" to send all available balance')
        .option('--fee <fee>', 'Fee to use')
        .option('--feeRate <rate>', 'Custom fee rate in sats/b, gwei, drops, etc.')
        .option('--feeLevel <level>', 'Fee level to use (e.g. low, normal, high)', 'normal')
        .option('--nonce <nonce>', 'Nonce for the transaction (optional, for chains that require it)')
        .option('--token <token>', 'Token to get the balance for (e.g. USDC)')
        .option('--tokenAddress <address>', 'Token contract address to get the balance for')
        .option('--note <note>', 'Note for the transaction')
        .option('--dry-run', 'Only create the transaction proposal without broadcasting')
        .parse(process.argv);
    const opts = program.opts();
    if (opts.help) {
        program.help();
    }
    if (!opts.to) {
        throw new Error('Recipient address (--to) is required');
    }
    if (!parseFloat(opts.amount) && opts.amount !== 'max') {
        throw new Error('Missing or invalid amount (--amount) specified');
    }
    if (opts.fee && !parseFloat(opts.fee)) {
        throw new Error('Invalid fee specified.');
    }
    if (opts.feeRate && !parseFloat(opts.feeRate)) {
        throw new Error('Invalid fee rate specified.');
    }
    return opts;
}
async function createTransaction(args) {
    const { wallet, opts } = args;
    let { status } = args;
    const { chain, network } = wallet.client.credentials;
    if (opts.command) {
        Object.assign(opts, command(args));
    }
    let tokenObj;
    if (opts.token || opts.tokenAddress) {
        tokenObj = await wallet.getToken(opts);
        if (!tokenObj) {
            throw new Error(`Unknown token "${opts.tokenAddress || opts.token}" on ${chain}:${network}`);
        }
    }
    if (!status) {
        status = await wallet.client.getStatus({ tokenAddress: tokenObj?.contractAddress });
    }
    const { balance } = status;
    const currency = tokenObj?.displayCode || chain.toUpperCase();
    const availableAmount = utils_1.Utils.amountFromSats(chain, balance.availableAmount, tokenObj);
    if (!balance.availableAmount) {
        prompt.log.warn(`You have no available balance to send ${currency} on ${chain}:${network}.`);
        return;
    }
    const to = opts.to || await prompt.text({
        message: 'Enter the recipient address:',
        placeholder: 'e.g. n2HRFgtoihgAhx1qAEXcdBMjoMvAx7AcDc',
        validate: (value) => {
            if (!crypto_wallet_core_1.Validation.validateAddress(chain, network, value)) {
                return `Invalid address for ${chain}:${network}`;
            }
            return;
        }
    });
    if (prompt.isCancel(to)) {
        throw new errors_1.UserCancelled();
    }
    const amount = opts.amount || await prompt.text({
        message: 'Enter the amount to send:',
        placeholder: 'Type `help` for help and to see your balance',
        validate: (value) => {
            if (value === 'help') {
                return `Enter a value in ${currency}` + os_1.default.EOL +
                    'Examples:' + os_1.default.EOL +
                    ` 0.1 - sends 0.1 ${currency}` + os_1.default.EOL +
                    ' max - sends your whole balance (minus fees)' + os_1.default.EOL +
                    os_1.default.EOL +
                    `Your current balance is: ${availableAmount} ${currency}`;
            }
            if (value === 'max') {
                return;
            }
            const val = parseFloat(value);
            if (isNaN(val) || val <= 0) {
                return 'Please enter a valid amount greater than 0';
            }
            if (val > availableAmount) {
                return 'You cannot send more than your balance';
            }
            return;
        },
    });
    if (prompt.isCancel(amount)) {
        throw new errors_1.UserCancelled();
    }
    const sendMax = amount === 'max';
    const amountSats = amount === 'max' ? undefined : utils_1.Utils.amountToSats(chain, amount, tokenObj);
    const note = opts.command ? opts.note : await prompt.text({
        message: 'Enter a note for this transaction (optional):',
        placeholder: 'e.g. paid Hal for pizza',
        initialValue: '',
    });
    if (prompt.isCancel(note)) {
        throw new errors_1.UserCancelled();
    }
    const feeLevels = await wallet.client.getFeeLevels(chain, network);
    const defaultLevel = feeLevels.find(level => level.level === 'normal') || feeLevels[0];
    const feeLevel = opts.command ? (opts.feeLevel || 'custom') : await prompt.select({
        message: 'Select a fee level:',
        options: feeLevels.map(level => ({
            label: `${utils_1.Utils.capitalize(level.level)} - ${utils_1.Utils.displayFeeRate(chain, level.feePerKb)}`,
            value: level.level,
            hint: level.nbBlocks ? `Estimated ${level.nbBlocks} blocks` : undefined
        })).concat([{
                label: 'Custom...',
                value: 'custom'
            }]),
        initialValue: defaultLevel.level,
    });
    if (prompt.isCancel(feeLevel)) {
        throw new errors_1.UserCancelled();
    }
    let customFeeRate = opts.feeRate;
    if (feeLevel === 'custom') {
        const [defaultFeeRate, feeUnits] = utils_1.Utils.displayFeeRate(chain, defaultLevel.feePerKb).split(' ');
        customFeeRate = await prompt.text({
            message: `Enter a custom fee rate in ${feeUnits}:`,
            placeholder: `${utils_1.Utils.capitalize(defaultLevel.level)} rate is ${defaultFeeRate} ${feeUnits}`,
            validate: (value) => {
                const val = parseFloat(value);
                if (isNaN(val) || val <= 0) {
                    return `Please enter a valid fee rate greater than 0 ${feeUnits}`;
                }
                return;
            }
        });
        if (prompt.isCancel(customFeeRate)) {
            throw new errors_1.UserCancelled();
        }
    }
    const txpParams = {
        outputs: [{
                toAddress: to,
                amount: amountSats,
            }],
        message: note,
        feeLevel: feeLevel === 'custom' ? undefined : feeLevel,
        feePerKb: feeLevel === 'custom' ? parseFloat(customFeeRate) : undefined,
        fee: opts.fee ? parseFloat(opts.fee) : undefined,
        sendMax,
        tokenAddress: tokenObj?.contractAddress
    };
    let txp = await wallet.client.createTxProposal({
        ...txpParams,
        dryRun: true
    });
    const lines = [];
    lines.push(`To: ${to}`);
    lines.push(`Amount: ${utils_1.Utils.renderAmount(currency, txp.amount, tokenObj)}`);
    lines.push(`Fee: ${utils_1.Utils.renderAmount(chain, txp.fee)} (${utils_1.Utils.displayFeeRate(chain, txp.feePerKb)})`);
    lines.push(`Total: ${tokenObj
        ? utils_1.Utils.renderAmount(currency, txp.amount, tokenObj) + ` + ${utils_1.Utils.renderAmount(chain, txp.fee)}`
        : utils_1.Utils.renderAmount(currency, txp.amount + txp.fee)}`);
    if (txp.nonce != null) {
        lines.push(`Nonce: ${txp.nonce}`);
    }
    if (note) {
        lines.push(`Note: ${txp.message}`);
    }
    prompt.note(lines.join(os_1.default.EOL), 'Transaction Preview');
    const confirmed = await prompt.confirm({
        message: 'Send this transaction?' + (wallet.isTss() ? ` (This wallet requires ${wallet.getMinSigners() - 1} other participant(s) be ready to sign)` : ''),
        initialValue: true,
    });
    if (prompt.isCancel(confirmed) || !confirmed) {
        prompt.log.warn('Transaction cancelled by user.');
        return;
    }
    txp = await wallet.client.createTxProposal(txpParams);
    txp = await wallet.client.publishTxProposal({ txp });
    txp = await wallet.signAndBroadcastTxp({ txp });
    if (txp.status === 'broadcasted') {
        prompt.log.success(`Txid: ${utils_1.Utils.colorText(txp.txid, 'green')}`);
    }
    else {
        prompt.log.info(`Proposal ${txp.id} signed. More signatures needed to broadcast.`);
    }
}
;
//# sourceMappingURL=transaction.js.map
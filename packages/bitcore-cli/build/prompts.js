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
exports.getChain = getChain;
exports.getNetwork = getNetwork;
exports.getPassword = getPassword;
exports.getMofN = getMofN;
exports.getIsMultiParty = getIsMultiParty;
exports.getMultiPartyScheme = getMultiPartyScheme;
exports.getCopayerName = getCopayerName;
exports.getAddressType = getAddressType;
exports.getAction = getAction;
const prompt = __importStar(require("@clack/prompts"));
const crypto_wallet_core_1 = require("crypto-wallet-core");
const constants_1 = require("./constants");
const errors_1 = require("./errors");
const utils_1 = require("./utils");
const libs = {
    btc: crypto_wallet_core_1.BitcoreLib,
    ltc: crypto_wallet_core_1.BitcoreLibLtc,
};
async function getChain() {
    const defaultVal = process.env['BITCORE_CLI_CHAIN'] || 'btc';
    const chain = await prompt.text({
        message: 'Chain:',
        placeholder: `Default: ${defaultVal}`,
        defaultValue: defaultVal,
    });
    if (prompt.isCancel(chain)) {
        throw new errors_1.UserCancelled();
    }
    return chain.toLowerCase();
}
async function getNetwork() {
    const defaultVal = process.env['BITCORE_CLI_NETWORK'] || 'mainnet';
    const network = await prompt.text({
        message: 'Network:',
        placeholder: `Default: ${defaultVal}`,
        defaultValue: defaultVal,
        validate: (input) => {
            const validNetworks = ['mainnet', 'testnet', 'regtest'];
            return (!input || validNetworks.includes(input.toLowerCase())) ? null : `Invalid network '${input}'. Valid options are: ${validNetworks.join(', ')}`;
        }
    });
    if (prompt.isCancel(network)) {
        throw new errors_1.UserCancelled();
    }
    return network;
}
;
async function getPassword(msg, opts) {
    opts = opts || {};
    opts.minLength = opts.minLength ?? 0;
    const hidden = opts.hidden ?? true;
    const password = await prompt.password({
        message: (msg || 'Password:') + (hidden ? ' (hidden)' : ''),
        mask: hidden ? '' : '*',
        validate: (input) => input?.length >= opts.minLength ? opts.validate?.(input) : `Password must be at least ${opts.minLength} characters long.`,
    });
    if (prompt.isCancel(password)) {
        throw new errors_1.UserCancelled();
    }
    return password;
}
;
async function getMofN() {
    const defaultVal = process.env['BITCORE_CLI_MULTIPARTY_M_N'] || '2-3';
    const mOfN = await prompt.text({
        message: 'M-N:',
        placeholder: `Default: ${defaultVal}. Type 'help' for more info.`,
        defaultValue: defaultVal,
        validate: (input) => {
            try {
                if (input === 'help') {
                    return 'Multi-signature wallets require you to specify how many signatures are required to spend from the wallet ' +
                        '(M) and how many total wallet members there are (N). The format is M-N, where M is the number of signatures ' +
                        'required and N is the total number of wallet members. For example, 2-3 means 2 signatures are required out ' +
                        'of 3 wallet members.';
                }
                input = input || defaultVal;
                const [m, n] = utils_1.Utils.parseMN(input);
                if (isNaN(m) || isNaN(n)) {
                    return 'M and N must be numbers';
                }
                else if (m < 1 || n < 2) {
                    return 'M must be at least 1 and N must be at least 2';
                }
                else if (m > n) {
                    return 'M cannot be greater than N';
                }
                return;
            }
            catch (e) {
                return e.message;
            }
        }
    });
    if (prompt.isCancel(mOfN)) {
        throw new errors_1.UserCancelled();
    }
    return mOfN;
}
;
async function getIsMultiParty() {
    const isMultiParty = await prompt.confirm({
        message: 'Is this a multi-party wallet?',
        initialValue: process.env['BITCORE_CLI_MULTIPARTY'] === 'true' || false,
    });
    if (prompt.isCancel(isMultiParty)) {
        throw new errors_1.UserCancelled();
    }
    return isMultiParty;
}
async function getMultiPartyScheme() {
    const scheme = await prompt.select({
        message: 'Which multi-party scheme do you want to use?',
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
        initialValue: process.env['BITCORE_CLI_MULTIPARTY_SCHEME'] || 'multisig',
    });
    if (prompt.isCancel(scheme)) {
        throw new errors_1.UserCancelled();
    }
    return scheme;
}
;
async function getCopayerName() {
    const defaultVal = process.env['BITCORE_CLI_COPAYER_NAME'] || process.env.USER;
    const copayerName = await prompt.text({
        message: 'Your name (helps to identify you):',
        placeholder: `Default: ${defaultVal}`,
        defaultValue: defaultVal,
    });
    if (prompt.isCancel(copayerName)) {
        throw new errors_1.UserCancelled();
    }
    return copayerName;
}
;
async function getAddressType({ chain, network, isMultiSig }) {
    let addressTypes = constants_1.Constants.ADDRESS_TYPE[chain.toUpperCase()];
    if (!addressTypes) {
        return constants_1.Constants.ADDRESS_TYPE.default;
    }
    if (isMultiSig) {
        addressTypes = addressTypes.multiSig;
    }
    else {
        addressTypes = addressTypes.singleSig;
    }
    const segwitPrefix = libs[chain]?.Networks.get(network).bech32prefix;
    const descriptions = {
        P2PKH: 'Standard public key address',
        P2SH: 'Standard script address',
        P2WPKH: `Native SegWit address - starts with ${segwitPrefix}1q`,
        P2WSH: `Native SegWit address - starts with ${segwitPrefix}1q`,
        P2TR: `Taproot address - starts with ${segwitPrefix}1p`,
    };
    const addressType = await prompt.select({
        message: 'Address type:',
        options: Object.entries(addressTypes).map(([label, value], i) => ({
            label, value, hint: descriptions[label] + (i === 0 ? '. *Recommended*' : ''),
        })),
        initialValue: process.env['BITCORE_CLI_ADDRESS_TYPE'] || Object.values(addressTypes)[0],
    });
    if (prompt.isCancel(addressType)) {
        throw new errors_1.UserCancelled();
    }
    return addressType;
}
async function getAction({ options, initialValue } = {}) {
    options = [].concat(options || []).concat([
        { label: 'Main Menu', value: 'menu', hint: 'Go to the commands menu' },
        { label: 'Exit', value: 'exit', hint: 'Exit the wallet CLI' },
    ]);
    const action = await prompt.select({
        message: 'Actions:',
        options,
        initialValue: initialValue || 'menu',
    });
    return action;
}
//# sourceMappingURL=prompts.js.map
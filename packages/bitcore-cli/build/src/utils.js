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
exports.Utils = void 0;
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const prompt = __importStar(require("@clack/prompts"));
const bitcore_wallet_client_1 = require("bitcore-wallet-client");
const external_editor_1 = require("external-editor");
const constants_1 = require("./constants");
const errors_1 = require("./errors");
let _verbose = false;
class Utils {
    static setVerbose(v) {
        _verbose = !!v;
    }
    static die(err) {
        if (err) {
            if (err instanceof Error && err.name === 'ExitPromptError') {
                Utils.goodbye();
            }
            else {
                prompt.log.error('!! ' + (_verbose && err.stack ? err.stack : err.toString()));
            }
            process.exit(1);
        }
    }
    static goodbye() {
        const funMessages = [
            'Until next time!',
            'See you later!',
            'Keep calm and HODL on!',
            'Goodbye!',
            'Tata!',
            'Chin-chin!',
            'Cheers!',
            'Adios!',
            'Ciao!',
        ];
        const randomMessage = funMessages[Math.floor(Math.random() * funMessages.length)];
        console.log('👋 ' + randomMessage);
    }
    static getWalletFileName(walletName, dir) {
        return path_1.default.join(dir, walletName + '.json');
    }
    static colorText(text, color) {
        return constants_1.Constants.COLOR[color.toLowerCase()].replace('%s', text);
    }
    static capitalize(text) {
        return text.charAt(0).toUpperCase() + text.slice(1);
    }
    static shortID(id) {
        return id.substring(id.length - 4);
    }
    static confirmationId(copayer) {
        return parseInt(copayer.xPubKeySignature.substring(-4), 16).toString().substring(-4);
    }
    static parseAmount(text) {
        if (typeof text !== 'string') {
            text = text.toString();
        }
        const regex = '^(\\d*(\\.\\d{0,8})?)\\s*(' + Object.keys(constants_1.Constants.UNITS2).join('|') + ')?$';
        const match = new RegExp(regex, 'i').exec(text.trim());
        if (!match || match.length === 0) {
            Utils.die('Invalid amount: ' + text);
        }
        const amount = parseFloat(match[1]);
        if (isNaN(amount)) {
            throw new Error('Invalid amount');
        }
        const unit = (match[3] || 'sat').toLowerCase();
        const rate = constants_1.Constants.UNITS2[unit];
        if (!rate) {
            Utils.die('Invalid unit: ' + unit);
        }
        const amountSat = parseFloat((amount * rate).toPrecision(12));
        if (amountSat != Math.round(amountSat)) {
            Utils.die('Invalid amount: ' + amount + ' ' + unit);
        }
        return amountSat;
    }
    ;
    static renderAmount(currency, satoshis, opts = {}) {
        return bitcore_wallet_client_1.Utils.formatAmount(satoshis, currency.toLowerCase(), { ...opts, fullPrecision: true }) + ' ' + currency.toUpperCase();
    }
    static renderStatus(status) {
        if (status !== 'complete') {
            return Utils.colorText(status, 'yellow');
        }
        return status;
    }
    static parseMN(text) {
        if (!text)
            throw new Error('No m-n parameter');
        const regex = /^(\d+)(-|of|-of-)?(\d+)$/i;
        const match = regex.exec(text.trim());
        if (!match || match.length === 0)
            throw new Error('Invalid m-n parameter');
        const m = parseInt(match[1]);
        const n = parseInt(match[3]);
        if (m > n)
            throw new Error('Invalid m-n parameter');
        return [m, n];
    }
    static async paginate(fn, opts) {
        const { pageSize = 10, exitOn1Page = true, initialPage } = opts || {};
        let page = parseInt(initialPage) || 1;
        let action;
        do {
            const { result, extraChoices = [] } = await fn(page, action);
            if (!result || (page == 1 && exitOn1Page && result.length < pageSize && !extraChoices.length)) {
                return;
            }
            const options = [].concat(page > 1 ? [{ label: 'Previous Page', value: 'p' }] : []).concat(result.length === pageSize ? [{ label: 'Next Page', value: 'n' }] : []).concat(extraChoices).concat([{ label: 'Close', value: 'x' }]);
            action = await prompt.selectKey({
                message: 'Page Controls:',
                options
            });
            if (prompt.isCancel(action)) {
                throw new errors_1.UserCancelled();
            }
            switch (action) {
                case 'n':
                    page++;
                    break;
                case 'p':
                    if (page > 1) {
                        page--;
                    }
                    break;
                case 'x':
                    page = 0;
                    return;
                default:
                    break;
            }
        } while (page > 0);
    }
    static async showMnemonic(walletName, mnemonic, opts) {
        let fileText = '';
        fileText += '!!! IMPORTANT !!!' + os_1.default.EOL;
        fileText += 'MAKE SURE YOU WRITE DOWN YOUR MNEMONIC PHRASE WORDS AND SAVE THEM FOREVER.' + os_1.default.EOL;
        fileText += 'If you lose these words, you will lose access to your wallet.' + os_1.default.EOL;
        fileText += 'DO NOT SHARE THESE WORDS WITH ANYONE! Anyone who has these words will be have full access to any funds in your wallet.' + os_1.default.EOL;
        fileText += 'It is HIGHLY recommended that you do NOT store them online or in any cloud service.' + os_1.default.EOL;
        fileText += 'It is best to write them down on paper and store them in a safe place like a fireproof safe.' + os_1.default.EOL;
        fileText += os_1.default.EOL;
        fileText += 'Your mnemonic phrase is:' + os_1.default.EOL;
        fileText += '----------------------------------------' + os_1.default.EOL;
        fileText += mnemonic + os_1.default.EOL;
        fileText += '----------------------------------------' + os_1.default.EOL;
        const a = await prompt.select({
            message: 'Are you ready to write down your mnemonic phrase?',
            options: [{ label: 'Yes, show it to me', value: true }],
        });
        if (prompt.isCancel(a)) {
            return;
        }
        (0, external_editor_1.edit)(fileText, {
            mode: 0o400,
            dir: opts.dir,
            prefix: `.${walletName}-`,
            postfix: '.tmp'
        });
    }
    static getSegwitInfo(addressType) {
        return {
            useNativeSegwit: ['witnesspubkeyhash', 'witnessscripthash', 'taproot'].includes(addressType),
            segwitVersion: addressType === 'taproot' ? 1 : 0
        };
    }
    static getFeeUnit(chain) {
        switch (chain.toLowerCase()) {
            case 'btc':
            case 'bch':
            case 'doge':
            case 'ltc':
                return 'sat/kB';
            case 'xrp':
                return 'drops';
            case 'sol':
                return 'lamports';
            default:
                return 'gwei';
        }
    }
    static displayFeeRate(chain, feeRate) {
        chain = chain.toLowerCase();
        const feeUnit = Utils.getFeeUnit(chain);
        switch (feeUnit) {
            case 'sat/kB':
                return `${feeRate / 1000} sat/B`;
            case 'gwei':
                return `${feeRate / 1e9} Gwei`;
            case 'drops':
            case 'lamports':
            default:
                `${feeRate} ${feeUnit}`;
        }
    }
    static convertFeeRate(chain, feeRate) {
        const feeRateStr = Utils.displayFeeRate(chain, feeRate);
        return parseFloat(feeRateStr.split(' ')[0]);
    }
    static amountFromSats(chain, sats, opts) {
        if (opts?.decimals) {
            return Number((sats / opts.toSatoshis).toFixed(opts.precision));
        }
        chain = chain.toLowerCase();
        switch (chain) {
            case 'btc':
            case 'bch':
            case 'doge':
            case 'ltc':
            case 'xrp':
                return sats / 1e8;
            case 'sol':
                return sats / 1e9;
            default:
                return sats / 1e18;
        }
    }
    static amountToSats(chain, amount, opts) {
        if (opts) {
            return BigInt(amount * opts.toSatoshis);
        }
        chain = chain.toLowerCase();
        switch (chain) {
            case 'btc':
            case 'bch':
            case 'doge':
            case 'ltc':
            case 'xrp':
                return BigInt(amount * 1e8);
            case 'sol':
                return BigInt(amount * 1e9);
            default:
                return BigInt(amount * 1e18);
        }
    }
    static maxLength(str, maxLength) {
        maxLength = maxLength || 50;
        if (str.length > maxLength) {
            const halfLength = Math.floor((maxLength - 2) / 2);
            return str.substring(0, halfLength) + '...' + str.substring(str.length - halfLength);
        }
        return str;
    }
    static jsonParseWithBuffer(data) {
        return JSON.parse(data, (key, value) => {
            if (value && value.type === 'Buffer') {
                return Buffer.from(value.data);
            }
            return value;
        });
    }
    static compactString(str, length = 19) {
        if (length < 5) {
            throw new Error('Length must be at least 5');
        }
        if (str.length <= length) {
            return str;
        }
        let pieceLen = length - 3;
        pieceLen = pieceLen / 2;
        if (Math.floor(pieceLen) < pieceLen) {
            return str.slice(0, Math.floor(pieceLen)) + '...' + str.slice(-Math.ceil(pieceLen));
        }
        return str.slice(0, pieceLen) + '...' + str.slice(-pieceLen);
    }
    static compactAddress(address) {
        return address.slice(0, 8) + '...' + address.slice(-8);
    }
    static formatDate(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        const formatter = Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            hour12: false,
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short',
        });
        return formatter.format(date).replace(/,/g, '');
    }
    static formatDateCompact(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        const formatter = Intl.DateTimeFormat('en-US', {
            dateStyle: 'short',
            timeStyle: 'short'
        });
        return formatter.format(date).replace(/,/g, '');
    }
    static replaceTilde(fileName) {
        if (fileName.startsWith('~')) {
            return fileName.replace('~', os_1.default.homedir());
        }
        return fileName;
    }
}
exports.Utils = Utils;
;
//# sourceMappingURL=utils.js.map
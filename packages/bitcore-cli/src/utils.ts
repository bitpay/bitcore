import * as prompt from '@clack/prompts';
import { Utils as BWCUtils } from 'bitcore-wallet-client';
import { edit } from 'external-editor';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Constants } from './constants';
import { UserCancelled } from './errors';

let _verbose = false;

export class Utils {

  static setVerbose(v) {
    _verbose = !!v;
  }

  static die(err) {
    if (err) {
      if (err instanceof Error && err.name === 'ExitPromptError') {
        // Inquirer exit prompt error, just log and exit gracefully
        Utils.goodbye();
      } else if (err.code === 'ECONNREFUSED') {
        prompt.log.error('!! Could not connect to Bitcore Wallet Service');
      } else {
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
      'Cheers!',
      'Adios!',
      'Ciao!',
    ];
    const randomMessage = funMessages[Math.floor(Math.random() * funMessages.length)];
    console.log('👋 ' + randomMessage);
  }

  static getWalletFileName(walletName, dir) {
    return path.join(dir, walletName + '.json');
  }

  static colorText(text, color) {
    return Constants.COLOR[color.toLowerCase()].replace('%s', text);
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

    const regex = '^(\\d*(\\.\\d{0,8})?)\\s*(' + Object.keys(Constants.UNITS2).join('|') + ')?$';
    const match = new RegExp(regex, 'i').exec(text.trim());

    if (!match || match.length === 0) {
      Utils.die('Invalid amount: ' + text);
    }

    const amount = parseFloat(match[1]);
    if (isNaN(amount)) {
      throw new Error('Invalid amount');
    }

    const unit = (match[3] || 'sat').toLowerCase();
    const rate = Constants.UNITS2[unit];
    if (!rate) {
      Utils.die('Invalid unit: ' + unit);
    }

    const amountSat = parseFloat((amount * rate).toPrecision(12));
    if (amountSat != Math.round(amountSat)) {
      Utils.die('Invalid amount: ' + amount + ' ' + unit);
    }

    return amountSat;
  };

  static renderAmount(satoshis, coin, opts = {}) {
    if (!satoshis) return '0';
    return BWCUtils.formatAmount(satoshis, coin.toLowerCase(), { ...opts, fullPrecision: true }) + ' ' + coin.toUpperCase();
  }

  static renderStatus(status) {
    if (status !== 'complete') {
      return Utils.colorText(status, 'yellow');
    }
    return status;
  }

  static parseMN(text: string): [number, number] {
    if (!text) throw new Error('No m-n parameter');

    const regex = /^(\d+)(-|of|-of-)?(\d+)$/i;
    const match = regex.exec(text.trim());

    if (!match || match.length === 0) throw new Error('Invalid m-n parameter');

    const m = parseInt(match[1]);
    const n = parseInt(match[3]);
    if (m > n) throw new Error('Invalid m-n parameter');

    return [m, n];
  }

  static async paginate(
    fn: (page: number, action?: string) => Promise<{ result?: any[], extraChoices?: prompt.Option<string>[] }>,
    opts?: {
      pageSize?: number;
      /** Only applies if there are no extraChoices */
      exitOn1Page?: boolean
    }
  ) {
    const { pageSize = 10, exitOn1Page = true } = opts || {};

    let page = 1;
    let action: string | symbol;
    do {
      const { result, extraChoices = [] } = await fn(page, action as string);
      if (!result || (page === 1 && exitOn1Page && result.length < pageSize && !extraChoices.length)) {
        return;
      }


      const options: prompt.Option<string>[] = [].concat(
        page > 1 ? [{ label: 'Previous Page', value: 'p' }] : [],
      ).concat(
        result.length === pageSize ? [{ label: 'Next Page', value: 'n' }] : [],
      ).concat(
        extraChoices,
      ).concat(
        [{ label: 'Close', value: 'x' }]
      );
  
      action = await prompt.selectKey({
        message: 'Page Controls:',
        options
      });
      if (prompt.isCancel(action)) {
        throw new UserCancelled();
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

  static async showMnemonic(
    walletName: string,
    mnemonic: string,
    opts: {
      dir: string;
    }
  ) {
    let fileText = '';
    fileText += '!!! IMPORTANT !!!' + os.EOL;
    fileText += 'MAKE SURE YOU WRITE DOWN THESE 12 WORDS AND SAVE THEM FOREVER' + os;
    fileText += 'If you lose these words, you will lose access to your wallet' + os.EOL;
    fileText += 'DO NOT SHARE THESE WORDS WITH ANYONE' + os.EOL;
    fileText += 'It is HIGHLY recommended that you do NOT store them online or in any cloud service' + os.EOL;
    fileText += os.EOL;
    fileText += 'Your mnemonic phrase is:' + os.EOL;
    fileText += '----------------------------------------' + os.EOL;
    fileText += mnemonic + os.EOL;
    fileText += '----------------------------------------' + os.EOL;
    
    const a = await prompt.select({
      message: 'Are you ready to write down your mnemonic phrase?',
      options: [{ label: 'Yes, show it to me', value: true }],
    });
    if (prompt.isCancel(a)) {
      return;
    }

    edit(
      fileText,
      {
        mode: 0o400, // Owner-only and read-only
        dir: opts.dir,
        prefix: `.${walletName}-`,
        postfix: '.tmp'
      }
    );
  }

  static getSegwitInfo(addressType: string) {
    return {
      useNativeSegwit: ['witnesspubkeyhash', 'witnessscripthash', 'taproot'].includes(addressType),
      segwitVersion: addressType === 'taproot' ? 1 : 0
    };
  }

  static getFeeUnit(chain: string) {
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

  static displayFeeRate(chain: string, feeRate: number) {
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

  static convertFeeRate(chain: string, feeRate: number) {
    const feeRateStr = Utils.displayFeeRate(chain, feeRate);
    return parseFloat(feeRateStr.split(' ')[0]);
  }

  static amountFromSats(chain: string, sats: number) {
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
        // Assume EVM chain
        return sats / 1e18;
    }
  }

  static amountToSats(chain: string, amount: number | string) {
    chain = chain.toLowerCase();
    switch (chain) {
      case 'btc':
      case 'bch':
      case 'doge':
      case 'ltc':
      case 'xrp':
        return BigInt(amount as number * 1e8);
      case 'sol':
        return BigInt(amount as number * 1e9);
      default:
        // Assume EVM chain
        return BigInt(amount as number * 1e18);
    }
  }

  static maxLength(str: string, maxLength?: number) {
    maxLength = maxLength || 50;
    if (str.length > maxLength) {
      const halfLength = Math.floor((maxLength - 2) / 2);
      return str.substring(0, halfLength) + '...' + str.substring(str.length - halfLength);
    }
    return str;
  }

  static jsonParseWithBuffer(data: string) {
    return JSON.parse(data, (key, value) => {
      if (value && value.type === 'Buffer') {
        return Buffer.from(value.data);
      }
      return value;
    });
  }

  static compactString(str: string, length: number = 19) {
    if (length < 5) {
      throw new Error('Length must be at least 5');
    }
    if (str.length <= length) {
      return str;
    }
    let pieceLen = length - 3; // 3 for '...'
    pieceLen = pieceLen / 2;
    if (Math.floor(pieceLen) < pieceLen) {
      // If str cannot be evenly divided, let the extra char be on the right side
      return str.slice(0, Math.floor(pieceLen)) + '...' + str.slice(-Math.ceil(pieceLen));
    }
    return str.slice(0, pieceLen) + '...' + str.slice(-pieceLen);
  }

  static compactAddress(address: string) {
    return address.slice(0, 8) + '...' + address.slice(-8);
  }
};

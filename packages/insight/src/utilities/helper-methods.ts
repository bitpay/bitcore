import {
  API_ROOT,
  API_ROOT_ETH,
  COIN,
  DEFAULT_RBF_SEQ_NUMBER,
  ETH_DEFAULT_REFRESH_INTERVAL,
  UTXO_DEFAULT_REFRESH_INTERVAL,
} from './constants';
import {BlockTransactionDetails} from './models';

export const buildTime = (time: string): string => {
  const diffMs = Math.abs(Date.now() - Date.parse(time));
  const minutes = Math.floor(diffMs / 1000 / 60);

  if (minutes === 0) {
    return 'a few seconds';
  }

  if (minutes < 2) {
    return 'a minute';
  }

  return minutes + ' minutes';
};

export const getApiRoot = (currency: string): string =>
  ['ETH'].includes(currency) ? API_ROOT_ETH : API_ROOT;
export const getDefaultRefreshInterval = (currency: string): number =>
  ['ETH'].includes(currency) ? ETH_DEFAULT_REFRESH_INTERVAL : UTXO_DEFAULT_REFRESH_INTERVAL;
export const urlSafetyCheck = (url: string) => (url.includes('undefined') ? null : url);

export const aggregateItems = (items: any[]): any[] => {
  if (!items) {
    return [];
  }

  const l: number = items.length;

  const ret: any[] = [];
  const tmp: any = {};
  let u = 0;

  for (let i = 0; i < l; i++) {
    let notAddr = false;
    // non standard input
    if (items[i].scriptSig && !items[i].address) {
      items[i].address = 'Unparsed address [' + u++ + ']';
      items[i].notAddr = true;
      notAddr = true;
    }

    // non standard output
    if (items[i].scriptPubKey && !items[i].scriptPubKey.addresses) {
      items[i].scriptPubKey.addresses = ['Unparsed address [' + u++ + ']'];
      items[i].notAddr = true;
      notAddr = true;
    }

    // multiple addr at output
    if (items[i].scriptPubKey && items[i].scriptPubKey.addresses.length > 1) {
      items[i].address = items[i].scriptPubKey.addresses.join(',');
      ret.push(items[i]);
      continue;
    }

    const address: string =
      items[i].address || (items[i].scriptPubKey && items[i].scriptPubKey.addresses[0]);

    if (!tmp[address]) {
      tmp[address] = {};
      tmp[address].valueSat = 0;
      tmp[address].count = 0;
      tmp[address].address = address;
      tmp[address].items = [];
    }
    tmp[address].isSpent = items[i].spentTxId;

    items[i].uiConfirmations = items[i].spentHeight - items[i].mintHeight;

    tmp[address].doubleSpentTxID = tmp[address].doubleSpentTxID || items[i].doubleSpentTxID;
    tmp[address].doubleSpentIndex = tmp[address].doubleSpentIndex || items[i].doubleSpentIndex;
    tmp[address].dbError = tmp[address].dbError || items[i].dbError;
    tmp[address].valueSat += Math.round(items[i].value * COIN);
    tmp[address].items.push(items[i]);
    tmp[address].notAddr = notAddr;

    if (items[i].unconfirmedInput) {
      tmp[address].unconfirmedInput = true;
    }

    tmp[address].count++;
  }

  for (const v of Object.keys(tmp)) {
    const obj: any = tmp[v];
    obj.value = obj.value || parseInt(obj.valueSat, 10) / COIN;
    ret.push(obj);
  }

  return ret;
};

export const getFee = (tx: BlockTransactionDetails): number => {
  const sumSatoshis: any = (arr: any): number =>
    arr.reduce((prev: any, cur: any) => prev + cur.value, 0);
  const inputs: number = sumSatoshis(tx.inputs);
  const outputs: number = sumSatoshis(tx.outputs);
  return tx.isCoinBase ? 0 : inputs - outputs;
};

export const getAddress = (v: any): string => {
  if (v.address === 'false') {
    return 'Unparsed address';
  }

  return v.address;
};

export const isRBF = (inputs: any): boolean => {
  return inputs.some(
    (input: any) => input.sequenceNumber && input.sequenceNumber < DEFAULT_RBF_SEQ_NUMBER - 1,
  );
};

export const hasUnconfirmedInputs = (inputs: any): boolean => {
  return inputs.some((input: any) => input.mintHeight < 0);
};

export const getFormattedDate = (dateStr: string | null) => {
  if (!dateStr) {
    return;
  }

  const date = new Date(dateStr);
  return date.toLocaleString();
};

export const getConvertedValue = (value: any, chain: string): number => {
  switch (chain) {
    case 'ETH':
      value = (value * 1e-18).toFixed(18);
      value = Math.round(value * Math.pow(10, 8)) / Math.pow(10, 8);
      break;
    default:
      value = (value * 1e-8).toFixed(8);
      value = Math.round(value * Math.pow(10, 8)) / Math.pow(10, 8);
      break;
  }

  if (value === 0.0) {
    value = 0;
  }

  return value;
};

export function sleep(duration: number) {
  return new Promise<void>(resolve => window.setTimeout(resolve, duration));
}

export const normalizeParams = (
  currency: string,
  network: string,
): {currency: string; network: string} => {
  return {currency: currency.toUpperCase(), network: network.toLowerCase()};
};

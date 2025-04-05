import { BitPay } from './bitpay';
import { IProvider } from './provider';
// import { Bitstamp } from './bitstamp';


export const providers: IProvider[] = [
  BitPay // the first in the array is the default rate source
];

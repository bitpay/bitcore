import { BTCTxProvider } from '../btc';
export class LtcTxProvider extends BTCTxProvider {
  lib = require('litecore-lib');
}

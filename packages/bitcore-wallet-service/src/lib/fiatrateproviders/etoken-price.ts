import _ from 'lodash';
import { EtokenSupportPrice } from '../model/config-model';

module.exports = {
  name: 'EtokenPrice',
  getRate(coin: string, etokenSupportPrice: EtokenSupportPrice[]) {
    let rate = 0;
    const token = _.find(etokenSupportPrice, item => item.coin == coin);
    if (token) rate = token.rate;
    return [{ code: 'USD', value: rate }];
  }
};

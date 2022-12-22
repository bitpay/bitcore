import _ from 'lodash';
import { FiatRateService } from '../fiatrateservice';
import { EtokenSupportPrice } from '../model/config-model';
module.exports = {
  name: 'EtokenPrice',
  async getRate(coin: string, etokenSupportPrice: EtokenSupportPrice[], rateHnl?) {
    if (coin.toLowerCase() === 'elps' && rateHnl && rateHnl.value) {
      return [{ code: 'USD', value: 1 / rateHnl.value }];
    }

    let rate = 0;
    const token = _.find(etokenSupportPrice, item => item.coin == coin);
    if (token) rate = token.rate;
    return [{ code: 'USD', value: rate }];
  }
};

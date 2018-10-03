import { LoggerConfig, NgxLoggerLevel } from 'ngx-logger';
import { Chain } from '../app/types/configuration';

const loggingSettings: LoggerConfig = {
  serverLoggingUrl: '/api/logs/insight',
  level: NgxLoggerLevel.DEBUG,
  serverLogLevel: NgxLoggerLevel.ERROR
};

const initialNetwork: Chain = {
  ticker: 'BCH',
  network: 'mainnet'
};

const expectedNetworks: Chain[] = [
  initialNetwork,
  {
    ticker: 'BCH',
    network: 'testnet'
  },
  {
    ticker: 'BTC',
    network: 'mainnet'
  },
  {
    ticker: 'BTC',
    network: 'testnet'
  }
];

export const environment = {
  apiPrefix: 'https://api.bitcore.io/api',
  ratesApi: 'https://bitpay.com/api/rates/bch',
  production: true,
  loggingSettings,
  initialNetwork,
  expectedNetworks
};

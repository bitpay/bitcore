import { LoggerConfig, NgxLoggerLevel } from 'ngx-logger';
import { BCH, BTC, Chain, tBCH, tBTC } from '../app/types/chains';

const loggingSettings: LoggerConfig = {
  serverLoggingUrl: '/api/logs/insight',
  level: NgxLoggerLevel.DEBUG,
  serverLogLevel: NgxLoggerLevel.ERROR
};

const initialChain: Chain = BCH;

const expectedChains: Chain[] = [BCH, tBCH, BTC, tBTC];

export const environment = {
  apiPrefix: 'https://api.bitcore.io/api',
  ratesApi: 'https://bitpay.com/api/rates/bch',
  production: true,
  loggingSettings,
  initialDisplayValueCode: initialChain.code,
  initialChain,
  expectedChains
};

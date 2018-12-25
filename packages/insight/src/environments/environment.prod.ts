import { LoggerConfig, NgxLoggerLevel } from 'ngx-logger';
import { XVG, BTC, Chain, tXVG, tBTC } from '../app/types/chains';

const loggingSettings: LoggerConfig = {
  serverLoggingUrl: '/api/logs/insight',
  level: NgxLoggerLevel.DEBUG,
  serverLogLevel: NgxLoggerLevel.ERROR
};

const initialChain: Chain = XVG;

const expectedChains: Chain[] = [XVG, tXVG, BTC, tBTC];

export const environment = {
  apiPrefix: 'https://api.bitcore.io/api',
  ratesApi: 'https://bitpay.com/api/rates/XVG',
  production: true,
  loggingSettings,
  initialDisplayValueCode: initialChain.code,
  initialChain,
  expectedChains
};

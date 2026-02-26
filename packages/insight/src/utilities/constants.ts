export const SUPPORTED_CURRENCIES = ['BTC', 'BCH', 'ETH', 'DOGE', 'LTC'];
export const API_ROOT = 'https://api.bitcore.io/api';
export const API_ROOT_ETH = 'https://api-eth.bitcore.io/api';
export const ETH_DEFAULT_REFRESH_INTERVAL = 300000;
export const UTXO_DEFAULT_REFRESH_INTERVAL = 600000;
export const COIN = 100000000;
export const DEFAULT_RBF_SEQ_NUMBER = 0xffffffff;

export const colorCodes: any = {
  BTC: '#F7931A',
  BCH: '#2FCF6E',
  ETH: '#6B71D6',
  LTC: '#868686',
  DOGE: '#B29832',
};

// Media breakpoints
export const size = {
  mobileS: '320px',
  mobileM: '375px',
  mobileL: '425px',
  tablet: '768px',
  laptop: '1024px',
  laptopL: '1440px',
  desktop: '2560px',
};

export const device = {
  mobileS: `(min-width: ${size.mobileS})`,
  mobileM: `(min-width: ${size.mobileM})`,
  mobileL: `(min-width: ${size.mobileL})`,
  tablet: `(min-width: ${size.tablet})`,
  laptop: `(min-width: ${size.laptop})`,
  laptopL: `(min-width: ${size.laptopL})`,
  desktop: `(min-width: ${size.desktop})`,
  desktopL: `(min-width: ${size.desktop})`,
};

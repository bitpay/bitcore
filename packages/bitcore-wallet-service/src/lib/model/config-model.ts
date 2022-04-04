export interface EtokenSupportPrice {
  coin: string;
  rate: number;
}

export interface Etoken {
  etokenSupportPrice: EtokenSupportPrice[];
}

export interface Config {
  etoken: Etoken;
}

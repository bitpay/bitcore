import { CoinJSON } from './Coin';

export interface AuthheadJSON {
  chain: string;
  network: string;
  authbase: string;
  identityOutputs: CoinJSON[];
}

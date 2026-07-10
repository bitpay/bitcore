import { GetPublicKey, Sign } from './types/methods.js';

export interface Base {
  connect(): void;
  sign(params: Sign): Promise<any>;
  getPublicKey(params: GetPublicKey): Promise<any>;
};

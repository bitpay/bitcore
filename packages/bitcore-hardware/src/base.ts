import { BaseMethod, Sign } from './types/methods.js';

export interface Base {
  connect(): void;
  sign(params: Sign): Promise<any>;
  getPublicKey(params: BaseMethod): Promise<any>;
  getAddress(params: BaseMethod): Promise<any>;
};

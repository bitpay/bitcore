import { BaseParams, SignParams } from './types/paramTypes.js';

export interface Base {
  connect(): void;
  sign(params: SignParams): Promise<any>;
  getPublicKey(params: BaseParams): Promise<any>;
  getAddress(params: BaseParams): Promise<any>;
  getVersion(params?: BaseParams): Promise<any>;
};

export interface BaseModule {
  sign(params: any): Promise<string>;
  getPublicKey(): Promise<string>;
  getAddress(): Promise<string>;
};
export interface Base {
  connect(): Promise<any>;
  disconnect(): Promise<any>;
  sign(params: any): Promise<string>;
  getPublicKey(params: any): Promise<string>;
  getAddress(params: any): Promise<string>;
};

export interface Address {
  address: string;
  path: string;
  type?: string;
  isChange?: boolean;
  publicKeys?: Array<string>;
};
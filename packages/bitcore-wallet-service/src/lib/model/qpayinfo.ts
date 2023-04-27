import { MerchantInfo } from './merchantinfo';
import { RaipayFee } from './raipayfee';

export interface IQPayInfo {
  merchantList: MerchantInfo[];
  raipayFeeList: RaipayFee[];
  streets: string[];
  unit: number;
}

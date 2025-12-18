import { BtcRpc } from '../btc/BtcRpc.js';

export class BchRpc extends BtcRpc {
  async estimateFee() {
    const feeRate = await this.asyncCall('estimateFee', []);
    const satoshisPerKb = Math.round(feeRate * 1e8);
    const satoshisPerByte = satoshisPerKb / 1e3;
    return satoshisPerByte;
  }
}
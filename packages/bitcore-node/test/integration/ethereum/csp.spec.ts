import { EthTransactionStorage } from '../../../src/modules/ethereum/models/transaction';
import { expect } from 'chai';
describe('Ethereum API', function() {
  it('should return undefined for garbage data', () => {
    const data = 'garbage';
    const decoded = EthTransactionStorage.abiDecode(data);
    expect(decoded).to.be.undefined;
  });
  it('should be able to classify ERC20 data', () => {
    const data =
      '0x095ea7b300000000000000000000000052de8d3febd3a06d3c627f59d56e6892b80dcf1200000000000000000000000000000000000000000000000000000000000f4240';
    EthTransactionStorage.abiDecode(data);
    const decoded = EthTransactionStorage.abiDecode(data);
    expect(decoded).to.exist;
    expect(decoded.type).to.eq('ERC20');
  });
  it('should be able to classify ERC721 data', () => {
    const data =
      '0xa22cb465000000000000000000000000efc70a1b18c432bdc64b596838b4d138f6bc6cad0000000000000000000000000000000000000000000000000000000000000001';
    const decoded = EthTransactionStorage.abiDecode(data);
    expect(decoded).to.exist;
    expect(decoded.type).to.eq('ERC721');
  });
  it('should be able to classify Invoice data', () => {
    const data =
      '0xb6b4af0500000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000033ec500800000000000000000000000000000000000000000000000000000016e00f7b3d3c72c929edaf203cfabf7a0513cb8cee277a84ec3fd56bcf3f396b6d665c8abe6c4432f916bacafc94982b45050513de2ee5544aa855d9b5b60e8c1c94e71ffca000000000000000000000000000000000000000000000000000000000000001cfd9150848849c7aff74939535afe5e56dcac5f2f553467ae0e9181d14c0e49c9799433220e288e282376b86aae1bc1d683af4708b38999d59b5d65ff29a85705000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    const decoded = EthTransactionStorage.abiDecode(data);
    expect(decoded).to.exist;
    expect(decoded.type).to.eq('INVOICE');
  });

  it('should handle multiple decodes', () => {
    const data =
      '0x095ea7b300000000000000000000000052de8d3febd3a06d3c627f59d56e6892b80dcf1200000000000000000000000000000000000000000000000000000000000f4240';
    EthTransactionStorage.abiDecode(data);
    const decoded = EthTransactionStorage.abiDecode(data);
    expect(decoded).to.exist;
    expect(decoded.type).to.eq('ERC20');
    const data2 =
      '0xa22cb465000000000000000000000000efc70a1b18c432bdc64b596838b4d138f6bc6cad0000000000000000000000000000000000000000000000000000000000000001';
    EthTransactionStorage.abiDecode(data);
    const decoded2 = EthTransactionStorage.abiDecode(data2);
    expect(decoded2).to.exist;
    expect(decoded2.type).to.eq('ERC721');
  });

  it('should not crash when called with almost correct data', () => {
    const data =
      '0xa9059cbb0000000000000000000000000797350000000000000000000000000000000000000000000005150ac4c39a6f3f0000';
    const decoded = EthTransactionStorage.abiDecode(data);
    expect(decoded).to.be.undefined;
  });
});

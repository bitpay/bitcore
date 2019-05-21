var Mnemonic = require('../../bitcore-mnemonic');
import { Deriver, Transactions } from '../src';

describe('Address Derivation', () => {
  test('should be able to generate a valid ETH address', () => {
    const words =
      'select scout crash enforce riot rival spring whale hollow radar rule sentence';

    const mnemonic = new Mnemonic(words);
    const xPriv = mnemonic.toHDPrivateKey();
    const path = Deriver.pathFor('ETH', 'mainnet');
    expect(path).toEqual(`m/44'/60'/0'`);

    const xPub = xPriv.derive(path).xpubkey;
    const address = Deriver.deriveAddress('ETH', 'mainnet', xPub, 0, false);
    const expectedAddress = '0x9dbfE221A6EEa27a0e2f52961B339e95426931F9';
    expect(address).toEqual(expectedAddress);
  });
});

describe('Transaction Creation', () => {
  test('should be able to create an ETH tx', async () => {
    const rawEthTx = {
      value: 3896000000000000,
      to: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A',
      data:
        '0xb6b4af05000000000000000000000000000000000000000000000000000dd764300b800000000000000000000000000000000000000000000000000000000004a817c8000000000000000000000000000000000000000000000000000000016ada606a26050bb49a5a8228599e0dd48c1368abd36f4f14d2b74a015b2d168dbcab0773ce399393220df874bb22ca961f351e038acd2ba5cc8c764385c9f23707622cc435000000000000000000000000000000000000000000000000000000000000001c7e247d684a635813267b10a63f7f3ba88b28ca2790c909110b28236cf1b9bba03451e83d5834189f28d4c77802fc76b7c760a42bc8bebf8dd15e6ead146805630000000000000000000000000000000000000000000000000000000000000000',
      gasPrice: 20000000000
    };
    const { value, to, data, gasPrice } = rawEthTx;
    const recipients = [{ address: to, amount: value }];
    const cryptoTx = await Transactions.create({
      chain: 'ETH',
      recipients,
      fee: gasPrice,
      nonce: 0,
      data
    });
    const expectedTx =
      'f90151808504a817c8008261a89437d7b3bbd88efde6a93cf74d2f5b0385d3e3b08a870dd764300b8000b90124b6b4af05000000000000000000000000000000000000000000000000000dd764300b800000000000000000000000000000000000000000000000000000000004a817c8000000000000000000000000000000000000000000000000000000016ada606a26050bb49a5a8228599e0dd48c1368abd36f4f14d2b74a015b2d168dbcab0773ce399393220df874bb22ca961f351e038acd2ba5cc8c764385c9f23707622cc435000000000000000000000000000000000000000000000000000000000000001c7e247d684a635813267b10a63f7f3ba88b28ca2790c909110b28236cf1b9bba03451e83d5834189f28d4c77802fc76b7c760a42bc8bebf8dd15e6ead1468056300000000000000000000000000000000000000000000000000000000000000001c8080';
    expect(cryptoTx).toEqual(expectedTx);
  });
});

import { expect } from 'chai';
import { Validation } from '../src';

describe('Address Validation', () => {
  const btcAddress = '1NuKwkDtCymgA1FNLUBaUWLD8s4kdKWvgn';
  const bchAddress = 'qr8uujscckc56ancdkmqnyyl2rx6pnp24gmdfrf8qd';
  const ethAddress = '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A';

  const btcUri = 'bitcoin:1NuKwkDtCymgA1FNLUBaUWLD8s4kdKWvgn';
  const bchUri = 'bitcoincash:qr8uujscckc56ancdkmqnyyl2rx6pnp24gmdfrf8qd';

  const invalidBtcAddress = '1NuKwkDtCymgA1FNLUBaUWLD8s4kKWvgn';
  const invalidBchAddress = 'r8uujscckc56ancdkmqnyyl2rx6pnp24gmdfrf8qd';
  const invalidEthAddress = '37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A';

  it('should be able to validate an BTC address', async () => {
    const isValidAddress = await Validation.validateAddress('BTC', 'mainnet', btcAddress);
    expect(isValidAddress).to.equal(true);
  });

  it('should be able to validate an BCH address', async () => {
    const isValidAddress = await Validation.validateAddress('BCH', 'mainnet', bchAddress);
    expect(isValidAddress).to.equal(true);
  });

  it('should be able to validate an ETH address', async () => {
    const isValidAddress = await Validation.validateAddress('ETH', 'mainnet', ethAddress);
    expect(isValidAddress).to.equal(true);
  });

  it('should be able to validate an BTC Uri', async () => {
    const isValidUri = await Validation.validateAddress('BTC', 'mainnet', btcUri);
    expect(isValidUri).to.equal(true);
  });

  it('should be able to validate an BCH Uri', async () => {
    const isValidUri = await Validation.validateAddress('BCH', 'mainnet', bchUri);
    expect(isValidUri).to.equal(true);
  });

  it('should be able to invalidate an incorrect BTC address', async () => {
    const inValidAddress = await Validation.validateAddress('BTC', 'mainnet', invalidBtcAddress);
    expect(inValidAddress).to.equal(true);
  });

  it('should be able to invalidate an incorrect BCH address', async () => {
    const inValidAddress = await Validation.validateAddress('BCH', 'mainnet', invalidBchAddress);
    expect(inValidAddress).to.equal(true);
  });

  it('should be able to invalidate an incorrect ETH address', async () => {
    const inValidAddress = await Validation.validateAddress('ETH', 'mainnet', invalidEthAddress);
    expect(inValidAddress).to.equal(true);
  });
});

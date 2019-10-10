
import { expect } from 'chai';
import { Validation } from '../src';

describe('Address Validation', () => {
  // BTC
  const btcAddress = '1NuKwkDtCymgA1FNLUBaUWLD8s4kdKWvgn';
  const btcTestAddress = 'mkUNMewkQsHKRcUvv5HLKbqmepCqNH8goc';

  // BCH
  const bchAddress = 'qr8uujscckc56ancdkmqnyyl2rx6pnp24gmdfrf8qd';
  const bchTestLegacyAddress = 'mms6yCDGo3fDdapguTSMtCyF9XGfWJpD6H';

  // ETH
  const ethAddress = '37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A';
  const prefixEthAddress = '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A';

  // Uri
  const btcUri = 'bitcoin:1NuKwkDtCymgA1FNLUBaUWLD8s4kdKWvgn';
  const bchUri = 'bitcoincash:pp8skudq3x5hzw8ew7vzsw8tn4k8wxsqsv0lt0mf3g';
  const ethUri = 'ethereum:0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A';
  const ethUriParams = 'ethereum:0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A?value=123&gasPrice=123&gas=123&gasLimit=123'
  const btcTestUri = 'bitcoin:mkUNMewkQsHKRcUvv5HLKbqmepCqNH8goc';
  const bchTestUri = 'bchtest:qq083kgf3wjg7ya8nun36e8nf24g9xgvachahfnyle';

  // Invalid
  const invalidBtcAddress = '1NuKwkDtCymgA1FNLUBaUWLD8s4kKWvgn';
  const invalidBchAddress = 'r8uujscckc56ancdkmqnyyl2rx6pnp24gmdfrf8qd';
  const invalidEthAddress = '37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08';

  it('should be able to validate an BTC address', async () => {
    const isValidAddress = await Validation.validateAddress('BTC', 'mainnet', btcAddress);
    const isValidTestAddress = await Validation.validateAddress('BTC', 'testnet', btcTestAddress);
    expect(isValidAddress).to.equal(true);
    expect(isValidTestAddress).to.equal(true);
  });

  it('should be able to validate an BCH address', async () => {
    const isValidAddress = await Validation.validateAddress('BCH', 'mainnet', bchAddress);
    const isValidTestLegacyAddress = await Validation.validateAddress('BCH', 'testnet', bchTestLegacyAddress);
    expect(isValidAddress).to.equal(true);
    expect(isValidTestLegacyAddress).to.equal(true);
  });

  it('should be able to validate an ETH address', async () => {
    const isValidAddress = await Validation.validateAddress('ETH', 'mainnet', ethAddress);
    const isValidPrefixAddress = await Validation.validateAddress('ETH', 'mainnet', prefixEthAddress);
    expect(isValidAddress).to.equal(true);
    expect(isValidPrefixAddress).to.equal(true);
  });

  it('should be able to validate an BTC Uri', async () => {
    const isValidUri = await Validation.validateUri('BTC', btcUri);
    const isValidTestUri = await Validation.validateUri('BTC', btcTestUri);
    expect(isValidUri).to.equal(true);
    expect(isValidTestUri).to.equal(true);
  });

  it('should be able to validate an BCH Uri', async () => {
    const isValidUri = await Validation.validateUri('BCH', bchUri);
    const isValidTestUri = await Validation.validateUri('BCH', bchTestUri);
    expect(isValidUri).to.equal(true);
    expect(isValidTestUri).to.equal(true);
  });

  it('should be able to validate an ETH Uri', async () => {
    const isValidUri = await Validation.validateUri('ETH', ethUri);
    const isValidUriParams = await Validation.validateUri('ETH', ethUriParams);
    expect(isValidUri).to.equal(true);
    expect(isValidUriParams).to.equal(true);
  });

  it('should be able to invalidate an incorrect BTC address', async () => {
    const inValidAddress = await Validation.validateAddress('BTC', 'mainnet', invalidBtcAddress);
    expect(inValidAddress).to.equal(false);
  });

  it('should be able to invalidate an incorrect BCH address', async () => {
    const inValidAddress = await Validation.validateAddress('BCH', 'mainnet', invalidBchAddress);
    expect(inValidAddress).to.equal(false);
  });

  it('should be able to invalidate an incorrect ETH address', async () => {
    const inValidAddress = await Validation.validateAddress('ETH', 'mainnet', invalidEthAddress);
    expect(inValidAddress).to.equal(false);
  });
});

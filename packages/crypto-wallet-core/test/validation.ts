
import { expect } from 'chai';
import { Validation } from '../src';

describe('Address Validation', () => {
  // BTC
  const btcAddress = '1NuKwkDtCymgA1FNLUBaUWLD8s4kdKWvgn';
  const btcTestAddress = 'mkUNMewkQsHKRcUvv5HLKbqmepCqNH8goc';

  // BCH
  const bchAddress = 'qr8uujscckc56ancdkmqnyyl2rx6pnp24gmdfrf8qd';
  const bchTestLegacyAddress = 'mms6yCDGo3fDdapguTSMtCyF9XGfWJpD6H';

  // DOGE
  const dogeAddress = 'DQnSpKaUdXYZz8Q4WUBCdaGBSthiAJbWBr';
  const dogeTestAddress = 'nY525SPsHXVopmUMm1JyReDEop45MSWc3D';

  // LTC
  const ltcAddress = 'LYgDcZ3oW3aZBhZUyiC84fb99hyUPVxLwB';
  const ltcTestAddress = 'QhpBFbYvLG2bgCZ3D1ztGEUVqmcgY5vjVF';

  // ETH
  const ethAddress = '37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A';
  const prefixEthAddress = '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A';

  // XRP
  const xrpAddress = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh';

  // Uri
  const btcUri = 'bitcoin:1NuKwkDtCymgA1FNLUBaUWLD8s4kdKWvgn';
  const bchUri = 'bitcoincash:pp8skudq3x5hzw8ew7vzsw8tn4k8wxsqsv0lt0mf3g';
  const dogeUri = 'dogecoin:DQnSpKaUdXYZz8Q4WUBCdaGBSthiAJbWBr';
  const ltcUri = 'litecoin:LYgDcZ3oW3aZBhZUyiC84fb99hyUPVxLwB';
  const ethUri = 'ethereum:0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A';
  const ethUriParams = 'ethereum:0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A?value=123&gasPrice=123&gas=123&gasLimit=123';
  const ethUriSingleParam = 'ethereum:0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A?value=123';
  const btcTestUri = 'bitcoin:mkUNMewkQsHKRcUvv5HLKbqmepCqNH8goc';
  const bchTestUri = 'bchtest:qq083kgf3wjg7ya8nun36e8nf24g9xgvachahfnyle';
  const dogeTestUri = 'dogecoin:mpz836YMHb7Ubjx4G2YnutwQRd1yz5ssNv';
  const ltcTestUri = 'litecoin:QhpBFbYvLG2bgCZ3D1ztGEUVqmcgY5vjVF';
  const xrpUri = 'ripple:rEqj9WKSH7wEkPvWf6b4gCi26Y3F7HbKUF';
  const xrpUriParams = 'ripple:rEqj9WKSH7wEkPvWf6b4gCi26Y3F7HbKUF?amount=123456&dt=123456';
  const xrpUriSingleParam = 'ripple:rEqj9WKSH7wEkPvWf6b4gCi26Y3F7HbKUF?amount=123456';

  // Invalid Address
  const invalidBtcAddress = '1NuKwkDtCymgA1FNLUBaUWLD8s4kKWvgn';
  const invalidBchAddress = 'r8uujscckc56ancdkmqnyyl2rx6pnp24gmdfrf8qd';
  const invalidDogeAddress = 'DQnSpKaUdXYZz8Q4WUBCdaGBSthiAJbWB';
  const invalidLtcAddress = 'LYgDcZ3oW3aZBhZUyiC84fb99hyUPVxLw';
  const invalidEthAddress = '37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08';
  const invalidXrpAddress = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTH';

  // Invalid Uri
  const invalidEthPrefix = '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A';
  const invalidXrpPrefix = 'rEqj9WKSH7wEkPvWf6b4gCi26Y3F7HbKUF';
  const invalidEthUriParams = 'ethereum:0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A?value=invalid&gasLimit=123&gas=123';
  const invalidXrpUriParams = 'ripple:rEqj9WKSH7wEkPvWf6b4gCi26Y3F7HbKUF?amount=invalid&dt=123';

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

  it('should be able to validate an DOGE address', async () => {
    const isValidAddress = await Validation.validateAddress('DOGE', 'mainnet', dogeAddress);
    const isValidTestAddress = await Validation.validateAddress('DOGE', 'testnet', dogeTestAddress);
    expect(isValidAddress).to.equal(true);
    expect(isValidTestAddress).to.equal(true);
  });

  it('should be able to validate an LTC address', async () => {
    const isValidAddress = await Validation.validateAddress('LTC', 'mainnet', ltcAddress);
    const isValidTestAddress = await Validation.validateAddress('LTC', 'testnet', ltcTestAddress);
    expect(isValidAddress).to.equal(true);
    expect(isValidTestAddress).to.equal(true);
  });

  it('should be able to validate an ETH address', async () => {
    const isValidAddress = await Validation.validateAddress('ETH', 'mainnet', ethAddress);
    const isValidPrefixAddress = await Validation.validateAddress('ETH', 'mainnet', prefixEthAddress);
    expect(isValidAddress).to.equal(true);
    expect(isValidPrefixAddress).to.equal(true);
  });

  it('should be able to validate an XRP address', async () => {
    const isValidAddress = await Validation.validateAddress('XRP', 'mainnet', xrpAddress);
    expect(isValidAddress).to.equal(true);
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

  it('should be able to validate an DOGE Uri', async () => {
    const isValidUri = await Validation.validateUri('DOGE', dogeUri);
    const isValidTestUri = await Validation.validateUri('DOGE', dogeTestUri);
    expect(isValidUri).to.equal(true);
    expect(isValidTestUri).to.equal(true);
  });

  it('should be able to validate an LTC Uri', async () => {
    const isValidUri = await Validation.validateUri('LTC', ltcUri);
    const isValidTestUri = await Validation.validateUri('LTC', ltcTestUri);
    expect(isValidUri).to.equal(true);
    expect(isValidTestUri).to.equal(true);
  });

  it('should be able to validate an ETH Uri', async () => {
    const isValidUri = await Validation.validateUri('ETH', ethUri);
    const isValidUriParams = await Validation.validateUri('ETH', ethUriParams);
    const isValidUriSingleParam = await Validation.validateUri('ETH', ethUriSingleParam);
    expect(isValidUri).to.equal(true);
    expect(isValidUriParams).to.equal(true);
    expect(isValidUriSingleParam).to.equal(true);
  });

  it('should be able to validate an XRP Uri', async () => {
    const isValidUri = await Validation.validateUri('XRP', xrpUri);
    const isValidUriParams = await Validation.validateUri('XRP', xrpUriParams);
    const isValidUriSingleParam = await Validation.validateUri('XRP', xrpUriSingleParam);
    expect(isValidUri).to.equal(true);
    expect(isValidUriParams).to.equal(true);
    expect(isValidUriSingleParam).to.equal(true);
  });

  it('should be able to invalidate an incorrect BTC address', async () => {
    const inValidAddress = await Validation.validateAddress('BTC', 'mainnet', invalidBtcAddress);
    expect(inValidAddress).to.equal(false);
  });

  it('should be able to invalidate an incorrect BCH address', async () => {
    const inValidAddress = await Validation.validateAddress('BCH', 'mainnet', invalidBchAddress);
    expect(inValidAddress).to.equal(false);
  });

  it('should be able to invalidate an incorrect DOGE address', async () => {
    const inValidAddress = await Validation.validateAddress('DOGE', 'mainnet', invalidDogeAddress);
    expect(inValidAddress).to.equal(false);
  });

  it('should be able to invalidate an incorrect LTC address', async () => {
    const inValidAddress = await Validation.validateAddress('LTC', 'mainnet', invalidLtcAddress);
    expect(inValidAddress).to.equal(false);
  });

  it('should be able to invalidate an incorrect ETH address', async () => {
    const inValidAddress = await Validation.validateAddress('ETH', 'mainnet', invalidEthAddress);
    expect(inValidAddress).to.equal(false);
  });

  it('should be able to invalidate an incorrect XRP address', async () => {
    const inValidAddress = await Validation.validateAddress('XRP', 'mainnet', invalidXrpAddress);
    expect(inValidAddress).to.equal(false);
  });

  it('should be able to invalidate incorrect ETH Uri params', async () => {
    const inValidEthUri = await Validation.validateUri('ETH', invalidEthUriParams);
    expect(inValidEthUri).to.equal(false);
  });

  it('should be able to invalidate ETH URI without ethereum prefix', async () => {
    const inValidEthPrefix = await Validation.validateUri('ETH', invalidEthPrefix);
    expect(inValidEthPrefix).to.equal(false);
  });

  it('should be able to invalidate incorrect XRP Uri params', async () => {
    const inValidXrpUri = await Validation.validateUri('XRP', invalidXrpUriParams);
    expect(inValidXrpUri).to.equal(false);
  });

  it('should be able to invalidate XRP URI without ripple prefix', async () => {
    const inValidXrpPrefix = await Validation.validateUri('XRP', invalidXrpPrefix);
    expect(inValidXrpPrefix).to.equal(false);
  });
});

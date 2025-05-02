import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'assert';
import { ObjectId } from 'bson';
import sinon from 'sinon';
import { Readable } from 'stream';
import Web3 from 'web3';
import { CoinStorage } from '../../../src/models/coin';
import { MintOp, SpendOp, TaggedBitcoinTx, TransactionStorage, TxOp } from '../../../src/models/transaction';
import { EVMTransactionStorage } from '../../../src/providers/chain-state/evm/models/transaction';
import { WalletAddressStorage } from '../../../src/models/walletAddress';
import { BitcoinTransaction, TransactionInput } from '../../../src/types/namespaces/Bitcoin';
import { TransactionFixture } from '../../fixtures/transaction.fixture';
import { mockStorage } from '../../helpers';
import { unitAfterHelper, unitBeforeHelper } from '../../helpers/unit';
import * as EvmTxData from '../../data/ETH/gethTxs';
const bitcoreLib = require('bitcore-lib');

describe('Transaction Model', { timeout: 500000 }, function() {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  const sandbox = sinon.createSandbox();
  const address = 'mjVf6sFjt9q6aLY7M21Ap6CPSWdaoNHSf1';

  before(() => {
    mockStorage([]);
  });
  afterEach(() => {
    sandbox.restore();
  });

  it('should stream all the mint operations', async () => {
    const tx = bitcoreLib.Transaction(TransactionFixture.transaction) as BitcoinTransaction;
    let batches = 0;

    const mintStream = new Readable({ objectMode: true, read: () => {} });
    const done = new Promise(r =>
      mintStream
        .on('data', (mintOps: MintOp[]) => {
          batches++;
          const ops = mintOps;
          assert.strictEqual(ops.length, 1);
          assert.strictEqual(ops[0].updateOne.update.$set.address, address);
        })
        .on('end', r)
    );

    await TransactionStorage.streamMintOps({
      chain: 'BTC',
      network: 'regtest',
      txs: [tx],
      height: 8534,
      mintStream,
      initialSyncComplete: true
    });
    await done;
    assert.strictEqual(batches, 1);
  });

  it('should batch large amount of transactions', async () => {
    const tx = bitcoreLib.Transaction(TransactionFixture.transaction) as BitcoinTransaction;
    let batches = 0;

    const mintStream = new Readable({ objectMode: true, read: () => {} });
    const done = new Promise(r =>
      mintStream
        .on('data', (mintOps: MintOp[]) => {
          batches++;
          const ops = mintOps;
          assert.strictEqual(ops.length, 50000);
        })
        .on('end', r)
    );

    await TransactionStorage.streamMintOps({
      chain: 'BTC',
      network: 'regtest',
      txs: new Array(100000).fill(tx),
      height: 8534,
      mintStream,
      initialSyncComplete: true
    });
    await done;
    assert.strictEqual(batches, 2);
  });

  it('should stream all the spend operations', async () => {
    const tx = bitcoreLib.Transaction(TransactionFixture.transaction) as BitcoinTransaction;
    let batches = 0;
    const CURRENT_HEIGHT = 8534;

    const spentStream = new Readable({ objectMode: true, read: () => {} });
    const done = new Promise(r =>
      spentStream
        .on('data', (spentOps: SpendOp[]) => {
          batches++;
          const ops = spentOps;
          assert.strictEqual(ops.length, tx.inputs.length);
          assert.strictEqual(ops[0].updateOne.update.$set.spentHeight, CURRENT_HEIGHT);
          assert.strictEqual(ops[0].updateOne.update.$set.spentTxid, tx.hash);
        })
        .on('end', r)
    );

    await TransactionStorage.streamSpendOps({
      chain: 'BTC',
      network: 'regtest',
      txs: [tx],
      height: CURRENT_HEIGHT,
      spentStream
    });
    await done;
    assert.strictEqual(batches, 1);
  });

  describe('Wallet Tagging', async () => {
    const tx = bitcoreLib.Transaction(TransactionFixture.transaction) as TaggedBitcoinTx;
    const CURRENT_HEIGHT = 8534;
    const correctWalletId = new ObjectId('5d93abeba811051da3af9a35');

    it('should tag wallets on the mint ops first', async () => {
      sandbox.stub(WalletAddressStorage, 'collection').get(() => ({
        find: sandbox.stub().returnsThis(),
        project: sandbox.stub().returnsThis(),
        toArray: sandbox.stub().resolves([
          { wallet: correctWalletId, address },
          { wallet: new ObjectId('6d93abeba811051da3af9a35'), address: 'fakeaddress' }
        ])
      }));

      const mintStream = new Readable({ objectMode: true, read: () => {} });
      const done = new Promise(r =>
        mintStream
          .on('data', (mintOps: MintOp[]) => {
            const ops = mintOps;
            assert.strictEqual(ops.length, 1);
            assert.strictEqual(ops[0].updateOne.update.$set.address, address);
          })
          .on('end', r)
      );

      await TransactionStorage.streamMintOps({
        chain: 'BTC',
        network: 'regtest',
        txs: [tx],
        height: 8534,
        mintStream,
        initialSyncComplete: true
      });
      await done;
      assert.notEqual(tx.wallets, null, 'tx.wallets should exist');
      assert.strictEqual(tx.wallets.length, 1);
      assert.strictEqual(tx.wallets[0], correctWalletId);
    });

    it('should tag the transaction ops, and calculate the fee', async () => {
      function getCoinForInput(i: TransactionInput) {
        const input = i.toObject();
        const inputTxid = i.toObject().prevTxId;
        const fixtureInput = TransactionFixture.inputs[inputTxid];
        const inputTx = new bitcoreLib.Transaction(fixtureInput) as BitcoinTransaction;
        const coin = { spentTxid: tx.hash, value: inputTx.outputs[input.outputIndex].satoshis, wallets: [] };
        return coin;
      }

      sandbox.stub(CoinStorage, 'collection').get(() => ({
        find: sandbox.stub().returnsThis(),
        project: sandbox.stub().returnsThis(),
        toArray: sandbox.stub().resolves(tx.inputs.map(getCoinForInput))
      }));

      const txStream = new Readable({ objectMode: true, read: () => {} });
      const done = new Promise(r =>
        txStream
          .on('data', (spentOps: TxOp[]) => {
            const ops = spentOps;
            assert.strictEqual(ops.length, 1);
            assert.strictEqual(ops[0].updateOne.filter.txid, tx.hash);
            assert.strictEqual(ops[0].updateOne.update.$set.fee, 81276);
            assert.strictEqual(ops[0].updateOne.update.$set.inputCount, tx.inputs.length);
            assert.strictEqual(ops[0].updateOne.update.$set.wallets.length, 1);
            assert.strictEqual(ops[0].updateOne.update.$set.wallets[0], correctWalletId);
          })
          .on('end', r)
      );

      await TransactionStorage.streamTxOps({
        chain: 'BTC',
        network: 'regtest',
        txs: [tx],
        height: CURRENT_HEIGHT,
        initialSyncComplete: false,
        txStream
      });
      await done;
    });
  });

  describe('EVM', function() {
    describe('getEffects', function() {
      it('should get effects for simple USDC transaction', async () => {
        const effects = EVMTransactionStorage.getEffects(EvmTxData.SimpleUSDCTransfer);
        assert.deepEqual(effects, [{
          to: '0xa91cFe0DcAd33F36f3c9428D48eCCBD8A71951b4',
          from: '0xEd7FB9067fd0e0B33e84b85c7a400568C010Af3e',
          amount: '5000000',
          type: 'ERC20:transfer',
          contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          callStack: '0'
        }]);
      });

      it('should get effects for USDC MultiSend transaction', async () => {
        const effects = EVMTransactionStorage.getEffects(EvmTxData.MultiSendUSDCTransfer);
        assert.strictEqual(effects.every(e => e.from === '0xF2a14015EaA3F9cC987f2c3b62FC93Eee41aA5d0'), true);
        assert.strictEqual(effects.every(e => e.type === 'ERC20:transfer'), true);
        assert.strictEqual(effects.every(e => e.contractAddress === '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'), true);
        const std = {
          from: '0xF2a14015EaA3F9cC987f2c3b62FC93Eee41aA5d0',
          type: 'ERC20:transfer',
          contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
        };
        let cs = -1;
        let CS = () => `${cs += 4}`;
        assert.deepEqual(effects[0], { ...std, callStack: CS(), to: '0x12FC1169925053Dd4FFF511FA53D3a8A94aE9E80', amount: '148950000' });
        assert.deepEqual(effects[1], { ...std, callStack: CS(), to: '0x7f5C4a4cB0677585934642053c56d81eb605e345', amount: '26290000' });
        assert.deepEqual(effects[2], { ...std, callStack: CS(), to: '0xD487A844F99a5ed1b0207d55A30618927e5F5Cc5', amount: '430450000' });
        assert.deepEqual(effects[3], { ...std, callStack: CS(), to: '0x00B205AD9eF2A9C0A80908F7d8B856f6310f87cf', amount: '1360160000' });
        assert.deepEqual(effects[4], { ...std, callStack: CS(), to: '0xA1ac41013545F34E6A3347A5F4CaCBb19dEEb5C9', amount: '785580000' });
        assert.deepEqual(effects[5], { ...std, callStack: CS(), to: '0x037A66Fa75d9bD6Ebe1BBcf768B9148a9cb7dfe8', amount: '303280000' });
        assert.deepEqual(effects[6], { ...std, callStack: CS(), to: '0x7cE73fc0AE43B4EFAe49eCcB5932F39a5C3382F4', amount: '21470000' });
        assert.deepEqual(effects[7], { ...std, callStack: CS(), to: '0x6601021E1A172B74342528c1E8C38285104ec482', amount: '34120000' });
        assert.deepEqual(effects[8], { ...std, callStack: CS(), to: '0xdc2476486a67c282d6db6bAe772d8a6257Cb77CE', amount: '201610000' });
        assert.deepEqual(effects[9], { ...std, callStack: CS(), to: '0x0fE96923Db221B59a3a8B198C9feeF9144415797', amount: '2219540000' });
        assert.deepEqual(effects[10], { ...std, callStack: CS(), to: '0x55df2820db97937E54858075F63cFEB97a949101', amount: '110440000' });
        assert.deepEqual(effects[11], { ...std, callStack: CS(), to: '0xA58cf92588DDF0D48B13F52AaCd5283Dfa361941', amount: '71120000' });
        assert.deepEqual(effects[12], { ...std, callStack: CS(), to: '0xA3a23dEa6A711d8a1B8c2735AFa8894Df3c2762E', amount: '542100000' });
        assert.deepEqual(effects[13], { ...std, callStack: CS(), to: '0x01c846Da9B91Fbffc34d50EB94bBcBe4071D8693', amount: '88680000' });
        assert.deepEqual(effects[14], { ...std, callStack: CS(), to: '0xD657b7d9D2Ffe25C5e6a26E35a727ebAa547Cc8a', amount: '104720000' });
        assert.deepEqual(effects[15], { ...std, callStack: CS(), to: '0xA3937112921246890b380B25393D70E0F11dBdD8', amount: '457800000' });
        assert.deepEqual(effects[16], { ...std, callStack: CS(), to: '0x02066F54A767B7Ba08D1f520C450B78095292355', amount: '577000000' });
        assert.deepEqual(effects[17], { ...std, callStack: CS(), to: '0x43368272217643F9A170B4c0A61280E7De4a5d04', amount: '67970000' });
        assert.deepEqual(effects[18], { ...std, callStack: CS(), to: '0x79ffBA57dD5C7fF4d1cCE9Fe2F7Aff328b7E4D49', amount: '49730000' });
        assert.deepEqual(effects[19], { ...std, callStack: CS(), to: '0xF1f9F4092e46EcD96cD7ABdfbc99805dB90160b1', amount: '105580000' });
        assert.deepEqual(effects[20], { ...std, callStack: CS(), to: '0x7a041e4a3B6A64d64072b0A44F6617e30eb4B494', amount: '34380000' });
        assert.deepEqual(effects[21], { ...std, callStack: CS(), to: '0xfAd07BEA38Be2aB4d25bA944Ee29Cf51ab400995', amount: '323330000' });
        assert.deepEqual(effects[22], { ...std, callStack: CS(), to: '0xF4768D004e4C8C6F4C6bEc2eA62BE29405088625', amount: '115960000' });
        assert.deepEqual(effects[23], { ...std, callStack: CS(), to: '0xfAd07BEA38Be2aB4d25bA944Ee29Cf51ab400995', amount: '180050000' });
        assert.deepEqual(effects[24], { ...std, callStack: CS(), to: '0xca75B9eC3F70aed28b2288c9E8a5F3209f1152cA', amount: '563120000' });
        assert.deepEqual(effects[25], { ...std, callStack: CS(), to: '0x612DC5564d31a88fF9C8B997A72927FcE95F7F1b', amount: '40900000' });
        assert.deepEqual(effects[26], { ...std, callStack: CS(), to: '0x37c27FBd22205Db99b9F0F6DD99cE0F492A877b0', amount: '253960000' });
        assert.deepEqual(effects[27], { ...std, callStack: CS(), to: '0x12077bc35937045A22CEA3e9d1c110eF319044F3', amount: '1207910000' });
        assert.deepEqual(effects[28], { ...std, callStack: CS(), to: '0x1E47c1a53D268e71947E7d89e859db24926412aA', amount: '3805310000' });
        assert.deepEqual(effects[29], { ...std, callStack: CS(), to: '0xA1ac41013545F34E6A3347A5F4CaCBb19dEEb5C9', amount: '213360000' });
        assert.deepEqual(effects[30], { ...std, callStack: CS(), to: '0xA1ac41013545F34E6A3347A5F4CaCBb19dEEb5C9', amount: '276890000' });
        assert.deepEqual(effects[31], { ...std, callStack: CS(), to: '0x00343797D04bbc097810b441eFa0132E6C691Df3', amount: '169070000' });
        assert.deepEqual(effects[32], { ...std, callStack: CS(), to: '0x2e7b2fBB2a41310D62a99435acB9e5f7D32D161c', amount: '1399370000' });
        assert.deepEqual(effects[33], { ...std, callStack: CS(), to: '0x7D45Dc79B0433fbFcEcEBa9d529b5bEc2d548304', amount: '65820000' });
        assert.deepEqual(effects[34], { ...std, callStack: CS(), to: '0xFB34ACd73c168c5486497fCBf347E5AA171f5074', amount: '122080000' });
        assert.deepEqual(effects[35], { ...std, callStack: CS(), to: '0x5C49Fa18B3070992DA5667af74b500552Bee46d1', amount: '258070000' });
        assert.deepEqual(effects[36], { ...std, callStack: CS(), to: '0x8B4C94694B5c70224054cCC385bFCdd32435a5B9', amount: '90160000' });
        assert.deepEqual(effects[37], { ...std, callStack: CS(), to: '0xF1e6b6fc264258aBd5dC25BC11577DAd75Ac8DCa', amount: '535870000' });
        assert.deepEqual(effects[38], { ...std, callStack: CS(), to: '0x4E4a23a0D7590f241d19f8B7BC8720Ba7fCF2F30', amount: '4089080000' });
        assert.deepEqual(effects[39], { ...std, callStack: CS(), to: '0x66D6b6642DcA221EB5e3a23f019AAfa6ec42b1E1', amount: '652530000' });
        assert.deepEqual(effects[40], { ...std, callStack: CS(), to: '0xe8e3374615477533809231bc39Bb937cFFC03905', amount: '93560000' });
        assert.deepEqual(effects[41], { ...std, callStack: CS(), to: '0xe8e3374615477533809231bc39Bb937cFFC03905', amount: '37540000' });
        assert.deepEqual(effects[42], { ...std, callStack: CS(), to: '0xe8e3374615477533809231bc39Bb937cFFC03905', amount: '70620000' });
        assert.deepEqual(effects[43], { ...std, callStack: CS(), to: '0x92B103e6De0481F4d440B64B89fEd3Ec13c5671c', amount: '38140000' });
        assert.deepEqual(effects[44], { ...std, callStack: CS(), to: '0x89A15793Bee8DAF4CC6393a1f0F493DCc1A1B7Ac', amount: '30560000' });
        assert.deepEqual(effects[45], { ...std, callStack: CS(), to: '0x96a23D3756e4ed3B6ddF32e1468df5633E7c745b', amount: '96880000' });
        assert.deepEqual(effects[46], { ...std, callStack: CS(), to: '0xC5CCCf469D7302d700dC3d6c674e475D6C79b914', amount: '36300000' });
        assert.deepEqual(effects[47], { ...std, callStack: CS(), to: '0x4C7b13D9Ac43E7a7Eb7B88B74c3c00f44E6c775a', amount: '233070000' });
        assert.deepEqual(effects[48], { ...std, callStack: CS(), to: '0xD4e9820fa6E953CA2f21251c178a1D059Ac71F01', amount: '10932260000' });
        assert.deepEqual(effects[49], { ...std, callStack: CS(), to: '0x0E7974c711231B7328A458f01259b88b8Bc53a85', amount: '100440000' });
        assert.deepEqual(effects[50], { ...std, callStack: CS(), to: '0x81B2da6F44FDdB8E050130d4b0A7226e8D4677b8', amount: '70280000' });
        assert.deepEqual(effects[51], { ...std, callStack: CS(), to: '0xaceaC44c65e3d0c10Eac99D970101AFaA4Ec1bbF', amount: '146200000' });
        assert.deepEqual(effects[52], { ...std, callStack: CS(), to: '0xF30aB1f80d40c4727e3a44246F8b32b93a4ba2cB', amount: '2498280000' });
        assert.deepEqual(effects[53], { ...std, callStack: CS(), to: '0x92358d6FDdC82CE63Db93D978c80605D000D4e17', amount: '83710000' });
        assert.deepEqual(effects[54], { ...std, callStack: CS(), to: '0xcA27a32665178D60060F0351047CA4b2193D8035', amount: '34030000' });
        assert.deepEqual(effects[55], { ...std, callStack: CS(), to: '0xF684a0E459bB83594cCC83722a7083d6223d415e', amount: '22030000' });
        assert.deepEqual(effects[56], { ...std, callStack: CS(), to: '0x5D4e40e41a62df0C5C5D04876d3Ba1969dA31893', amount: '179130000' });
        assert.deepEqual(effects[57], { ...std, callStack: CS(), to: '0xC91e1c4d3482B3396c3e47b18638c23887c80214', amount: '51960000' });
        assert.deepEqual(effects[58], { ...std, callStack: CS(), to: '0x2DfF9339475D7048FDbc683b422a4F5EBbFf264f', amount: '102610000' });
        assert.deepEqual(effects[59], { ...std, callStack: CS(), to: '0xbc1655e5AfacdCa0f5D55f256C11e0C83F2ebb5c', amount: '1103450000' });
        assert.deepEqual(effects[60], { ...std, callStack: CS(), to: '0xF8E8B79C2a5f0E20A738e6aB0A301CB1801b0f4f', amount: '232320000' });
        assert.deepEqual(effects[61], { ...std, callStack: CS(), to: '0xF4768D004e4C8C6F4C6bEc2eA62BE29405088625', amount: '2223130000' });
        assert.deepEqual(effects[62], { ...std, callStack: CS(), to: '0xBF545d0C46b0531A338BE0E02a129feBB696cB9f', amount: '26610000' });
        assert.deepEqual(effects[63], { ...std, callStack: CS(), to: '0xf8E2b058E2a054eB62Cc6026e153cC3FBA8F2668', amount: '731780000' });
        assert.deepEqual(effects[64], { ...std, callStack: CS(), to: '0xCFb08219c75888776242D26F8dA1CaB7181c9A6e', amount: '55460000' });
        assert.deepEqual(effects[65], { ...std, callStack: CS(), to: '0x2a852889cA5629E7B1EfDd199BC41af5124E1DDa', amount: '113230000' });
        assert.deepEqual(effects[66], { ...std, callStack: CS(), to: '0xd4ffB5FCe7A0924904b3802942BB06cfbff35198', amount: '483130000' });
        assert.deepEqual(effects[67], { ...std, callStack: CS(), to: '0xeC7e9329AA7A27E39665AE10D5aCa706d8091A02', amount: '759650000' });
        assert.deepEqual(effects[68], { ...std, callStack: CS(), to: '0x93f3754acd5292A49285D8c12Ee6ad9c4B54ebE7', amount: '32070000' });
        assert.deepEqual(effects[69], { ...std, callStack: CS(), to: '0x26d37ee7dF6F7Db09c362BEd098189fe63Eca24D', amount: '264610000' });
        assert.deepEqual(effects[70], { ...std, callStack: CS(), to: '0xc9dbDA1a749b2dbcf39841F7D08E624915c4d363', amount: '1083750000' });
        assert.deepEqual(effects[71], { ...std, callStack: CS(), to: '0xeE288fB0b55667Ab3453424918782E0ac11fb3fF', amount: '78840000' });
        assert.deepEqual(effects[72], { ...std, callStack: CS(), to: '0x259747f62bdaaFa61b58ECeeF083b69C0f3713dC', amount: '855520000' });
        assert.deepEqual(effects[73], { ...std, callStack: CS(), to: '0xc865fF07aC74DD1ff759e2AAB6697C5873eeB6Ed', amount: '37900000' });
        assert.deepEqual(effects[74], { ...std, callStack: CS(), to: '0x56AD379f25e9f0e9d03070EAE7641A857bf6E5f1', amount: '626200000' });
        assert.deepEqual(effects[75], { ...std, callStack: CS(), to: '0xE9369bF1318f923c131f02Db86C4c7115b3Eb4C7', amount: '345580000' });
        assert.deepEqual(effects[76], { ...std, callStack: CS(), to: '0xc1FA92b3783AEcd3DCBa65F27F4eCc0DBD7bBD5c', amount: '207130000' });
        assert.deepEqual(effects[77], { ...std, callStack: CS(), to: '0x5AcAb5F879246b48Dd8E4caAE29e1AEEC04D7244', amount: '140250000' });
        assert.deepEqual(effects[78], { ...std, callStack: CS(), to: '0x90587B2A3050aaF6A6Bab1f069B7e88a590f8e63', amount: '200420000' });
        assert.deepEqual(effects[79], { ...std, callStack: CS(), to: '0x7e7e76433Ee5694e06Ba85760ac8f8240f13aE33', amount: '40780000' });
      });

      it('should get effects for GUSD MultiSend transaction', async () => {
        const effects = EVMTransactionStorage.getEffects(EvmTxData.MultiSendGUSDTransfer);
        const std = {
          from: '0xF2a14015EaA3F9cC987f2c3b62FC93Eee41aA5d0',
          type: 'ERC20:transfer',
          contractAddress: '0x056Fd409E1d7A124BD7017459dFEa2F387b6d5Cd'
        };
        let cs = -1;
        let CS = () => `${cs += 4}`;
        assert.deepEqual(effects[0], { ...std, callStack: CS(), to: '0x5A00051073A29fbC74869297e21c5449c0360Ecd', amount: '20905' });
        assert.deepEqual(effects[1], { ...std, callStack: CS(), to: '0x898e4e89AD04E51c739542AA434b1B3f67d92171', amount: '29979' });
        assert.strictEqual(effects.length, 2);
      });

      it('should get effects for ETH MultiSend transaction', async () => {
        const effects = EVMTransactionStorage.getEffects(EvmTxData.MultiSendETHTransfer);
        const std = {
          from: '0x8992273ed68bAc36d55f69054140FF4284FAf627' // `from` for native ETH transfers is the contract address
        };
        let cs = -1;
        let CS = () => `${cs += 1}`;
        const toWei = (amt) => Web3.utils.toWei(amt, 'ether').toString();
        assert.deepEqual(effects[0], { ...std, callStack: CS(), to: '0x95Aa45AacD2CDF83f8b3d0576ad92f19482C524a', amount: toWei('0.003203') });
        assert.deepEqual(effects[1], { ...std, callStack: CS(), to: '0x95Aa45AacD2CDF83f8b3d0576ad92f19482C524a', amount: toWei('0.083528') });
        assert.deepEqual(effects[2], { ...std, callStack: CS(), to: '0x7e31e2ae50E975e61b27c9358827dA25ed0800d7', amount: toWei('0.040181') });
        assert.deepEqual(effects[3], { ...std, callStack: CS(), to: '0x0dafEe804c0126163594838C792fed6ca74D3dBA', amount: toWei('0.202188') });
        assert.deepEqual(effects[4], { ...std, callStack: CS(), to: '0xB16Ac3A7Ba785dC72f3E1749372cE3a22F92A73B', amount: toWei('0.113394') });
        assert.deepEqual(effects[5], { ...std, callStack: CS(), to: '0x81b2c8eD9e505d0266c3C208e1ccdd0112fC1a95', amount: toWei('0.06399399999999999') });
      });

      it('should get effects for Uniswap V3 swap to recipient transaction', async () => {
        const effects = EVMTransactionStorage.getEffects(EvmTxData.UniswapV3SwapToRecipient);
        assert.deepEqual(effects[0], {
          amount: '55703397024801814688362904',
          callStack: '0_0',
          contractAddress: '0xA882606494D86804B5514E07e6Bd2D6a6eE6d68A',
          from: '0x8cD6C8c449918D92d2ad4658C32F2e2fF1e7096D',
          to: '0x0C8aFa31d68028eD8054493eE92F52b82AB992A2',
          type: 'ERC20:transfer'
        });
        assert.deepEqual(effects[1], {
          amount: '1000000000000000000',
          callStack: '0_2_0',
          contractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          from: '0xEC67e10a5991Ab7AE9ea3d47A1f3725009AbB92c',
          to: '0x8cD6C8c449918D92d2ad4658C32F2e2fF1e7096D',
          type: 'ERC20:transfer'
        });
        assert.strictEqual(effects.length, 2);
      });

      it('should get effects for Uniswap V3 swap to self transaction', async () => {
        const effects = EVMTransactionStorage.getEffects(EvmTxData.UniswapV3DexSwap);
        assert.deepEqual(effects[0], {
          type: 'ERC20:transfer',
          to: '0x74de5d4FCbf63E00296fd95d33236B9794016631',
          from: '0xaD4eb3C32785e0eDd88261d2d6fCc3acb02ad430',
          amount: '1103027611',
          contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          callStack: '0',
        });
        assert.deepEqual(effects[1], {
          type: 'ERC20:transfer',
          to: '0x0000006daea1723962647b7e189d311d757Fb793',
          from: '0x74de5d4FCbf63E00296fd95d33236B9794016631',
          amount: '1093376120',
          contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          callStack: '1_0_1_0_1',
        });
        assert.deepEqual(effects[2], {
          type: 'ERC20:transfer',
          to: '0x74de5d4FCbf63E00296fd95d33236B9794016631',
          from: '0x0000006daea1723962647b7e189d311d757Fb793',
          amount: '1498018406041426591744',
          contractAddress: '0xa47c8bf37f92aBed4A126BDA807A7b7498661acD',
          callStack: '1_0_1_0_2',
        });
        assert.deepEqual(effects[3], {
          type: 'ERC20:transfer',
          to: '0x2aCf35C9A3F4c5C3F4c78EF5Fb64c3EE82f07c45',
          from: '0x74de5d4FCbf63E00296fd95d33236B9794016631',
          amount: '9651491',
          contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          callStack: '1_0_2',
        });
        assert.deepEqual(effects[4], {
          type: 'ERC20:transfer',
          to: '0xaD4eb3C32785e0eDd88261d2d6fCc3acb02ad430',
          from: '0x74de5d4FCbf63E00296fd95d33236B9794016631',
          amount: '1498018406041426591744',
          contractAddress: '0xa47c8bf37f92aBed4A126BDA807A7b7498661acD',
          callStack: '1_0_5',
        });
      });
    });
  });
});

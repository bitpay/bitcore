import { ObjectId } from 'bson';
import { expect } from 'chai';
import { Request, Response } from 'express-serve-static-core';
import _ from 'lodash';
import * as sinon from 'sinon';
import { Transform } from 'stream';
import Web3 from 'web3';
import { MongoBound } from '../../../src/models/base';
import { CacheStorage } from '../../../src/models/cache';
import { IWallet, WalletStorage } from '../../../src/models/wallet';
import { WalletAddressStorage } from '../../../src/models/walletAddress';
import { ETH } from '../../../src/modules/ethereum/api/csp';
import { EthBlockStorage } from '../../../src/modules/ethereum/models/block';
import { EthTransactionStorage } from '../../../src/modules/ethereum/models/transaction';
import { IEthTransaction } from '../../../src/modules/ethereum/types';
import { StreamWalletTransactionsParams } from '../../../src/types/namespaces/ChainStateProvider';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';
import { EthTransactions } from '../../data/ETH/transactionsETH';
import { EthBlocks } from '../../data/ETH/blocksETH';

describe('Ethereum API', function() {
  const chain = 'ETH';
  const network = 'testnet';

  const suite = this;
  this.timeout(30000);
  before(intBeforeHelper);
  after(async () => intAfterHelper(suite));

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

  it('should be able to get the fees', async () => {
    const chain = 'ETH';
    const network = 'testnet';
    let target = 1;
    while (target <= 4) {
      const cacheKey = `getFee-${chain}-${network}-${target}`;
      const fee = await ETH.getFee({ chain, network, target });
      expect(fee).to.exist;
      const cached = await CacheStorage.getGlobal(cacheKey);
      expect(fee).to.deep.eq(cached);
      target++;
    }
  });

  it('should estimate fees by most recent transactions', async () => {
    const chain = 'ETH';
    const network = 'testnet';
    const txs = new Array(4000).fill({}).map(_ => {
      return {
        chain,
        network,
        blockHeight: 1,
        gasPrice: 10 * 1e9
      } as IEthTransaction;
    });
    await CacheStorage.collection.remove({});
    await EthTransactionStorage.collection.deleteMany({});
    await EthTransactionStorage.collection.insertMany(txs);
    const estimates = await Promise.all([1, 2, 3, 4].map(target => ETH.getFee({ network, target })));
    for (const estimate of estimates) {
      expect(estimate.feerate).to.be.gt(0);
      expect(estimate.feerate).to.be.eq(10000000000);
    }
  });

  it('should return cached fee for a minute', async () => {
    const chain = 'ETH';
    const network = 'testnet';
    const txs = new Array(4000).fill({}).map(_ => {
      return {
        chain,
        network,
        blockHeight: 1,
        gasPrice: 10 * 1e9
      } as IEthTransaction;
    });
    await CacheStorage.collection.remove({})
    await EthTransactionStorage.collection.deleteMany({});
    await EthTransactionStorage.collection.insertMany(txs);
    let estimates = await Promise.all([1, 2, 3, 4].map(target => ETH.getFee({ network, target })));

    await EthTransactionStorage.collection.deleteMany({});
    estimates = await Promise.all([1, 2, 3, 4].map(target => ETH.getFee({ network, target })));
    for (const estimate of estimates) {
      expect(estimate.feerate).to.be.gt(0);
      expect(estimate.feerate).to.be.eq(10000000000);
    }
  });

  it('should be able to get address token balance', async () => {
    const sandbox = sinon.createSandbox();
    const address = '0xb8fd14fb0e0848cb931c1e54a73486c4b968be3d';
    const token = {
      name: 'Test Token',
      decimals: 10,
      symbol: 'TST'
    };

    const tokenStub = {
      methods: {
        name: () => ({ call: sandbox.stub().resolves(token.name) }),
        decimals: () => ({ call: sandbox.stub().resolves(token.decimals) }),
        symbol: () => ({ call: sandbox.stub().resolves(token.symbol) }),
        balanceOf: () => ({ call: sandbox.stub().resolves(0) })
      }
    };
    sandbox.stub(ETH, 'erc20For').resolves(tokenStub);
    const balance = await ETH.getBalanceForAddress({ chain, network, address, args: { tokenAddress: address } });
    expect(balance).to.deep.eq({ confirmed: 0, unconfirmed: 0, balance: 0 });
    sandbox.restore();
  });

  it('should be able to get address ETH balance', async () => {
    const address = '0xb8fd14fb0e0848cb931c1e54a73486c4b968be3d';
    const balance = await ETH.getBalanceForAddress({ chain, network, address, args: {} });
    expect(balance).to.deep.eq({ confirmed: 0, unconfirmed: 0, balance: 0 });
  });

  it('should stream ETH transactions for address', async () => {
    const address = '0xb8fd14fb0e0848cb931c1e54a73486c4b968be3d';
    const txCount = 100;
    const txs = new Array(txCount).fill({}).map(() => {
      return {
        chain,
        network,
        blockHeight: 1,
        gasPrice: 10 * 1e9,
        data: Buffer.from(''),
        from: address
      } as IEthTransaction;
    });
    await EthTransactionStorage.collection.deleteMany({});
    await EthTransactionStorage.collection.insertMany(txs);

    const res = (new Transform({
      transform: (data, _, cb) => cb(null, data)
    }) as unknown) as Response;
    res.type = () => res;

    const req = (new Transform({
      transform: (_data, _, cb) => cb(null)
    }) as unknown) as Request;

    await ETH.streamAddressTransactions({ chain, network, address, res, req, args: {} });
    let counter = 0;
    await new Promise(r => {
      res
        .on('data', () => counter++)
        .on('end', r);
    });

    const commaCount = txCount - 1;
    const bracketCount = 2;
    const expected = txCount + commaCount + bracketCount;
    expect(counter).to.eq(expected);
  });

  it('should stream ETH transactions for block', async () => {
    const txCount = 100;
    const txs = new Array(txCount).fill({}).map(() => {
      return {
        chain,
        network,
        blockHeight: 1,
        gasPrice: 10 * 1e9,
        data: Buffer.from('')
      } as IEthTransaction;
    });
    await EthTransactionStorage.collection.deleteMany({});
    await EthTransactionStorage.collection.insertMany(txs);

    const res = (new Transform({
      transform: (data, _, cb) => {
        cb(null, data);
      }
    }) as unknown) as Response;
    res.type = () => res;

    const req = (new Transform({
      transform: (_data, _, cb) => {
        cb(null);
      }
    }) as unknown) as Request;

    await ETH.streamTransactions({ chain, network, res, req, args: { blockHeight: 1 } });
    let counter = 0;
    await new Promise<void>(r => {
      res
        .on('data', () => {
          counter++;
        })
        .on('end', () => {
          r();
        });
    });

    const commaCount = txCount - 1;
    const bracketCount = 2;
    const expected = txCount + commaCount + bracketCount;
    expect(counter).to.eq(expected);
  });

  it('should stream ETH transactions for blockHash', async () => {
    const txCount = 100;
    const txs = new Array(txCount).fill({}).map(() => {
      return {
        chain,
        network,
        blockHash: '12345',
        gasPrice: 10 * 1e9,
        data: Buffer.from('')
      } as IEthTransaction;
    });
    await EthTransactionStorage.collection.deleteMany({});
    await EthTransactionStorage.collection.insertMany(txs);

    const res = (new Transform({
      transform: (data, _, cb) => {
        cb(null, data);
      }
    }) as unknown) as Response;
    res.type = () => res;

    const req = (new Transform({
      transform: (_data, _, cb) => {
        cb(null);
      }
    }) as unknown) as Request;

    await ETH.streamTransactions({ chain, network, res, req, args: { blockHash: '12345' } });
    let counter = 0;
    await new Promise<void>(r => {
      res
        .on('data', () => {
          counter++;
        })
        .on('end', () => {
          r();
        });
    });

    const commaCount = txCount - 1;
    const bracketCount = 2;
    const expected = txCount + commaCount + bracketCount;
    expect(counter).to.eq(expected);
  });

  describe('#streamWalletTransactions', () => {
    let sandbox = sinon.createSandbox();
    let chain = 'ETH';
    let network = 'mainnet';
    let address = '0x1Eee23160Db790ee48Fd39871A64b13e76Fc2C3C';
    let wallet: IWallet = {
      chain,
      network,
      pubKey: '',
      name: 'this-name',
      singleAddress: false,
      path: 'm/0/0'
    }
    let web3 = new Web3();

    before(async () => {
      const res = await WalletStorage.collection.findOneAndUpdate({ name: wallet.name }, { $set: wallet }, { returnOriginal: false, upsert: true });
      wallet = res.value as IWallet;
      await WalletAddressStorage.collection.updateOne({ network, address }, { $set: { chain, network, wallet: (wallet._id as ObjectId), processed: true, address } }, { upsert: true })
      sandbox.stub(ETH, 'getWeb3').resolves({ web3 });
    });

    afterEach(async () => {
      await EthBlockStorage.collection.deleteMany({});
      await EthTransactionStorage.collection.deleteMany({});
    });

    after(async () => { 
      sandbox.restore();
    });

    it('should stream wallet\'s valid ETH transactions', async () =>
      await streamWalletTransactionsTest(chain, network)
    );

    it('should stream wallet\'s valid & invalid ETH transactions', async () =>
      await streamWalletTransactionsTest(chain, network, true)
    );

    it('should stream DEX wallet transactions', async () => {
      await EthBlockStorage.collection.insertMany(EthBlocks as any);
      await EthTransactionStorage.collection.insertMany(EthTransactions as any);

      await ETH.updateWallet({ chain, network, wallet, addresses: [address] });

      const res = (new Transform({
        transform: (data, _, cb) => {
          cb(null, data);
        }
      }) as unknown) as Response;
      res.type = () => res;
  
      const req = (new Transform({
        transform: (_data, _, cb) => {
          cb(null);
        }
      }) as unknown) as Request;

      ETH.streamWalletTransactions({ chain, network, wallet, res, req, args: {} });
      let total = BigInt(0);
      let totalRejected = BigInt(0);
      let totalFee = BigInt(0);

      await new Promise((resolve, reject) => {
        res.on('data', (data) => {
          try {
            const doc = JSON.parse(data.toString())
            if (doc.error) {
              totalRejected += BigInt(doc.satoshis);
            } else {
              total += BigInt(doc.satoshis);
            }

            if (doc.category !== 'receive' || doc.initialFrom === address) {
              totalFee += BigInt(doc.fee);
            }
          } catch (e) {
            reject(e);
          }
        });

        res.on('finish', () => {
          try {
            let totalETH = web3.utils.fromWei(total.toString());
            let totalRejectedETH = web3.utils.fromWei(totalRejected.toString());
            let totalFeeETH = web3.utils.fromWei(totalFee.toString());
            let balanceETH = web3.utils.fromWei((total - totalFee).toString());

            // Need to slice b/c we're using Number rounding instead of BigInt
            expect(balanceETH.slice(0, -5)).to.equal('309.666283810972788445'.slice(0, -5));
            expect(totalETH.slice(0, -6)).to.equal('309.833211546562');
            expect(totalFeeETH).to.equal('0.16692773559');
            expect(totalRejectedETH.slice(0, -4)).to.equal('-3.99999999192707');
            resolve(true);
          } catch (e) {
            reject(e);
          }
        });
      });
    });
  });
});

const streamWalletTransactionsTest = async (chain: string, network: string, includeInvalidTxs: boolean = false) => {
  const sandbox = sinon.createSandbox();

  // Constants
  const address = '0x7F17aF79AABC4A297A58D389ab5905fEd4Ec9502';
  const objectId = ObjectId.createFromHexString('60f9abed0e32086bf9903bb5');
  const wallet = {
    _id: objectId,
    chain,
    network,
    name: 'Ganache',
    pubKey: '0x029ec2ebdebe6966259cf3c6f35c4f126b82fe072bf9d0e81dad375f1d6d2d9054',
    path: 'm/44\'/60\'/0\'/0/0',
    singleAddress: true
  } as MongoBound<IWallet>;
  const txCount = 100;

  // Valid Transactions
  const txs = new Array(txCount).fill({}).map(() => {
    return {
      chain,
      network,
      blockHeight: 1,
      gasPrice: 10 * 1e9,
      data: Buffer.from(''),
      from: address
    } as IEthTransaction;
  });
  // Invalid Transactions
  _.times(txCount, () => txs.push({
    ...txs[0],
    blockHeight: -3
  }))
  // Add wallet object ID to transactions
  txs.forEach(tx => tx.wallets = [objectId]);

  // Stubs
  sandbox.stub(ETH, 'getWalletAddresses').resolves([address]);

  // Test
  await EthTransactionStorage.collection.deleteMany({});
  await EthTransactionStorage.collection.insertMany(txs);

  const res = (new Transform({
    transform: (data, _, cb) => cb(null, data)
  }) as unknown) as Response;
  res.type = () => res;

  await ETH.streamWalletTransactions({
    chain,
    network,
    wallet,
    res,
    args: {
      includeInvalidTxs
    }
  } as StreamWalletTransactionsParams)

  let counter = 0;
  await new Promise(r => {
    res
      .on('data', () => counter++)
      .on('end', r);
  });

  expect(counter).to.eq(includeInvalidTxs ? txCount * 2 : txCount);
  sandbox.restore();
};

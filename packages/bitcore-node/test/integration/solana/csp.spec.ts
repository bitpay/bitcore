import { ObjectId } from 'bson';
import { expect } from 'chai';
import { Request, Response } from 'express-serve-static-core';
import _ from 'lodash';
import * as sinon from 'sinon';
import { Writable } from 'stream';
import { MongoBound } from '../../../src/models/base';
import { CacheStorage } from '../../../src/models/cache';
import { IWallet, WalletStorage } from '../../../src/models/wallet';
import { WalletAddressStorage } from '../../../src/models/walletAddress';
import { SOL } from '../../../src/modules/solana/api/csp';
import { SVMRouter } from '../../../src/providers/chain-state/svm/api/routes';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

describe('Solana API', function() {
  const chain = 'SOL';
  const network = 'devnet';
  let sandbox: sinon.SinonSandbox;

  const suite = this;
  this.timeout(30000);
  
  before(intBeforeHelper);

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });
  
  after(async () => intAfterHelper(suite));

  it('should be able to get the fees', async () => {
    let target = 1;
    while (target <= 4) {
      const cacheKey = `getFee-${chain}-${network}-${target}`;
      const fee = await SOL.getFee({ chain, network, target });
      expect(fee).to.exist;
      const cached = await CacheStorage.getGlobal(cacheKey);
      expect(fee).to.deep.eq(cached);
      target++;
    }
  });

  it('should be able to get fees with rawTx', async () => {
    const rawTx = 'mocked-raw-tx-data';
    const mockedFee = 5000;
    let err;

    const rpc = {
      estimateFee: sandbox.stub().resolves(mockedFee)
    };

    sandbox.stub(SOL, 'getRpc').resolves({ rpc });
    try {
      const cacheKey = `getFee-${chain}-${network}-4-${rawTx}`;
      const fee = await SOL.getFee({ chain, network, target: 4, rawTx });
      expect(fee).to.exist;
      expect(fee.feerate).to.equal(mockedFee);
      const cached = await CacheStorage.getGlobal(cacheKey);
      expect(fee).to.deep.eq(cached);
    } catch (error) {
      err = error;
    }
    expect(err).to.be.undefined;
  });

  it('should be able to get address SOL balance', async () => {
    const address = 'DGqGrPJu5QgQ5pFHimGKX6wqPmUVnk5L1NAmpHdP6n8F';
    const mockedBalance = 1000000;
    
    const rpc = {
      getBalance: sandbox.stub().resolves(mockedBalance)
    };
    
    sandbox.stub(SOL, 'getRpc').resolves({ rpc });
    
    const balance = await SOL.getBalanceForAddress({ chain, network, address, args: {} });
    expect(balance).to.deep.eq({ confirmed: mockedBalance, unconfirmed: 0, balance: mockedBalance });
  });

  it('should be able to get address token balance', async () => {
    const address = 'DGqGrPJu5QgQ5pFHimGKX6wqPmUVnk5L1NAmpHdP6n8F';
    const tokenAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC token address example
    const mockedAddresses = [
      { mint: tokenAddress, state: 'initialized', pubkey: 'someTokenAccountAddress' }
    ];
    const decimals = 6;
    
    const rpc = {
      getTokenAccountsByOwner: sandbox.stub().resolves(mockedAddresses)
    };
    const connection = {
      getTokenAccountBalance:  sandbox.stub().returns({
        send: sandbox.stub().resolves({ value: { decimals } })  
      })
    }
    
    sandbox.stub(SOL, 'getRpc').resolves({ rpc, connection });
    
    const tokenAccounts = await SOL.getTokenAccountAddresses({ network, address });
    expect(tokenAccounts).to.deep.eq([{ mintAddress: tokenAddress, ataAddress: 'someTokenAccountAddress', decimals }]);
  });

  describe('#streamWalletTransactions', () => {
    let address = 'DGqGrPJu5QgQ5pFHimGKX6wqPmUVnk5L1NAmpHdP6n8F';
    let wallet: IWallet;

    // Set up wallet before running wallet tests
    before(async () => {
      wallet = {
        chain,
        network,
        pubKey: '',
        name: 'solana-wallet',
        singleAddress: false,
        path: 'm/44\'/501\'/0\'/0/0'
      };
      
      const res = await WalletStorage.collection.findOneAndUpdate(
        { name: wallet.name }, 
        { $set: wallet }, 
        { returnOriginal: false, upsert: true }
      );
      
      wallet = res.value as IWallet;
      
      await WalletAddressStorage.collection.updateOne(
        { network, address }, 
        { 
          $set: { 
            chain, 
            network, 
            wallet: (wallet._id as ObjectId), 
            processed: true, 
            address 
          } 
        }, 
        { upsert: true }
      );
    });

    it('should stream wallet\'s SOL transactions', async () => {
      const mockedTransactions = [
        {
          txid: 'tx1',
          feePayerAddress: address,
          slot: 123,
          fee: 5000,
          meta: { fee: 5000, type: 'transfer' },
          version: '0',
          status: 'confirmed',
          lifetimeConstraint: { blockhash: 'hash123' },
          blockTime: Date.now() / 1000,
          instructions: {
            'transferSol': [
              {
                source: address,
                destination: 'otherAddress',
                amount: 100000
              }
            ]
          }
        }
      ];
      
      const mockedTxStatuses = [
        {
          confirmationStatus: 'confirmed',
          slot: 123,
          err: null
        }
      ];
      
      const connection = {
        getSignaturesForAddress: () => ({ send: sandbox.stub().resolves(mockedTxStatuses) })
      };
      
      const rpc = {
        getTransactions: sandbox.stub().resolves(mockedTransactions)
      };
      
      sandbox.stub(SOL, 'getRpc').resolves({ rpc, connection });
      sandbox.stub(SOL, 'getWalletAddresses').resolves([{ address }]);
      
      let counter = 0;
      const req = (new Writable({
        write: function(data, _, cb) {
          data && counter++;
          cb();
        }
      }) as unknown) as Request;
      
      const res = (new Writable({
        write: function(data, _, cb) {
          data && counter++;
          cb();
        }
      }) as unknown) as Response;
      res.type = () => res;

      const err = await new Promise(r => {
        res
          .on('error', r)
          .on('finish', r);

        SOL.streamWalletTransactions({
          chain,
          network,
          wallet,
          req,
          res,
          args: {}
        })
          .catch(e => r(e));
      });

      expect(err).to.not.exist;
      expect(counter).to.be.gt(0);
    });
  });

  it('should correctly transform transaction data', () => {
    const tx = {
      txid: 'tx1',
      feePayerAddress: 'sender',
      slot: 123,
      fee: 5000,
      meta: { fee: 5000 },
      version: '0',
      status: 'confirmed',
      lifetimeConstraint: { blockhash: 'hash123' },
      blockTime: Date.now() / 1000,
      instructions: {
        'transferSol': [
          {
            source: 'sender',
            destination: 'receiver',
            amount: 100000
          }
        ]
      }
    };
    
    expect(typeof SOL.txTransform).to.equal('function', 'SOL.txTransform should be defined as a function');
    
    const transformedTx = SOL.txTransform(network, { tx });
    
    expect(transformedTx).to.exist;
    expect(transformedTx.txid).to.equal('tx1');
    expect(transformedTx.fee).to.equal(5000);
    expect(transformedTx.from).to.equal('sender');
    expect(transformedTx.address).to.equal('receiver');
    expect(transformedTx.satoshis).to.equal(100000);
    expect(transformedTx.category).to.equal('send');
  });

  it('should get local tip', async () => {
    const mockedBlock = {
      blockHeight: 123,
      blockTime: Date.now() / 1000,
      blockhash: 'hash123',
      previousBlockHash: 'prevHash123',
      signatures: ['sig1'],
      rewards: [
        {
          lamports: 1000000
        }
      ]
    };
    
    const connection = {
      getSlot: () => ({ send: sandbox.stub().resolves(123) })
    };
    
    const rpc = {
      getBlock: sandbox.stub().resolves(mockedBlock)
    };
    
    sandbox.stub(SOL, 'getRpc').resolves({ rpc, connection });
    
    const tip = await SOL.getLocalTip({ network });
    
    expect(tip).to.exist;
    expect(tip.height).to.equal(123);
    expect(tip.hash).to.equal('hash123');
    expect(tip.previousBlockHash).to.equal('prevHash123');
    expect(tip.transactionCount).to.equal(1);
    expect(tip.reward).to.equal(1000000);
  });

  it('should be able to get rent exemption amount', async () => {
    const space = 100;
    const mockedAmount = 2039280;
    
    const connection = {
      getMinimumBalanceForRentExemption: () => ({ send: sandbox.stub().resolves(mockedAmount) })
    };
    
    sandbox.stub(SOL, 'getRpc').resolves({ connection });
    
    const amount = await SOL.getRentExemptionAmount({ network, space });
    
    expect(amount).to.equal(mockedAmount);
  });

  it('should broadcast transaction', async () => {
    const rawTx = 'mocked-raw-tx-data';
    const expectedSignature = 'tx-signature';
    
    const rpc = {
      sendRawTransaction: sandbox.stub().resolves(expectedSignature)
    };
    
    sandbox.stub(SOL, 'getRpc').resolves({ rpc });
    
    const result = await SOL.broadcastTransaction({ chain, network, rawTx });
    
    expect(result).to.equal(expectedSignature);
  });

  it('should get wallet balance', async () => {
    const addresses = [
      { address: 'address1' },
      { address: 'address2' }
    ];
    
    const balances = [
      { confirmed: 0, unconfirmed: 0, balance: 1000000 },
      { confirmed: 0, unconfirmed: 0, balance: 2000000 }
    ];
    
    const wallet = {
      _id: new ObjectId(),
      chain,
      network,
      name: 'Solananana',
      pubKey: '5c9c85b20525ee81d3cc56da1f8307ec169086ae41458c5458519aced7683b66',
      path: 'm/44\'/501\'/0\'/0',
      singleAddress: true
    } as MongoBound<IWallet>;
    
    sandbox.stub(SOL, 'getWalletAddresses').resolves(addresses);
    const getBalanceStub = sandbox.stub(SOL, 'getBalanceForAddress');
    
    getBalanceStub.onFirstCall().resolves(balances[0]);
    getBalanceStub.onSecondCall().resolves(balances[1]);
    
    const balance = await SOL.getWalletBalance({ chain, network, wallet, args: {} });
    
    expect(balance).to.deep.eq({
      confirmed: 0,
      unconfirmed: 0,
      balance: 3000000
    });
  });

  describe('#decodeRawTransaction', () => {
    let svmRouter: SVMRouter;
  
    beforeEach(() => {
      svmRouter = new SVMRouter(SOL, chain);
    });
  
    it('should successfully decode a valid raw transaction', async () => {
      const rawTx = 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEDb6/gH5XxrVl86CZd+DpqA1jN8YSz91e8yXxOlyeS8tLRnckLdZVIkhi0iAExccvYpTw5tIfPZ8z/OJGQtnvg9QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7A+XJrI4siFXUreDo+M94DBeuJwm0Oq5kHqeWuAw7xgBAgIAAQwCAAAAAIALMGTXDQA=';
      
      const mockDecodedTx = {
        version: 0,
        fee: '5000',
        signatures: ['signature1'],
        instructions: [
          {
            programId: 'SystemProgram',
            accounts: ['account1', 'account2'],
            data: 'instruction_data',
            lamports: '1000000000'
          }
        ],
        recentBlockhash: 'recent_blockhash'
      };
  
      const rpc = {
        decodeRawTransaction: sandbox.stub().resolves(mockDecodedTx)
      };
  
      sandbox.stub(SOL, 'getRpc').resolves({ rpc });
  
      const req = {
        body: { rawTx },
        params: { network }
      } as any;
      
      const res = {
        json: sandbox.stub(),
        status: sandbox.stub().returnsThis(),
        send: sandbox.stub()
      } as any;
  
      const router = svmRouter.getRouter();
      // Find the decode route handler
      const routeCall = router.stack.find((layer: any) => 
        layer.route && layer.route.path === `/api/${chain}/:network/decode`
      );
      
      expect(routeCall).to.exist;
      const routeHandler = routeCall?.route?.stack?.[0]?.handle;
      expect(routeHandler).to.exist;
      
      const next = sandbox.stub();
      await (routeHandler as any)(req, res, next);
  
      expect(rpc.decodeRawTransaction.calledOnce).to.be.true;
      expect(rpc.decodeRawTransaction.calledWith({ rawTx })).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.calledWith(mockDecodedTx)).to.be.true;
      expect(res.status.called).to.be.false;
    });
  
    it('should return 400 error when rawTx is missing', async () => {
      const req = {
        body: {}, // Missing rawTx
        params: { network }
      } as any;
      
      const res = {
        json: sandbox.stub(),
        status: sandbox.stub().returnsThis(),
        send: sandbox.stub()
      } as any;
  
      const router = svmRouter.getRouter();
      const routeCall = router.stack.find((layer: any) => 
        layer.route && layer.route.path === `/api/${chain}/:network/decode`
      );
      
      const routeHandler = routeCall?.route?.stack?.[0]?.handle;
      expect(routeHandler).to.exist;
      
      const next = sandbox.stub();
      await (routeHandler as any)(req, res, next);
  
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(400)).to.be.true;
      expect(res.send.calledOnce).to.be.true;
      expect(res.send.calledWith('Missing raw transaction string')).to.be.true;
      expect(res.json.called).to.be.false;
    });
  
    it('should return 400 error when rawTx has invalid base64 encoding', async () => {
      const rawTx = 'invalid_base64_!@#$%';
  
      const req = {
        body: { rawTx },
        params: { network }
      } as any;
      
      const res = {
        json: sandbox.stub(),
        status: sandbox.stub().returnsThis(),
        send: sandbox.stub()
      } as any;
  
      const router = svmRouter.getRouter();
      const routeCall = router.stack.find((layer: any) => 
        layer.route && layer.route.path === `/api/${chain}/:network/decode`
      );
      
      const routeHandler = routeCall?.route?.stack?.[0]?.handle;
      expect(routeHandler).to.exist;
      
      const next = sandbox.stub();
      await (routeHandler as any)(req, res, next);
  
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(400)).to.be.true;
      expect(res.send.calledOnce).to.be.true;
      expect(res.send.calledWith('Invalid base64 encoding')).to.be.true;
    });
  
    it('should return 400 error when transaction size exceeds maximum', async () => {
      // Create a base64 string that would decode to more than 1232 bytes
      const largeBuffer = Buffer.alloc(1300, 'a');
      const rawTx = largeBuffer.toString('base64');
  
      const req = {
        body: { rawTx },
        params: { network }
      } as any;
      
      const res = {
        json: sandbox.stub(),
        status: sandbox.stub().returnsThis(),
        send: sandbox.stub()
      } as any;
  
      const router = svmRouter.getRouter();
      const routeCall = router.stack.find((layer: any) => 
        layer.route && layer.route.path === `/api/${chain}/:network/decode`
      );
      
      const routeHandler = routeCall?.route?.stack?.[0]?.handle;
      expect(routeHandler).to.exist;
      
      const next = sandbox.stub();
      await (routeHandler as any)(req, res, next);
  
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(400)).to.be.true;
      expect(res.send.calledOnce).to.be.true;
      expect(res.send.args[0][0]).to.include('exceeds maximum (1232)');
    });
  
    it('should return 400 error when transaction is too small', async () => {
      // Create a small base64 string that would decode to less than 64 bytes
      const smallBuffer = Buffer.alloc(30, 'a');
      const rawTx = smallBuffer.toString('base64');
  
      const req = {
        body: { rawTx },
        params: { network }
      } as any;
      
      const res = {
        json: sandbox.stub(),
        status: sandbox.stub().returnsThis(),
        send: sandbox.stub()
      } as any;
  
      const router = svmRouter.getRouter();
      const routeCall = router.stack.find((layer: any) => 
        layer.route && layer.route.path === `/api/${chain}/:network/decode`
      );
      
      const routeHandler = routeCall?.route?.stack?.[0]?.handle;
      expect(routeHandler).to.exist;
      
      const next = sandbox.stub();
      await (routeHandler as any)(req, res, next);
  
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(400)).to.be.true;
      expect(res.send.calledOnce).to.be.true;
      expect(res.send.calledWith('Transaction too small to be valid')).to.be.true;
    });
  
    it('should return 500 error when RPC decoding fails', async () => {
      const rawTx = 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEDb6/gH5XxrVl86CZd+DpqA1jN8YSz91e8yXxOlyeS8tLRnckLdZVIkhi0iAExccvYpTw5tIfPZ8z/OJGQtnvg9QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7A+XJrI4siFXUreDo+M94DBeuJwm0Oq5kHqeWuAw7xgBAgIAAQwCAAAAAIALMGTXDQA=';
      const decodingError = new Error('RPC decode failed');
  
      const rpc = {
        decodeRawTransaction: sandbox.stub().throws(decodingError)
      };
  
      sandbox.stub(SOL, 'getRpc').resolves({ rpc });
  
      const req = {
        body: { rawTx },
        params: { network }
      } as any;
      
      const res = {
        json: sandbox.stub(),
        status: sandbox.stub().returnsThis(),
        send: sandbox.stub()
      } as any;
  
      const router = svmRouter.getRouter();
      const routeCall = router.stack.find((layer: any) => 
        layer.route && layer.route.path === `/api/${chain}/:network/decode`
      );
      
      const routeHandler = routeCall?.route?.stack?.[0]?.handle;
      expect(routeHandler).to.exist;
      
      const next = sandbox.stub();
      await (routeHandler as any)(req, res, next);
  
      expect(rpc.decodeRawTransaction.calledOnce).to.be.true;
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(500)).to.be.true;
      expect(res.send.calledOnce).to.be.true;
      expect(res.send.calledWith(decodingError.message)).to.be.true;
      expect(res.json.called).to.be.false;
    });
  
    it('should handle null response from RPC decoding', async () => {
      const rawTx = 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEDb6/gH5XxrVl86CZd+DpqA1jN8YSz91e8yXxOlyeS8tLRnckLdZVIkhi0iAExccvYpTw5tIfPZ8z/OJGQtnvg9QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7A+XJrI4siFXUreDo+M94DBeuJwm0Oq5kHqeWuAw7xgBAgIAAQwCAAAAAIALMGTXDQA=';
  
      const rpc = {
        decodeRawTransaction: sandbox.stub().resolves(null)
      };
  
      sandbox.stub(SOL, 'getRpc').resolves({ rpc });
  
      const req = {
        body: { rawTx },
        params: { network }
      } as any;
      
      const res = {
        json: sandbox.stub(),
        status: sandbox.stub().returnsThis(),
        send: sandbox.stub()
      } as any;
  
      const router = svmRouter.getRouter();
      const routeCall = router.stack.find((layer: any) => 
        layer.route && layer.route.path === `/api/${chain}/:network/decode`
      );
      
      const routeHandler = routeCall?.route?.stack?.[0]?.handle;
      expect(routeHandler).to.exist;
      
      const next = sandbox.stub();
      await (routeHandler as any)(req, res, next);
  
      expect(rpc.decodeRawTransaction.calledOnce).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.calledWith(null)).to.be.true;
      expect(res.status.called).to.be.false;
    });
  
    it('should decode transaction with different network parameters', async () => {
      const rawTx = 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEDb6/gH5XxrVl86CZd+DpqA1jN8YSz91e8yXxOlyeS8tLRnckLdZVIkhi0iAExccvYpTw5tIfPZ8z/OJGQtnvg9QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7A+XJrI4siFXUreDo+M94DBeuJwm0Oq5kHqeWuAw7xgBAgIAAQwCAAAAAIALMGTXDQA=';
      const networks = ['mainnet', 'devnet', 'testnet'];
      
      for (const testNetwork of networks) {
        const mockDecodedTx = {
          version: 0,
          fee: '5000',
          network: testNetwork
        };
  
        const rpc = {
          decodeRawTransaction: sandbox.stub().resolves(mockDecodedTx)
        };
  
        sandbox.stub(SOL, 'getRpc').resolves({ rpc });
  
        const req = {
          body: { rawTx },
          params: { network: testNetwork }
        } as any;
        
        const res = {
          json: sandbox.stub(),
          status: sandbox.stub().returnsThis(),
          send: sandbox.stub()
        } as any;
  
        const router = svmRouter.getRouter();
        const routeCall = router.stack.find((layer: any) => 
          layer.route && layer.route.path === `/api/${chain}/:network/decode`
        );
        
        const routeHandler = routeCall?.route?.stack?.[0]?.handle;
        expect(routeHandler).to.exist;
        
        const next = sandbox.stub();
        await (routeHandler as any)(req, res, next);
  
        expect(rpc.decodeRawTransaction.calledWith({ rawTx })).to.be.true;
        expect(res.json.calledOnce).to.be.true;
        expect(res.json.calledWith(mockDecodedTx)).to.be.true;
        
        // Restore stub for next iteration
        sandbox.restore();
        sandbox = sinon.createSandbox();
      }
    });
  
    it('should handle complex transaction with bigint values converted to strings', async () => {
      const rawTx = 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEDb6/gH5XxrVl86CZd+DpqA1jN8YSz91e8yXxOlyeS8tLRnckLdZVIkhi0iAExccvYpTw5tIfPZ8z/OJGQtnvg9QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7A+XJrI4siFXUreDo+M94DBeuJwm0Oq5kHqeWuAw7xgBAgIAAQwCAAAAAIALMGTXDQA=';
      
      // Mock RPC returns bigint values
      const mockDecodedTxWithBigInts = {
        version: 0,
        fee: BigInt(5000),
        lamports: BigInt('1000000000000'),
        signatures: ['sig1', 'sig2'],
        instructions: [
          {
            programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            accounts: ['account1', 'account2'],
            data: 'base64data',
            parsed: {
              info: {
                amount: BigInt('999999999999'),
                authority: 'auth1',
                destination: 'dest1'
              },
              type: 'transfer'
            }
          }
        ],
        recentBlockhash: 'blockhash123',
        accountKeys: ['key1', 'key2']
      };
  
      // Expected response after bigint conversion (what decodeRawTransaction returns)
      const expectedResponse = {
        version: 0,
        fee: '5000',
        lamports: '1000000000000',
        signatures: ['sig1', 'sig2'],
        instructions: [
          {
            programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            accounts: ['account1', 'account2'],
            data: 'base64data',
            parsed: {
              info: {
                amount: '999999999999',
                authority: 'auth1',
                destination: 'dest1'
              },
              type: 'transfer'
            }
          }
        ],
        recentBlockhash: 'blockhash123',
        accountKeys: ['key1', 'key2']
      };
  
      const rpc = {
        decodeRawTransaction: sandbox.stub().resolves(mockDecodedTxWithBigInts)
      };
  
      sandbox.stub(SOL, 'getRpc').resolves({ rpc });
  
      const req = {
        body: { rawTx },
        params: { network }
      } as any;
      
      const res = {
        json: sandbox.stub(),
        status: sandbox.stub().returnsThis(),
        send: sandbox.stub()
      } as any;
  
      const router = svmRouter.getRouter();
      const routeCall = router.stack.find((layer: any) => 
        layer.route && layer.route.path === `/api/${chain}/:network/decode`
      );
      
      const routeHandler = routeCall?.route?.stack[0].handle;
      
      const next = sandbox.stub();
      await (routeHandler as any)(req, res, next);
  
      expect(rpc.decodeRawTransaction.calledOnce).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      // The CSP's decodeRawTransaction method handles bigint conversion
      expect(res.json.calledWith(expectedResponse)).to.be.true;
      expect(res.status.called).to.be.false;
    });
  
    it('should register the correct route path and method', () => {
      const router = svmRouter.getRouter();
      const routeCall = router.stack.find((layer: any) => 
        layer.route && layer.route.path === `/api/${chain}/:network/decode`
      );
      
      expect(routeCall).to.exist;
      expect((routeCall as any)?.route?.methods?.post).to.be.true;
    });
  });
  
});
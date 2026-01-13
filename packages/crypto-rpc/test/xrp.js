import { assert, expect } from 'chai';
import { CryptoRpc } from '../index.js';

const config = {
  chain: 'XRP',
  currency: 'XRP',
  host: process.env.HOST_XRP || 'rippled',
  protocol: 'ws',
  rpcPort: '6006',
  address: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
  currencyConfig: {
    sendTo: 'rDFrG4CgPFMnQFJBmZH7oqTjLuiB3HS4eu',
    privateKey:
    '117ACF0C71DE079057F4D125948D2F1F12CB3F47C234E43438E1E44C93A9C583',
    rawTx:
    '12000322800000002400000017201B0086955368400000000000000C732102F89EAEC7667B30F33D0687BBA86C3FE2A08CCA40A9186C5BDE2DAA6FA97A37D874473045022100BDE09A1F6670403F341C21A77CF35BA47E45CDE974096E1AA5FC39811D8269E702203D60291B9A27F1DCABA9CF5DED307B4F23223E0B6F156991DB601DFB9C41CE1C770A726970706C652E636F6D81145E7B112523F68D2F5E879DB4EAC51C6698A69304'
  },
  connectionIdleMs: 250
};

describe('XRP Tests', function() {
  const currency = 'XRP';
  let blockHash = '';
  let block;
  let txid = '';
  let rpcs;
  let xrpRPC;

  before(() => {
    rpcs = new CryptoRpc(config);
    xrpRPC = rpcs.get(currency);
  });

  it('should be able to get best block hash', async () => {
    try {
      blockHash = await rpcs.getBestBlockHash({ currency });
    } catch (err) {
      expect(err).to.not.exist();
    }

    expect(blockHash).to.have.lengthOf('64');
  });

  it('should estimate fee', async () => {
    let fee;
    try {
      fee = await xrpRPC.estimateFee();
    } catch (err) {
      expect(err).to.not.exist();
    }
    assert.isTrue(fee === '10');
  });

  const blockCases = [
    { description: 'by hash', params: { hash: blockHash } },
    { description: 'by index', params: { index: 'defined below' } },
    { description: 'by latest', params: { index: 'latest' } },
  ];
  Object.defineProperty(blockCases[1].params, 'index', { get: () => block.ledger_index });

  for (const bcase of blockCases) {
    it(`should get block ${bcase.description}`, async () => {
      try {
        block = await rpcs.getBlock({ currency, ...bcase.params });
      } catch (err) {
        expect(err).to.not.exist();
      }

      expect(block).to.have.property('ledger');
      const ledger = block.ledger;
      // from xrpl documentation: https://xrpl.org/ledger.html (9/26/2023)
      // The following fields are deprecated and may be removed without further notice: accepted, totalCoins (use total_coins instead).
      // as a result the following is commented out
      // expect(ledger).to.have.property('accepted');
      // expect(ledger.accepted).to.equal(true);
      expect(ledger).to.have.property('ledger_hash');
      expect(ledger).to.have.property('ledger_index');
      expect(ledger).to.have.property('parent_hash');
      expect(ledger).to.have.property('transactions');
      expect(ledger.transactions).to.deep.equal([]);
      expect(block).to.have.property('ledger_hash');
      expect(block).to.have.property('ledger_index');
      expect(block.ledger_hash).to.equal(ledger.ledger_hash);
      expect(block.ledger_index.toString()).to.equal(ledger.ledger_index);
      expect(block).to.have.property('validated');
      expect(block.validated).to.equal(true);
      assert(block);
    });
  }

  it('should return nothing for unknown block', async () => {
    let unknownBlock;
    try {
      unknownBlock = await rpcs.getBlock({ currency, hash: '1723099E269C77C4BDE86C83FA6415D71CF20AA5CB4A94E5C388ED97123FB55B' });
    } catch (err) {
      expect(err).to.not.exist();
    }
    expect(unknownBlock).to.be.null;
  });

  it('should be able to get a balance', async () => {
    let balance;
    try {
      balance = await rpcs.getBalance({ currency, address: config.address });
    } catch (err) {
      expect(err).to.not.exist();
    }
    expect(balance).to.eq(100000000000);
    assert(balance != undefined);
  });

  it('should be able to send a transaction', async () => {
    await xrpRPC.asyncRequest('ledger_accept');
    let beforeToBalance;
    try {
      beforeToBalance = await rpcs.getBalance({ currency, address: config.currencyConfig.sendTo });
    } catch (err) {
      beforeToBalance = 0;
    }
    try {
      txid = await rpcs.unlockAndSendToAddress({ currency, address: config.currencyConfig.sendTo, amount: '10000', secret: 'snoPBrXtMeMyMHUVTgbuqAfg1SUTb' });
    } catch (err) {
      expect(err).to.not.exist();
    }

    expect(txid).to.have.lengthOf(64);
    assert(txid);
    await xrpRPC.asyncRequest('ledger_accept');
    const afterToBalance = await rpcs.getBalance({ currency, address: config.currencyConfig.sendTo });
    expect(afterToBalance - beforeToBalance).to.eq(10000);
  });


  it('should be able to send many transactions', async () => {
    const payToArray = [];
    const transaction1 = {
      address: 'r38UsJxHSJKajC8qcNmofxJvCESnzmx7Ke',
      amount: 10000
    };
    const transaction2 = {
      address: 'rMGhv5SNsk81QN1fGu6RybDkUi2of36dua',
      amount: 20000
    };
    const transaction3 = {
      address: 'r4ip6t3NUe4UWguLUJCbyojxG6PdPZg9EJ',
      amount: 30000
    };
    const transaction4 = {
      address: 'rwtFtAMNXPoq4xgxn3FzKKGgVZErdcuLST',
      amount: 40000
    };
    payToArray.push(transaction1);
    payToArray.push(transaction2);
    payToArray.push(transaction3);
    payToArray.push(transaction4);
    const eventEmitter = rpcs.rpcs.XRP.emitter;
    let eventCounter = 0;
    const emitResults = [];
    const emitPromise = new Promise(resolve => {
      eventEmitter.on('success', (emitData) => {
        eventCounter++;
        emitResults.push(emitData);
        if (eventCounter === 3) {
          resolve();
        }
      });
    });
    const outputArray = await rpcs.unlockAndSendToAddressMany({ currency, payToArray, secret: 'snoPBrXtMeMyMHUVTgbuqAfg1SUTb' });
    await emitPromise;
    expect(outputArray).to.have.lengthOf(4);
    expect(outputArray[0]).to.have.property('txid');
    expect(outputArray[1]).to.have.property('txid');
    expect(outputArray[2]).to.have.property('txid');
    expect(outputArray[3]).to.have.property('txid');
    for (const transaction of outputArray) {
      assert(transaction.txid);
      expect(transaction.txid).to.have.lengthOf(64);
    }
    for (const emitData of emitResults) {
      assert(emitData.address);
      assert(emitData.amount);
      assert(emitData.txid);
      expect(emitData.error === null);
      expect(emitData.vout === 0 || emitData.vout === 1);
      const transactionObj = { address: emitData.address, amount: emitData.amount };
      expect(payToArray.includes(transactionObj));
    }
  });

  it('should reject when one of many transactions fails', async () => {
    const address = config.currencyConfig.sendTo;
    const amount = '1000';
    const payToArray = [
      { address, amount },
      { address: 'funkyColdMedina', amount: 1 }
    ];
    const eventEmitter = rpcs.rpcs.XRP.emitter;
    const emitResults = [];
    const emitPromise = new Promise(resolve => {
      eventEmitter.on('failure', (emitData) => {
        emitResults.push(emitData);
        resolve();
      });
    });
    const outputArray = await rpcs.unlockAndSendToAddressMany({
      currency,
      payToArray,
      secret: 'snoPBrXtMeMyMHUVTgbuqAfg1SUTb'
    });
    await emitPromise;
    expect(emitResults.length).to.equal(1);
    assert(emitResults[0].error);
    assert(!outputArray[1].txid);
    expect(outputArray[1].error).to.equal(emitResults[0].error);
  });

  it('should be able to get a transaction', async () => {
    let tx;
    try {
      tx = await rpcs.getTransaction({ currency, txid });
    } catch (err) {
      expect(err).to.not.exist();
    }
    expect(tx).to.have.property('Account');
    expect(tx).to.have.property('Amount');
    expect(tx).to.have.property('Destination');
    expect(tx).to.have.property('Fee');
    expect(tx).to.have.property('Flags');
    expect(tx).to.have.property('LastLedgerSequence');
    expect(tx).to.have.property('Sequence');
    expect(tx).to.have.property('hash');
    expect(tx.hash).to.equal(txid);
    expect(tx).to.have.property('blockHash');
    expect(tx.blockHash).to.not.be.undefined;
  });

  it('should return nothing for unknown transaction', async () => {
    let unknownTx;
    try {
      unknownTx = await rpcs.getTransaction({ currency, txid });
    } catch (err) {
      expect(err).to.not.exist();
    }
    expect(unknownTx === null);
  });

  it('should be able to get a raw transaction', async () => {
    let tx;
    try {
      tx = await rpcs.getRawTransaction({ currency, txid });
    } catch (err) {
      expect(err).to.not.exist();
    }
    expect(tx.length).to.be.greaterThan(300);
  });

  it('should return nothing for unknown raw transaction', async () => {
    let tx;
    try {
      tx = await rpcs.getRawTransaction({ currency, txid: 'E08D6E9754025BA2534A78707605E0601F03ACE063687A0CA1BDDACFCD1698C7' });
    } catch (err) {
      expect(err).to.not.exist();
    }
    expect(tx === null);
  });

  it('should be able to decode a raw transaction', async () => {
    const { rawTx } = config.currencyConfig;
    assert(rawTx);
    const decoded = await rpcs.decodeRawTransaction({ currency, rawTx });
    expect(decoded).to.have.property('Fee');
    expect(decoded).to.have.property('Sequence');
    expect(decoded).to.have.property('Account');
    expect(decoded).to.have.property('TxnSignature');
    expect(decoded).to.have.property('SigningPubKey');
    expect(decoded).to.have.property('Sequence');
    expect(decoded).to.have.property('TransactionType');
    expect(decoded.TransactionType).to.deep.equal('AccountSet');
    assert(decoded);
  });

  it('should get the tip', async () => {
    const tip = await rpcs.getTip({ currency });
    assert(tip != undefined);
    expect(tip).to.have.property('hash');
    expect(tip).to.have.property('height');
  });

  it('should get confirmations', async () => {
    const confirmationsBefore = await rpcs.getConfirmations({ currency, txid });
    assert(confirmationsBefore != undefined);
    const { result: acceptance } = await xrpRPC.asyncRequest('ledger_accept');
    assert(acceptance);
    expect(acceptance).to.have.property('ledger_current_index');
    const confirmationsAfter = await rpcs.getConfirmations({ currency, txid });
    expect(confirmationsAfter - confirmationsBefore).to.eq(1);
  });

  it('should not return confirmations for unknown transaction', async () => {
    const confirmations = await rpcs.getConfirmations({ currency, txid });
    expect(confirmations === null);
  });

  it('should validate address', async () => {
    const isValid = await rpcs.validateAddress({ currency, address: config.currencyConfig.sendTo });
    assert(isValid === true);
  });

  it('should not validate bad address', async () => {
    const isValid = await rpcs.validateAddress({ currency, address: 'NOTANADDRESS' });
    assert(isValid === false);
  });

  it('should get account info', async () => {
    const accountInfo = await rpcs.getAccountInfo({ currency, address: config.address });
    expect(accountInfo).to.have.property('account_data');
    expect(accountInfo.account_data).to.have.property('Balance');
    expect(accountInfo.account_data).to.have.property('Flags');
    expect(accountInfo.account_data).to.have.property('index');
    expect(accountInfo.account_data).to.have.property('LedgerEntryType');
    expect(accountInfo.account_data).to.have.property('OwnerCount');
    expect(accountInfo.account_data).to.have.property('PreviousTxnID');
    expect(accountInfo.account_data).to.have.property('PreviousTxnLgrSeq');
    expect(accountInfo.account_data).to.have.property('Sequence');
  });

  it('should get server info', async () => {
    const serverInfo = await rpcs.getServerInfo({ currency });
    expect(serverInfo).to.have.property('complete_ledgers');
    expect(serverInfo).to.have.property('server_state');
    expect(serverInfo).to.have.property('uptime');
    expect(serverInfo).to.have.property('validated_ledger');
    expect(serverInfo.validated_ledger).to.have.property('reserve_base_xrp');
  });

  it('should disconnect from rpc when idle', async () => {
    await rpcs.getTip({ currency });
    assert(xrpRPC.rpc.isConnected() === true, 'connection should be connected');
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert(xrpRPC.rpc.isConnected() === false, 'connection should be disconnected');
  });

  it('should handle emitted connection errors from rpc with noop', async () => {
    xrpRPC.rpc.emit('error', new Error('connection error xrp'));
  });
});

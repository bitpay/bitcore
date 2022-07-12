'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var chai = require('chai');
chai.config.includeStack = true;
var sinon = require('sinon');
var should = chai.should();
var async = require('async');
var request = require('supertest');
var mongodb = require('mongodb');
var config = require('./test-config');

var CWC = require('crypto-wallet-core');

var Bitcore = CWC.BitcoreLib;
var Bitcore_ = {
  btc: Bitcore,
  bch: CWC.BitcoreLibCash
};

var { Constants } = require('../ts_build/lib/common');
var Client = require('../ts_build').default;
var Key = Client.Key;
var { Utils } = require('../ts_build/lib/common');

const helpers = {
    toSatoshi: btc => {
        if (_.isArray(btc)) {
            return _.map(btc, helpers.toSatoshi);
        } else {
            return parseFloat((btc * 1e8).toPrecision(12));
        }
    },
    newClient: app => {
        $.checkArgument(app);
        return new Client({
            baseUrl: '/bws/api',
            request: request(app),
            bp_partner: 'xxx',
            bp_partner_version: 'yyy'
            //    logLevel: 'debug',
        });
    },
    stubRequest: (err, res) => {
        var request = {
            accept: sinon.stub(),
            set: sinon.stub(),
            query: sinon.stub(),
            send: sinon.stub(),
            timeout: sinon.stub(),
            end: sinon.stub().yields(err, res)
        };
        var reqFactory = _.reduce(
            ['get', 'post', 'put', 'delete'],
            (mem, verb) => {
                mem[verb] = url => {
                    return request;
                };
                return mem;
            },
            {}
        );

        return reqFactory;
    },
    generateUtxos: (scriptType, publicKeyRing, path, requiredSignatures, amounts) => {
        var amounts = [].concat(amounts);
        var utxos = _.map(amounts, (amount, i) => {
            var address = Utils.deriveAddress(scriptType, publicKeyRing, path, requiredSignatures, 'testnet');

            var scriptPubKey;
            switch (scriptType) {
                case Constants.SCRIPT_TYPES.P2WSH:
                case Constants.SCRIPT_TYPES.P2SH:
                    scriptPubKey = new Bitcore.Script.buildMultisigOut(address.publicKeys, requiredSignatures).toScriptHashOut();
                    break;
                case Constants.SCRIPT_TYPES.P2WPKH:
                case Constants.SCRIPT_TYPES.P2PKH:
                    scriptPubKey = new Bitcore.Script.buildPublicKeyHashOut(address.address);
                    break;
            }
            should.exist(scriptPubKey);

            var obj = {
                txid: new Bitcore.crypto.Hash.sha256(Buffer.alloc(i)).toString('hex'),
                vout: 100,
                satoshis: helpers.toSatoshi(amount),
                scriptPubKey: scriptPubKey.toBuffer().toString('hex'),
                address: address.address,
                path: path,
                publicKeys: address.publicKeys
            };
            return obj;
        });
        return utxos;
    },
    createAndJoinWallet: (clients, keys, m, n, opts, cb) => {
        opts = opts || {};

        var coin = opts.coin || 'btc';
        var network = opts.network || 'testnet';

        let keyOpts = {
            useLegacyCoinType: opts.useLegacyCoinType,
            useLegacyPurpose: opts.useLegacyPurpose,
            passphrase: opts.passphrase
        };

        keyOpts.seedType = keyOpts.seedType || 'new';
        keys[0] = opts.key || new Key(keyOpts);
        let cred = keys[0].createCredentials(null, {
            coin: coin,
            network: network,
            account: opts.account ? opts.account : 0,
            n: n,
            addressType: opts.addressType
        });
        clients[0].fromObj(cred);

        clients[0].createWallet(
            'mywallet',
            'creator',
            m,
            n,
            {
                coin: coin,
                network: network,
                singleAddress: !!opts.singleAddress,
                doNotCheck: true,
                useNativeSegwit: !!opts.useNativeSegwit
            },
            (err, secret) => {
                if (err) console.log(err);
                should.not.exist(err);

                if (n > 1) {
                    should.exist(secret);
                }

                async.series(
                    [
                        next => {
                            async.each(
                                _.range(1, n),
                                (i, cb) => {
                                    keys[i] = new Key(keyOpts);
                                    clients[i].fromString(
                                        keys[i].createCredentials(null, {
                                            coin: coin,
                                            network: network,
                                            account: 0,
                                            n: n,
                                            addressType: opts.addressType
                                        })
                                    );
                                    clients[i].joinWallet(
                                        secret,
                                        'copayer ' + i,
                                        {
                                            coin: coin
                                        },
                                        cb
                                    );
                                },
                                next
                            );
                        },
                        next => {
                            async.each(
                                _.range(n),
                                (i, cb) => {
                                    clients[i].openWallet(cb);
                                },
                                next
                            );
                        }
                    ],
                    err => {
                        should.not.exist(err);
                        return cb({
                            m: m,
                            n: n,
                            secret: secret
                        });
                    }
                );
            }
        );
    },
    tamperResponse: (clients, method, url, args, tamper, cb) => {
        clients = [].concat(clients);
        // Use first client to get a clean response from server
        clients[0].request.doRequest(method, url, args, false, (err, result) => {
            should.not.exist(err);
            tamper(result);
            // Return tampered data for every client in the list
            _.each(clients, client => {
                client.request.doRequest = sinon
                    .stub()
                    .withArgs(method, url)
                    .yields(null, result);
            });
            return cb();
        });
    },
    createAndPublishTxProposal: (client, opts, cb) => {
        if (!opts.outputs) {
            opts.outputs = [
                {
                    toAddress: opts.toAddress,
                    amount: opts.amount
                }
            ];
        }
        client.createTxProposal(opts, (err, txp) => {
            if (err) return cb(err);
            client.publishTxProposal(
                {
                    txp: txp
                },
                cb
            );
        });
    },
    newDb: (extra, cb) => {
        extra = extra || '';
        mongodb.MongoClient.connect(config.mongoDb.uri + extra, (err, in_db) => {
            if (err) return cb(err);
            in_db.dropDatabase(err => {
                return cb(err, in_db);
            });
        });
    }
};


const blockchainExplorerMock = {
    register: sinon.stub().callsArgWith(1, null, null),
    getCheckData: sinon.stub().callsArgWith(1, null, { sum: 100 }),
    addAddresses: sinon.stub().callsArgWith(2, null, null),
    getUtxos: (wallet, height, cb) => {
        return cb(null, _.cloneDeep(blockchainExplorerMock.utxos));
    },
    getAddressUtxos: (address, height, cb) => {
        var selected = _.filter(blockchainExplorerMock.utxos, utxo => {
            return _.includes(address, utxo.address);
        });

        return cb(null, _.cloneDeep(selected));
    },
    setUtxo: (address, amount, m, confirmations) => {
        var B = Bitcore_[address.coin];
        var scriptPubKey;
        switch (address.type) {
            case Constants.SCRIPT_TYPES.P2SH:
                scriptPubKey = address.publicKeys ? B.Script.buildMultisigOut(address.publicKeys, m).toScriptHashOut() : '';
                break;
            case Constants.SCRIPT_TYPES.P2WPKH:
            case Constants.SCRIPT_TYPES.P2PKH:
                scriptPubKey = B.Script.buildPublicKeyHashOut(address.address);
                break;
            case Constants.SCRIPT_TYPES.P2WSH:
                scriptPubKey = B.Script.buildWitnessV0Out(address.address);
                break;
        }
        should.exist(scriptPubKey);
        blockchainExplorerMock.utxos.push({
            txid: new Bitcore.crypto.Hash.sha256(Buffer.alloc(Math.random() * 100000)).toString('hex'),
            outputIndex: 0,
            amount: amount,
            satoshis: amount * 1e8,
            address: address.address,
            scriptPubKey: scriptPubKey.toBuffer().toString('hex'),
            confirmations: _.isUndefined(confirmations) ? Math.floor(Math.random() * 100 + 1) : +confirmations
        });
    },
    supportsGrouping: () => {
        return false;
    },
    getBlockchainHeight: cb => {
        return cb(null, 1000);
    },
    broadcast: (raw, cb) => {
        blockchainExplorerMock.lastBroadcasted = raw;

        let hash;
        try {
            let tx = new Bitcore.Transaction(raw);
            if (_.isEmpty(tx.outputs)) {
                throw 'no bitcoin';
            }
            hash = tx.id;
            // btc/bch
            return cb(null, hash);
        } catch (e) {
            // try eth
            hash = CWC.Transactions.getHash({
                tx: raw[0],
                chain: 'ETH'
            });
            return cb(null, hash);
        }
    },
    setHistory: txs => {
        blockchainExplorerMock.txHistory = txs;
    },
    getTransaction: (txid, cb) => {
        return cb();
    },
    getTransactions: (wallet, startBlock, cb) => {
        var list = [].concat(blockchainExplorerMock.txHistory);
        // -1 = mempool, always included in server' s v8.js
        list = _.filter(list, x => {
            return x.height >= startBlock || x.height == -1;
        });
        return cb(null, list);
    },
    getAddressActivity: (address, cb) => {
        var activeAddresses = _.map(blockchainExplorerMock.utxos || [], 'address');
        return cb(null, _.includes(activeAddresses, address));
    },
    setFeeLevels: levels => {
        blockchainExplorerMock.feeLevels = levels;
    },
    estimateFee: (nbBlocks, cb) => {
        var levels = {};
        _.each(nbBlocks, nb => {
            var feePerKb = blockchainExplorerMock.feeLevels[nb];
            levels[nb] = _.isNumber(feePerKb) ? feePerKb / 1e8 : -1;
        });

        return cb(null, levels);
    },
    estimateGas: (nbBlocks, cb) => {
        return cb(null, '20000000000');
    },
    getBalance: (nbBlocks, cb) => {
        return cb(null, {
            unconfirmed: 0,
            confirmed: 20000000000 * 5,
            balance: 20000000000 * 5
        });
    },
    getTransactionCount: (addr, cb) => {
        return cb(null, 0);
    },
    reset: () => {
        blockchainExplorerMock.utxos = [];
        blockchainExplorerMock.txHistory = [];
        blockchainExplorerMock.feeLevels = [];
    }
};


module.exports = {
    helpers,
    blockchainExplorerMock
  }

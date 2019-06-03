'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');

var Bitcore = require('bitcore-lib');
var Mnemonic = require('bitcore-mnemonic');
var sjcl = require('sjcl');
var log = require('./log');
const async = require('async');
const Uuid = require('uuid');

var Common = require('./common');
var Errors = require('./errors');
var Constants = Common.Constants;
var Utils = Common.Utils;
var Credentials = require('./credentials');


function Key() {
  this.version = 1;
  this.use0forBCH = false;
  this.use44forMultisig = false;
  this.compliantDerivation = true;
  this.id = Uuid.v4();
};


Key.match = (a,b) => {
  return a.id == b.id;
};

Key.FIELDS = [
  'xPrivKey',             // obsolte
  'xPrivKeyEncrypted',   // obsolte
  'mnemonic',
  'mnemonicEncrypted',
  'mnemonicHasPassphrase',

  // data for derived credentials.
  'use0forBCH',          // use the 0 coin' path element in BCH  (legacy)
  'use44forMultisig',    // use the purpose 44' for multisig wallts (legacy)
  'version',
  'id',
];


const wordsForLang = {
  'en': Mnemonic.Words.ENGLISH,
  'es': Mnemonic.Words.SPANISH,
  'ja': Mnemonic.Words.JAPANESE,
  'zh': Mnemonic.Words.CHINESE,
  'fr': Mnemonic.Words.FRENCH,
  'it': Mnemonic.Words.ITALIAN,
};

// we always set 'livenet' for xprivs. it has not consecuences
// other than the serialization
const NETWORK = 'livenet';

Key.create = function(opts) {
  opts = opts || {};
  if (opts.language && !wordsForLang[opts.language]) throw new Error('Unsupported language');

  var m = new Mnemonic(wordsForLang[opts.language]);
  while (!Mnemonic.isValid(m.toString())) {
    m = new Mnemonic(wordsForLang[opts.language])
  };
  var x = new Key();
  x.xPrivKey = m.toHDPrivateKey(opts.passphrase, NETWORK).toString();
  x.mnemonic = m.phrase;
  x.mnemonicHasPassphrase = !!opts.passphrase;

  // bug backwards compatibility flags
  x.use0forBCH = opts.useLegacyCoinType;
  x.use44forMultisig = opts.useLegacyPurpose;

  x.compliantDerivation = !opts.nonCompliantDerivation;

  return x;
};

Key.fromMnemonic = function(words, opts) {
  $.checkArgument(words);
  if (opts) $.shouldBeObject(opts);
  opts = opts || {};

  var m = new Mnemonic(words);
  var x = new Key();
  x.xPrivKey = m.toHDPrivateKey(opts.passphrase, NETWORK).toString();
  x.mnemonic = words;
  x.mnemonicHasPassphrase = !!opts.passphrase;

  x.use0forBCH = opts.useLegacyCoinType;
  x.use44forMultisig = opts.useLegacyPurpose;

  x.compliantDerivation = !opts.nonCompliantDerivation;

  return x;
};

Key.fromExtendedPrivateKey = function(xPriv, opts) {
  $.checkArgument(xPriv);
  opts = opts || {};

  try {
    new Bitcore.HDPrivateKey(xPriv);
  } catch (e) {
    throw 'Invalid argument';
  }

  var x = new Key();
  x.xPrivKey = xPriv;
  x.mnemonic = null;
  x.mnemonicHasPassphrase = null;

  x.use44forMultisig = opts.useLegacyPurpose;
  x.use0forBCH = opts.useLegacyCoinType;

  x.compliantDerivation = !opts.nonCompliantDerivation;
  return x;
};



Key.fromObj = function(obj) {
  $.shouldBeObject(obj);

  var x = new Key();
  if (obj.version != x.version) {
    throw 'Bad Key version';
  }

  _.each(Key.FIELDS, function(k) {
    x[k] = obj[k];
  });

  $.checkState(x.xPrivKey || x.xPrivKeyEncrypted, "invalid input");
  return x;
};



Key.prototype.toObj = function() {
  var self = this;

  var x = {};
  _.each(Key.FIELDS, function(k) {
    x[k] = self[k];
  });
  return x;
};

Key.prototype.isPrivKeyEncrypted = function() {
  return (!!this.xPrivKeyEncrypted) && !this.xPrivKey;
};

Key.prototype.get = function(password) {
  var keys = {};

  if (this.isPrivKeyEncrypted()) {
    $.checkArgument(password, 'Private keys are encrypted, a password is needed');
    try {
      keys.xPrivKey = sjcl.decrypt(password, this.xPrivKeyEncrypted);

      if (this.mnemonicEncrypted) {
        keys.mnemonic = sjcl.decrypt(password, this.mnemonicEncrypted);
      }
    } catch (ex) {
      throw new Error('Could not decrypt');
    }
  } else {
    keys.xPrivKey = this.xPrivKey;
    keys.mnemonic = this.mnemonic;
  }
  return keys;
};

Key.prototype.encrypt = function(password, opts) {
  if (this.xPrivKeyEncrypted)
    throw new Error('Private key already encrypted');

  if (!this.xPrivKey)
    throw new Error('No private key to encrypt');

  this.xPrivKeyEncrypted = sjcl.encrypt(password, this.xPrivKey, opts);
  if (!this.xPrivKeyEncrypted)
    throw new Error('Could not encrypt');

  if (this.mnemonic)
    this.mnemonicEncrypted = sjcl.encrypt(password, this.mnemonic, opts);

  delete this.xPrivKey;
  delete this.mnemonic;
};

Key.prototype.decrypt = function(password) {
  if (!this.xPrivKeyEncrypted)
    throw new Error('Private key is not encrypted');

  try {
    this.xPrivKey = sjcl.decrypt(password, this.xPrivKeyEncrypted);
    if (this.mnemonicEncrypted) {
      this.mnemonic = sjcl.decrypt(password, this.mnemonicEncrypted);
    }
    delete this.xPrivKeyEncrypted;
    delete this.mnemonicEncrypted;
  } catch (ex) {
    log.error('error decrypting:', ex);
    throw new Error('Could not decrypt');
  }
};


Key.prototype.derive = function(password, path) {
  $.checkArgument(path, 'no path at derive()');
  var xPrivKey = new Bitcore.HDPrivateKey(this.get(password).xPrivKey,NETWORK);
  var deriveFn = this.compliantDerivation ? _.bind(xPrivKey.deriveChild, xPrivKey) : _.bind(xPrivKey.deriveNonCompliantChild, xPrivKey);
  return deriveFn(path);
};

function _checkCoin(coin) {
  if (!_.includes(['btc', 'bch'], coin)) throw new Error('Invalid coin');
};

function _checkNetwork(network) {
  if (!_.includes(['livenet', 'testnet'], network)) throw new Error('Invalid network');
};

/*
 * This is only used on "create"
 * no need to include/support
 * BIP45
 */

Key.prototype.getBaseAddressDerivationPath = function(opts) {
  $.checkArgument(opts, 'Need to provide options');

  let purpose = (opts.n == 1 || this.use44forMultisig) ? '44' : '48';
  var coinCode = '0';

  if (opts.network == 'testnet' ) {
    coinCode = '1';
  } else if (opts.coin == 'bch') {
    if (this.use0forBCH) {
      coinCode = '0';
    } else {
      coinCode = '145';
    }
  } else if (opts.coin == 'btc') {
    coinCode = '0';
  } else if (opts.coin == 'eth') {
    coinCode = '60';
  } else {
    throw new Error('unknown coin: ' + opts.coin);
  };

  return "m/" + purpose + "'/" + coinCode + "'/" + opts.account + "'";
};



/*
 * opts.coin
 * opts.network
 * opts.account
 * opts.n
 */

Key.prototype.createCredentials = function(password, opts) {
  opts = opts || {};

  if (password) 
    $.shouldBeString(password, 'provide password');

  _checkCoin(opts.coin);
  _checkNetwork(opts.network);
  $.shouldBeNumber(opts.account, 'Invalid account');
  $.shouldBeNumber(opts.n, 'Invalid n');

  $.shouldBeUndefined(opts.useLegacyCoinType);
  $.shouldBeUndefined(opts.useLegacyPurpose);

  let path = this.getBaseAddressDerivationPath(opts);
  let xPrivKey = this.derive(password, path);
  let requestPrivKey = this.derive(password, Constants.PATHS.REQUEST_KEY).privateKey.toString();

  if (opts.network == 'testnet') {

    // Hacky: BTC/BCH xPriv depends on network: This code is to
    // convert a livenet xPriv to a testnet xPriv
    let x = xPrivKey.toObject();
    x.network = 'testnet';
    delete x.xprivkey;
    delete x.checksum;
    x.privateKey = _.padStart(x.privateKey, 64, '0');
    xPrivKey = new Bitcore.HDPrivateKey(x);
  }

  return Credentials.fromDerivedKey({
    xPubKey: xPrivKey.hdPublicKey.toString(),
    coin: opts.coin,
    network: opts.network,
    account: opts.account,
    n: opts.n,
    rootPath: path,
    keyId: this.id,
    requestPrivKey: requestPrivKey,
    walletPrivKey: opts.walletPrivKey,
  });
};

/*
 * opts
 * opts.path
 * opts.requestPrivKey
 */

Key.prototype.createAccess = function(password, opts) {
  opts = opts || {};
  $.shouldBeString(opts.path);

  var requestPrivKey = new Bitcore.PrivateKey(opts.requestPrivKey || null);
  var requestPubKey = requestPrivKey.toPublicKey().toString();

  var xPriv =  this.derive(password, opts.path);
  var signature = Utils.signRequestPubKey(requestPubKey, xPriv);
  requestPrivKey = requestPrivKey.toString();

  return {
    signature,
    requestPrivKey,
  };
};

Key.prototype.sign = function(rootPath, txp, password) {
  $.shouldBeString(rootPath);
  if (this.isPrivKeyEncrypted() && !password) {
    return cb(new Errors.ENCRYPTED_PRIVATE_KEY);
  }
  var privs = [];
  var derived = {};

  var derived = this.derive(password, rootPath);
  var xpriv = new Bitcore.HDPrivateKey(derived);

  _.each(txp.inputs, function(i) {
    $.checkState(i.path, "Input derivation path not available (signing transaction)")
    if (!derived[i.path]) {
      derived[i.path] = xpriv.deriveChild(i.path).privateKey;
      privs.push(derived[i.path]);
    }
  });

  var t = Utils.buildTx(txp);
  var signatures = _.map(privs, function(priv, i) { 
    return t.getSignatures(priv);
  });

  signatures = _.map(_.sortBy(_.flatten(signatures), 'inputIndex'), function(s) {
    return s.signature.toDER().toString('hex');
  });

  return signatures;
};


/**
 * serverAssistedImport 
 * Imports  EXISTING wallets against BWS and return key & clients[] for each account / coin
 *
 * @param {Object} opts
 * @param {String} opts.words - mnemonic
 * @param {String} opts.xPrivKey - extended Private Key 
 * @param {Object} clientOpts  - BWS connection options (see
 * @returns {Callback} cb - Returns { err, key, clients[] }
 */

Key.serverAssistedImport = (opts, clientOpts, callback) => {
  var self = this;

  $.checkArgument(opts.words || opts.xPrivKey, "provide opts.words or opts.xPrivKey");

  let copayerIdAlreadyTested = {};
  function checkCredentials(key, opts, icb) {
    let c = key.createCredentials(null, {
      coin: opts.coin, 
      network: opts.network, 
      account: opts.account, 
      n: opts.n,
    });


    if (copayerIdAlreadyTested[c.copayerId]) {
      return  icb();
    } else {
     copayerIdAlreadyTested[c.copayerId] = true;
    }

    let client  = clientOpts.clientFactory ?  clientOpts.clientFactory() :  new Client(clientOpts);

    client.fromString(c);
    client.open(function(err) {
console.log('TRYING PATH:', c.rootPath, (err && err.message) ? err.message : 'FOUND!'); // TODO
      // Exists
      if (!err) return icb(null, client);
      if (err instanceof Errors.NOT_AUTHORIZED || 
        err instanceof Errors.WALLET_DOES_NOT_EXIST) {
        return icb();
      }
      return icb(err);
    })
  };
  
  function checkKey(key, cb) {
    let opts = [
      //coin, network,  multisig
      ['btc', 'livenet', ],          
      ['bch', 'livenet', ],          
      ['btc', 'livenet', true ],    
      ['bch', 'livenet', true ],    
    ];
    if (key.use44forMultisig) {
      //  testing old multi sig
      opts = opts.filter((x) => {
        return !x[2];
      });
    }

    if (key.use0forBCH) {
      //  testing BCH, old coin=0 wallets
      opts = opts.filter((x) => {
        return x[0] == 'bch';
      });
    }

    if (key.compliantDerivation) {
      // TESTNET
      let testnet = _.cloneDeep(opts);
      testnet.forEach((x) => { x[1] = 'testnet' });
      opts = opts.concat(testnet);
   } else {
      //  leave only BTC, and no testnet
      opts = opts.filter((x) => {
        return x[0] == 'btc';
      });
   }

    let clients = [];
    async.each(opts, 
      (x, next) => {
        let optsObj = {
          coin: x[0] ,
          network: x[1],
          account: 0,
          n: x[2] ? 2: 1,
        };
        // TODO OPTI: do not scan accounts if XX
        //
        // 1. check account 0
        checkCredentials(key, optsObj, (err, iclient) => {
          if (err) return next(err);
          if (!iclient) return next();
          clients.push(iclient);
          // Now, lets scan all accounts for the found client
          let cont = true, account = 1;
          async.whilst(() => {
            return cont;
          }, (icb) => {
            optsObj.account = account++;
            checkCredentials(key, optsObj, (err, iclient) => {
              if (err) return icb(err);
              cont = !!iclient;
              if (iclient) {
                clients.push(iclient);
              } else {
                // we do not allow accounts nr gaps in BWS. 
                cont = false;
              };
              return icb();
            });
          }, (err) => {
            return next(err);
          });
        });
      }, 
      (err) => {
        if (err) return cb(err);
        return cb(null, clients);
      });
  };


  let sets = [ 
    {
      // current wallets: /[44,48]/[0,145]'/
      compliantDerivation: true,
      useLegacyCoinType: false,
      useLegacyPurpose: false,
    },
    {
      // older bch wallets: /[44,48]/[0,0]'/
      compliantDerivation: true,
      useLegacyCoinType: true,
      useLegacyPurpose: false,
    },
    {
      // older BTC/BCH  multisig wallets: /[44]/[0,145]'/
      compliantDerivation: true,
      useLegacyCoinType: false,
      useLegacyPurpose: true,
    },
    {
      // not that // older multisig BCH wallets: /[44]/[0]'/
      compliantDerivation: true,
      useLegacyCoinType: true,
      useLegacyPurpose: true,
    },
 
    {
      // old BTC no-comp wallets: /44'/[0]'/
      compliantDerivation: false,
      useLegacyPurpose: true,
    },
  ];

  let s, resultingClients = [], k;
  async.whilst(() => {

    if (! _.isEmpty(resultingClients))
      return false;

    s = sets.shift();
    if (!s) 
      return false;

    try {
      if (opts.words) { 
        k  = Key.fromMnemonic(opts.words, s);
      } else {
        k  = Key.fromExtendedPrivateKey(opts.xPrivKey, s);
      }
    } catch (e) {
      log.info('Backup error:', e);
      return callback(new Errors.INVALID_BACKUP);
    }
    return true;
  }, (icb) => {
    checkKey(k, (err, clients) => {
      if (err) return icb(err);

      if (clients && clients.length) {
        resultingClients = clients;
      }
      return icb();
    });
  }, (err) => {
    if (err) return callback(err);

    if (_.isEmpty(resultingClients)) 
      k=null;

    return callback(null, k, resultingClients);
  });
};




module.exports = Key;

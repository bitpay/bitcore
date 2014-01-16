require('classtool');

function ClassSpec(b) {
  var coinUtil = require('./util/util');
  var timeUtil = require('./util/time');
  var KeyModule = require('./Key');
  var SIN = require('./SIN').class();

  function SINKey(cfg) {
    if (typeof cfg != 'object')
      cfg = {};

    this.created = cfg.created;
    this.privKey = cfg.privKey;
  };

  SINKey.prototype.generate = function() {
    this.privKey = KeyModule.Key.generateSync();
    this.created = timeUtil.curtime();
  };

  SINKey.prototype.pubkeyHash = function() {
    return coinUtil.sha256ripe160(this.privKey.public);
  };

  SINKey.prototype.storeObj = function() {
    var pubKey = this.privKey.public.toString('hex');
    var pubKeyHash = this.pubkeyHash();
    var sin = new SIN(SIN.SIN_EPHEM, pubKeyHash);
    var obj = {
      created: this.created,
      priv: this.privKey.private.toString('hex'),
      pub: pubKey,
      sin: sin.toString(),
    };

    return obj;
  };

  return SINKey;
};
module.defineClass(ClassSpec);


require('classtool');

function ClassSpec(b) {
	var coinUtil = require('./util/util');
	var timeUtil = require('./util/time');
	var KeyModule = require('./Key');
	var Address = require('./Address').class();

	function WalletKey(cfg) {
		this.network = cfg.network;	// required
		this.created = cfg.created;
		this.privKey = cfg.privKey;
	};

	WalletKey.prototype.generate = function() {
		this.privKey = KeyModule.Key.generateSync();
		this.created = timeUtil.curtime();
	};

	WalletKey.prototype.regenerate = function() {
		this.privKey.regenerateSync();
		this.created = timeUtil.curtime();
	};

	WalletKey.prototype.storeObj = function() {
		var pubKey = this.privKey.public.toString('hex');
		var pubKeyHash = coinUtil.sha256ripe160(this.privKey.public);
		var addr = new Address(this.network.addressPubkey, pubKeyHash);
		var obj = {
			created: this.created,
			priv: this.privKey.private.toString('hex'),
			pub: pubKey,
			addr: addr.toString(),
		};

		return obj;
	};

	WalletKey.prototype.fromObj = function(obj) {
		this.created = obj.created;
		this.privKey = new KeyModule.Key();
		this.privKey.private = new Buffer(obj.priv, 'hex');
	};

	return WalletKey;
};
module.defineClass(ClassSpec);


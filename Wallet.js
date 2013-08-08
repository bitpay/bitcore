require('classtool');

function ClassSpec(b) {
	var fs = require('fs');
	var EncFile = require('./util/EncFile');
	var networks = require('./networks');
	var ENC_METHOD = 'aes-256-cbc';

	var skeleton = {
		client: 'libcoin',
		client_version: '0.0.1',
		network: 'testnet',
		version: 1,
		best_hash: null,
		best_height: -1,
		keys: [],
	};

	function Wallet(cfg) {
		if (typeof cfg !== 'object')
			cfg = {};

		// deep copy (no references)
		if (cfg.datastore)
			this.datastore = JSON.parse(JSON.stringify(cfg.datastore));
		else
			this.datastore = JSON.parse(JSON.stringify(skeleton));

		this.network = undefined;
		this.dirty = cfg.dirty || true;
	};

	Wallet.prototype.readSync = function(filename, passphrase) {
		this.datastore = EncFile.readJFileSync(ENC_METHOD,
						       passphrase, filename);
		this.dirty = false;
	};

	Wallet.prototype.writeSync = function(filename, passphrase) {
		var tmp_fn = filename + ".tmp";

		EncFile.writeJFileSync(ENC_METHOD, passphrase, tmp_fn,
				       this.datastore);
		fs.renameSync(tmp_fn, filename);

		this.dirty = false;
	};

	Wallet.prototype.setNetwork = function(netname) {
		if (!netname)
			netname = this.datastore.network;

		switch (netname) {
		case "mainnet":
		case "livenet":
			this.network = networks.livenet;
			break;
		case "testnet":
			this.network = networks.testnet;
			break;
		default:
			throw new Error("Unsupported network");
		}

		// store+canonicalize name
		this.datastore['network'] = this.network.name;
		this.dirty = true;
	};

	Wallet.prototype.addKey = function(wkey) {
		this.datastore.keys.push(wkey);
		this.dirty = true;
	};

	return Wallet;
};
module.defineClass(ClassSpec);


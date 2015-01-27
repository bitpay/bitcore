'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var async = require('async');
var log = require('npmlog');
log.debug = log.verbose;
var Bitcore = require('bitcore');
var Explorers = require('bitcore-explorers');

var Lock = require('./lock');
var Storage = require('./storage');

var Wallet = require('./model/wallet');
var Copayer = require('./model/copayer');
var Address = require('./model/address');
var TxProposal = require('./model/txproposal');

/**
 * Creates an instance of the Copay server.
 * @constructor
 */
function CopayServer(opts) {
	opts = opts || {};
	this.storage = new Storage(opts);
};


/**
 * Creates a new wallet.
 * @param {Object} opts
 * @param {string} opts.id - The wallet id.
 * @param {string} opts.name - The wallet name.
 * @param {number} opts.m - Required copayers.
 * @param {number} opts.n - Total copayers.
 * @param {string} opts.pubKey - Public key to verify copayers joining have access to the wallet secret.
 * @param {string} [opts.network = 'livenet'] - The Bitcoin network for this wallet.
 */
CopayServer.prototype.createWallet = function (opts, cb) {
	var self = this;

	self.getWallet({ id: opts.id }, function (err, wallet) {
		if (err) return cb(err);
		if (wallet) return cb('Wallet already exists');

		var wallet = new Wallet({
			id: opts.id,
			name: opts.name,
			m: opts.m,
			n: opts.n,
			network: opts.network || 'livenet',
			pubKey: opts.pubKey,
		});
		
		self.storage.storeWallet(wallet, cb);
	});
};

/**
 * Retrieves a wallet from storage.
 * @param {Object} opts
 * @param {string} opts.id - The wallet id.
 * @param {truthy} opts.includeCopayers - Fetch wallet along with list of copayers.
 * @returns {Object} wallet 
 */
 CopayServer.prototype.getWallet = function (opts, cb) {
	var self = this;

	self.storage.fetchWallet(opts.id, function (err, wallet) {
		if (err || !wallet) return cb(err);
		if (opts.includeCopayers) {
			self.storage.fetchCopayers(wallet.id, function (err, copayers) {
				if (err) return cb(err);
				wallet.copayers = copayers || [];
				return cb(null, wallet);
			});
		} else {
			return cb(null, wallet);
		}
	});
};

/**
 * Joins a wallet in creation.
 * @param {Object} opts
 * @param {string} opts.walletId - The wallet id.
 * @param {string} opts.id - The copayer id.
 * @param {string} opts.name - The copayer name.
 * @param {number} opts.xPubKey - Extended Public Key for this copayer.
 * @param {number} opts.xPubKeySignature - Signature of xPubKey using the wallet pubKey.
 */
 CopayServer.prototype.joinWallet = function (opts, cb) {
	var self = this;

	Lock.get(opts.walletId, function (lock) {
		var _cb = function (err, res) {
			cb(err, res);
			lock.free();
		};

		self.getWallet({ id: opts.walletId, includeCopayers: true }, function (err, wallet) {
			if (err) return _cb(err);
			if (!wallet) return _cb('Wallet not found');
			if (_.find(wallet.copayers, { xPubKey: opts.xPubKey })) return _cb('Copayer already in wallet');
			if (wallet.copayers.length == wallet.n) return _cb('Wallet full');

			// TODO: validate copayer's extended public key using the public key from this wallet
			// Note: use Bitcore.crypto.ecdsa .verify()

			var copayer = new Copayer({
				id: opts.id,
				name: opts.name,
				xPubKey: opts.xPubKey,
				xPubKeySignature: opts.xPubKeySignature,
			});
			
			self.storage.storeCopayer(wallet.id, copayer, function (err) {
				if (err) return _cb(err);
				if ((wallet.copayers.length + 1) < wallet.n) return _cb();

				wallet.status = 'complete';
				wallet.publicKeyRing = _.pluck(wallet.copayers, 'xPubKey');
				wallet.publicKeyRing.push(copayer.xPubKey);
				self.storage.storeWallet(wallet, _cb);
			});
		});

	});
};

CopayServer.prototype._doCreateAddress = function (pkr, index, isChange) {
	throw 'not implemented';
};

/**
 * Creates a new address.
 * @param {Object} opts
 * @param {string} opts.walletId - The wallet id.
 * @param {truthy} opts.isChange - Indicates whether this is a regular address or a change address.
 * @returns {Address} address 
 */
 CopayServer.prototype.createAddress = function (opts, cb) {
	var self = this;

	self.getWallet({ id: opts.walletId }, function (err, wallet) {
		if (err) return cb(err);
		if (!wallet) return cb('Wallet not found');
	
		var index = wallet.addressIndex++;
		self.storage.storeWallet(wallet, function (err) {
			if (err) return cb(err);

			var address = self._doCreateAddress(wallet.publicKeyRing, index, opts.isChange);
			self.storage.storeAddress(opts.walletId, address, function (err) {
				if (err) return cb(err);

				return cb(null, address);
			});
		});
	});
};

CopayServer.prototype._verifyMessageSignature = function (copayerId, message, signature) {
	throw 'not implemented';
};

CopayServer.prototype._getBlockExplorer = function (provider, network) {
	var url;

	switch (provider) {
		default:
		case 'insight':
			switch (network) {
				default:
				case 'livenet':
					url = 'https://insight.bitpay.com:443';
					break;
				case 'testnet':
					url = 'https://test-insight.bitpay.com:443'
					break;
			}
			return new Explorers.Insight(url, network);
			break;
	}
};

CopayServer.prototype._getUtxos = function (opts, cb) {
	var self = this;

	// Get addresses for this wallet
	self.storage.getAddresses(opts.walletId, function (err, addresses) {
		if (err) return cb(err);
		if (addresses.length == 0) return cb('The wallet has no addresses');

		var addresses = _.pluck(addresses, 'address');

		var bc = self._getBlockExplorer('insight', opts.network);
		bc.getUnspentUtxos(addresses, function (err, utxos) {
			if (err) return cb(err);

			// TODO: filter 'locked' utxos

			return cb(null, utxos);
		});
	});
};

CopayServer.prototype._doCreateTx = function (copayerId, toAddress, amount, changeAddress, utxos, cb) {
	var tx = new TxProposal({
		creatorId: copayerId,
		toAddress: toAddress,
		amount: amount,
		changeAddress: changeAddress,
		inputs: utxos,
	});

	tx.raw = new Bitcore.Transaction()
		.from(tx.inputs)
		.to(tx.toAddress, tx.amount)
		.change(tx.changeAddress);

	return tx;
};


/**
 * Creates a new transaction proposal.
 * @param {Object} opts
 * @param {string} opts.walletId - The wallet id.
 * @param {string} opts.copayerId - The wallet id.
 * @param {truthy} opts.otToken - A one-time token used to avoid reply attacks.
 * @param {string} opts.toAddress - Destination address.
 * @param {number} opts.amount - Amount to transfer in satoshi.
 * @param {string} opts.message - A message to attach to this transaction.
 * @param {string} opts.requestSignature - Signature of the request (toAddress + amount + otToken).
 * @returns {TxProposal} Transaction proposal. 
 */
CopayServer.prototype.createTx = function (opts, cb) {
	// Client generates a unique token and signs toAddress + amount + token.
	// This way we authenticate + avoid replay attacks.
	var self = this;

	self.getWallet({ id: opts.walletId }, function (err, wallet) {
		if (err) return cb(err);
		if (!wallet) return cb('Wallet not found');

		var msg = '' + opts.toAddress + opts.amount + opts.otToken;
		if (!self._verifyMessageSignature(opts.copayerId, msg, opts.requestSignature)) return cb('Invalid request');

		self._getUtxos({ walletId: wallet.id }, function (err, utxos) {
			if (err) return cb('Could not retrieve UTXOs');
			
			self._doCreateTx(opts.copayerId, opts.toAddress, opts.amount, opts.changeAddress, utxos, function (err, tx) {
				if (err) return cb('Could not create transaction');

				self.storage.storeTx(tx, function (err) {
					if (err) return cb(err);

					return cb(null, tx);
				});
			});
		});
	});
}; 

CopayServer.prototype.getPendingTxs = function (opts, cb) {
	var self = this;

	//self.storage.get
};


module.exports = CopayServer;

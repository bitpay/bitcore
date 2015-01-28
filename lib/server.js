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
 * @param {Object} opts
 * @param {Storage} [opts.storage] - The storage provider.
 */
function CopayServer(opts) {
	opts = opts || {};
	this.storage = opts.storage || new Storage();
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

	self.storage.fetchWallet(opts.id, function (err, wallet) {
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
 * @returns {Object} wallet 
 */
 CopayServer.prototype.getWallet = function (opts, cb) {
	var self = this;

	self.storage.fetchWallet(opts.id, function (err, wallet) {
		if (err) return cb(err);
		if (!wallet) return cb('Wallet not found');

		return cb(null, wallet);
	});
};


CopayServer.prototype._runLocked = function (walletId, cb, task) {
	var self = this;

	Lock.get(walletId, function (lock) {
		var _cb = function () {
			cb.apply(null, arguments);
			lock.free();
		};
		task(_cb);
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

	self._runLocked(opts.walletId, cb, function (cb) {
		self.getWallet({ id: opts.walletId }, function (err, wallet) {
			if (err || !wallet) return cb(err);
			if (_.find(wallet.copayers, { xPubKey: opts.xPubKey })) return cb('Copayer already in wallet');
			if (wallet.copayers.length == wallet.n) return cb('Wallet full');
			// TODO: validate copayer's extended public key using the public key from this wallet
			// Note: use Bitcore.crypto.ecdsa .verify()

			var copayer = new Copayer({
				id: opts.id,
				name: opts.name,
				xPubKey: opts.xPubKey,
				xPubKeySignature: opts.xPubKeySignature,
			});
			
			wallet.addCopayer(copayer);

			self.storage.storeWallet(wallet, function (err) {
				if (err) return cb(err);

				return cb();
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

	self._runLocked(opts.walletId, cb, function (cb) {
		self.getWallet({ id: opts.walletId }, function (err, wallet) {
			if (err || !wallet) return cb(err);
		
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
	});
};

/**
 * Verifies that a given message was actually sent by an authorized copayer.
 * @param {Object} opts
 * @param {string} opts.walletId - The wallet id.
 * @param {string} opts.copayerId - The wallet id.
 * @param {string} opts.message - The message to verify.
 * @param {string} opts.signature - The signature of message to verify.
 * @returns {truthy} The result of the verification.
 */
CopayServer.prototype.verifyMessageSignature = function (opts, cb) {
	var self = this;

	self.getWallet({ id: opts.walletId }, function (err, wallet) {
		if (err || !wallet) return cb(err);

		var copayer = wallet.getCopayer(opts.copayerId);
		if (!copayer) return cb('Copayer not found');

		var isValid = self._doVerifyMessageSignature(copayer.xPubKey, opts.message, opts.signature);
		return cb(null, isValid);
	});
};

CopayServer.prototype._doVerifyMessageSignature = function (pubKey, message, signature) {
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
	self.storage.fetchAddresses(opts.walletId, function (err, addresses) {
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
 * @param {string} opts.toAddress - Destination address.
 * @param {number} opts.amount - Amount to transfer in satoshi.
 * @param {string} opts.message - A message to attach to this transaction.
 * @returns {TxProposal} Transaction proposal. 
 */
CopayServer.prototype.createTx = function (opts, cb) {
	var self = this;

	self.getWallet({ id: opts.walletId }, function (err, wallet) {
		if (err || !wallet) return cb(err);

		self._getUtxos({ walletId: wallet.id }, function (err, utxos) {
			if (err) return cb(err);
			
			var tx = self._doCreateTx(opts.copayerId, opts.toAddress, opts.amount, opts.changeAddress, utxos);

			self.storage.storeTx(tx, function (err) {
				if (err) return cb(err);

				return cb(null, tx);
			});
		});
	});
}; 

CopayServer.prototype._broadcastTx = function (tx, cb) {
	cb = cb || function () {};

	throw 'not implemented';
};

/**
 * Sign a transaction proposal.
 * @param {Object} opts
 * @param {string} opts.walletId - The wallet id.
 * @param {string} opts.copayerId - The wallet id.
 * @param {string} opts.txProposalId - The identifier of the transaction.
 * @param {string} opts.signature - The signature of the tx for this copayer.
 */
CopayServer.prototype.signTx = function (opts, cb) {
	var self = this;

	self.getWallet({ id: opts.walletId }, function (err, wallet) {
		if (err || !wallet) return cb(err);

		self.fetchTx(wallet.id, opts.txProposalId, function (err, tx) {
			if (err) return cb(err);
			if (!tx) return cb('Transaction proposal not found');
			var action = _.find(tx.actions, { copayerId: opts.copayerId });
			if (action) return cb('Copayer already acted upon this transaction proposal');
			if (tx.status != 'pending') return cb('The transaction proposal is not pending');

			tx.sign(opts.copayerId, opts.signature);
			if (tx.isRejected()) {
				tx.status = 'rejected';
			} else if (tx.isAccepted()) {
				tx.status = 'accepted';
			}
			self.storage.storeTx(wallet.id, tx, function (err) {
				if (err) return cb(err);

				if (tx.status == 'accepted');
				self._broadcastTx(tx);

				return cb();
			});
		});
	});
}; 


/**
 * Retrieves all pending transaction proposals.
 * @param {Object} opts
 * @param {string} opts.walletId - The wallet id.
 * @param {string} opts.copayerId - The wallet id.
 * @returns {TxProposal[]} Transaction proposal. 
 */
CopayServer.prototype.getPendingTxs = function (opts, cb) {
	var self = this;

	throw 'not implemented';	
};


module.exports = CopayServer;


var fs = require('fs');
var crypto = require('crypto');
var zlib = require('zlib');

exports.readFileSync = function(enc_method, enc_passphrase, filename)
{
	var crypted = fs.readFileSync(filename, 'binary');

	var decipher = crypto.createDecipher(enc_method, enc_passphrase);
	var dec = decipher.update(crypted, 'binary', 'binary');
	dec += decipher.final('binary');
	return dec;
};

exports.readJFileSync = function(enc_method, enc_passphrase, filename)
{
	var raw = this.readFileSync(enc_method, enc_passphrase, filename);
	return JSON.parse(raw);
};

exports.writeFileSync = function(enc_method, enc_passphrase, filename, data)
{
	var cipher = crypto.createCipher(enc_method, enc_passphrase);
	var crypted = cipher.update(data, 'binary', 'binary');
	crypted += cipher.final('binary');

	fs.writeFileSync(filename, crypted, 'binary');

	return true;
};

exports.writeJFileSync = function(enc_method, enc_passphrase, filename, obj)
{
	var raw = JSON.stringify(obj);
	return this.writeFileSync(enc_method, enc_passphrase, filename, raw);
};


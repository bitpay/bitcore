var base58check = require('./base58check');
var constants   = require('./constants');
var Hash        = require('./hash');
var Pubkey      = require('./pubkey');
var Script      = require('./script');
var Random      = require('./random');

function Identity(buf) {
  // TODO: instantiate identities without providing any configuration
  if (!(this instanceof Identity)) return new Identity(buf);

  if (Buffer.isBuffer(buf)) {
    this.fromBuffer(buf);
  } else if (typeof buf === 'string') {
    var str = buf;
    this.fromString(str);
  } else if (buf) {
    var obj = buf;
    this.set(obj);
  }
};

Identity.prototype.set = function(obj) {
  this.hashbuf    = obj.hashbuf     || this.hashbuf     || null;
  this.networkstr = obj.networkstr  || this.networkstr  || 'ephemeral';
  this.typestr    = obj.typestr     || this.typestr     || 'identity';
  return this;
};

Identity.prototype.fromBuffer = function(buf) {
  // Identities are prefix + type + key
  if (buf.length !== 1 + 1 + 20)
    throw new Error('Identity buffers must be exactly 22 bytes (was '+buf.length+')');
  
  var prefix  = buf[0];
  var version = buf[1];

  if (version === constants['ephemeral']['identity']) {
    this.networkstr = 'ephemeral';
    this.typestr = 'identity';
  } else if (version === constants['mainnet']['identity']) {
    this.networkstr = 'mainnet';
    this.typestr = 'identity';
  } else if (version === constants['testnet']['identity']) {
    this.networkstr = 'testnet';
    this.typestr = 'identity';
  } else {
    this.networkstr = 'unknown';
    this.typestr = 'unknown';
  }
  
  if (prefix !== constants['ephemeral']['prefix'])
    throw new Error('Identity buffers must contain an identity prefix ('+constants['ephemeral']['prefix']+', was '+ prefix.toString() + ')');

  this.hashbuf = buf.slice( 2 );

  return this;
};

Identity.prototype.fromHashbuf = function(hashbuf, networkstr, typestr) {
  if (hashbuf.length !== 20)
    throw new Error('hashbuf must be exactly 20 bytes');
  this.hashbuf    = hashbuf;
  this.networkstr = networkstr || 'ephemeral';
  this.typestr    = typestr    || 'identity';
  return this;
};

Identity.prototype.fromPubkey = function(pubkey, networkstr) {
  this.hashbuf    = Hash.sha256ripemd160( pubkey.toBuffer() );
  this.networkstr = networkstr || 'ephemeral';
  this.typestr    = 'identity';
  return this;
};

Identity.prototype.fromString = function(str) {
  var buf = base58check.decode(str);
  return this.fromBuffer(buf);
}

Identity.isValid = function(addrstr) {
  try {
    var address = new Identity().fromString( addrstr );
  } catch (e) {
    return false;
  }
  return address.isValid();
};

Identity.prototype.isValid = function() {
  try {
    this.validate();
    return true;
  } catch (e) {
    return false;
  }
};

Identity.prototype.toBuffer = function() {
  var prefix  = new Buffer([ constants[ this.networkstr ][ 'prefix' ] ])
  var version = new Buffer([ constants[ this.networkstr ][ this.typestr ] ]);;
  var buf     = Buffer.concat([ prefix , version, this.hashbuf ]);
  return buf;
};

Identity.prototype.toString = function() {
  return base58check.encode( this.toBuffer() );
};

Identity.prototype.validate = function() {
  if (!Buffer.isBuffer(this.hashbuf) || this.hashbuf.length !== 20)
    throw new Error('hash must be a buffer of 20 bytes');
  if (['ephemeral', 'mainnet', 'testnet'].indexOf( this.networkstr ))
    throw new Error('networkstr must be "ephemeral", "mainnet", or "testnet"');
  if (this.typestr !== 'identity')
    throw new Error('typestr must be "identity"');
  return this;
};

module.exports = Identity;

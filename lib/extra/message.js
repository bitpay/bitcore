var ECDSA = require('./ecdsa');
var Keypair = require('./keypair');
var Privkey = require('./privkey');
var Pubkey = require('./pubkey');
var BufferWriter = require('./bufferwriter');
var Hash = require('./hash');
var Address = require('./address');
var Signature = require('./signature');

var Message = function Message(obj) {
  if (!(this instanceof Message))
    return new Message(obj);
  if (obj)
    this.set(obj);
};

Message.prototype.set = function(obj) {
  this.messagebuf = obj.messagebuf || this.messagebuf;
  this.keypair = obj.keypair || this.keypair;
  this.sig = obj.sig || this.sig;
  this.address = obj.address || this.address;
  this.verified = typeof obj.verified !== 'undefined' ? obj.verified : this.verified;
  return this;
};

Message.magicBytes = new Buffer('Bitcoin Signed Message:\n');

Message.magicHash = function(messagebuf) {
  if (!Buffer.isBuffer(messagebuf))
    throw new Error('messagebuf must be a buffer');
  var bw = new BufferWriter();
  bw.writeVarintNum(Message.magicBytes.length);
  bw.write(Message.magicBytes);
  bw.writeVarintNum(messagebuf.length);
  bw.write(messagebuf);
  var buf = bw.concat();

  var hashbuf = Hash.sha256sha256(buf);

  return hashbuf;
};

Message.sign = function(messagebuf, keypair) {
  var m = Message({messagebuf: messagebuf, keypair: keypair});
  m.sign();
  var sigbuf = m.sig.toCompact();
  var sigstr = sigbuf.toString('base64');
  return sigstr;
};

Message.verify = function(messagebuf, sigstr, address) {
  var sigbuf = new Buffer(sigstr, 'base64');
  var message = new Message();
  message.messagebuf = messagebuf;
  message.sig = Signature().fromCompact(sigbuf);
  message.address = address;

  return message.verify().verified;
};

Message.prototype.sign = function() {
  var hashbuf = Message.magicHash(this.messagebuf);
  var ecdsa = ECDSA({hashbuf: hashbuf, keypair: this.keypair});
  ecdsa.signRandomK();
  ecdsa.calci();
  this.sig = ecdsa.sig;
  return this;
};

Message.prototype.verify = function() {
  var hashbuf = Message.magicHash(this.messagebuf);

  var ecdsa = new ECDSA();
  ecdsa.hashbuf = hashbuf;
  ecdsa.sig = this.sig;
  ecdsa.keypair = new Keypair();
  ecdsa.keypair.pubkey = ecdsa.sig2pubkey();

  if (!ecdsa.verify()) {
    this.verified = false;
    return this;
  }

  var address = Address().fromPubkey(ecdsa.keypair.pubkey, undefined, this.sig.compressed);
  //TODO: what if livenet/testnet mismatch?
  if (address.hashbuf.toString('hex') === this.address.hashbuf.toString('hex'))
    this.verified = true;
  else
    this.verified = false;

  return this;
};

module.exports = Message;

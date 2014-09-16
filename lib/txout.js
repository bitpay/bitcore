var BN = require('./bn');
var BufferReader = require('./bufferreader');
var BufferWriter = require('./bufferwriter');
var Varint = require('./varint');
var Script = require('./script');

var Txout = function Txout(valuebn, varint, script) {
  if (!(this instanceof Txout))
    return new Txout(valuebn, varint, script);
  if (valuebn instanceof BN) {
    this.set({
      valuebn: valuebn,
      varint: varint,
      script: script
    });
  } else if (valuebn) {
    var obj = valuebn;
    this.set(obj);
  }
};

Txout.prototype.set = function(obj) {
  this.valuebn = obj.valuebn || this.valuebn;
  this.varint = obj.varint || this.varint;
  this.script = obj.script || this.script;
  return this;
};

Txout.prototype.fromBuffer = function(buf) {
  return this.fromBufferReader(BufferReader(buf));
};

Txout.prototype.fromBufferReader = function(br) {
  this.valuebn = br.readUInt64LEBN();
  this.varint = Varint(br.readVarintNum());
  this.script = Script().fromBuffer(br.buffer(this.varint.toNumber()));
  return this;
};

Txout.prototype.toBuffer = function() {
  var bw = new BufferWriter();
  return this.toBufferWriter(bw).concat();
};

Txout.prototype.toBufferWriter = function(bw) {
  if (!bw)
    bw = new BufferWriter();
  bw.writeUInt64LEBN(this.valuebn);
  bw.write(this.varint.buf);
  bw.write(this.script.toBuffer());
  return bw;
};

module.exports = Txout;

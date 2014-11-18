var BN = require('./bn');
var BufferReader = require('./bufferreader');
var BufferWriter = require('./bufferwriter');
var Varint = require('./varint');
var Script = require('./script');

var Txout = function Txout(valuebn, scriptvi, script) {
  if (!(this instanceof Txout))
    return new Txout(valuebn, scriptvi, script);
  if (valuebn instanceof BN) {
    this.set({
      valuebn: valuebn,
      scriptvi: scriptvi,
      script: script
    });
  } else if (valuebn) {
    var obj = valuebn;
    this.set(obj);
  }
};

Txout.prototype.set = function(obj) {
  this.valuebn = obj.valuebn || this.valuebn;
  this.scriptvi = obj.scriptvi || this.scriptvi;
  this.script = obj.script || this.script;
  return this;
};

Txout.prototype.fromJSON = function(json) {
  this.set({
    valuebn: BN().fromJSON(json.valuebn),
    scriptvi: Varint().fromJSON(json.scriptvi),
    script: Script().fromJSON(json.script)
  });
  return this;
};

Txout.prototype.toJSON = function() {
  return {
    valuebn: this.valuebn.toJSON(),
    scriptvi: this.scriptvi.toJSON(),
    script: this.script.toJSON()
  };
};

Txout.prototype.fromBuffer = function(buf) {
  return this.fromBufferReader(BufferReader(buf));
};

Txout.prototype.fromBufferReader = function(br) {
  this.valuebn = br.readUInt64LEBN();
  this.scriptvi = Varint(br.readVarintNum());
  this.script = Script().fromBuffer(br.read(this.scriptvi.toNumber()));
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
  bw.write(this.scriptvi.buf);
  bw.write(this.script.toBuffer());
  return bw;
};

module.exports = Txout;

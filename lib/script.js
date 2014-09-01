var BufferReader = require('./bufferreader');
var Opcode = require('./opcode');

var Script = function Script(buf) {
  if (!(this instanceof Script))
    return new Script(buf);
  
  this.chunks = [];

  if (Buffer.isBuffer(buf)) {
    this.fromBuffer(buf);
  }
  else if (typeof buf === 'string') {
    var str = buf;
    this.fromString(str);
  }
  else if (typeof buf !== 'undefined') {
    var obj = buf;
    this.set(obj);
  }
};

Script.prototype.set = function(obj) {
  this.chunks = obj.chunks || this.chunks;
  return this;
};

Script.prototype.fromBuffer = function(buf) {
  this.chunks = [];

  var br = new BufferReader(buf);
  while (!br.eof()) {
    var opcode = br.readUInt8();

    var len, chunk;
    if (opcode > 0 && opcode < Opcode.map.OP_PUSHDATA1) {
      // Read some bytes of data, opcode value is the length of data
      this.chunks.push(br.buffer(opcode));
    } else if (opcode === Opcode.map.OP_PUSHDATA1) {
      len = br.readUInt8();
      chunk = br.buffer(len);
      this.chunks.push(chunk);
    } else if (opcode === Opcode.map.OP_PUSHDATA2) {
      len = br.readUInt16LE();
      chunk = br.buffer(len);
      this.chunks.push(chunk);
    } else if (opcode === Opcode.map.OP_PUSHDATA4) {
      len = br.readUInt32LE();
      chunk = br.buffer(len);
      this.chunks.push(chunk);
    } else {
      this.chunks.push(opcode);
    }
  }

  return this;
};

module.exports = Script;

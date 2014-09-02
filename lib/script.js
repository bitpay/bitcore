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
    var opcodenum = br.readUInt8();

    var len, buf;
    if (opcodenum > 0 && opcodenum < Opcode.map.OP_PUSHDATA1) {
      len = opcodenum;
      this.chunks.push({
        buf: br.buffer(len),
        len: len,
        opcodenum: opcodenum
      });
    } else if (opcodenum === Opcode.map.OP_PUSHDATA1) {
      len = br.readUInt8();
      var buf = br.buffer(len);
      this.chunks.push({
        buf: buf,
        len: len,
        opcodenum: opcodenum
      });
    } else if (opcodenum === Opcode.map.OP_PUSHDATA2) {
      len = br.readUInt16LE();
      buf = br.buffer(len);
      this.chunks.push({
        buf: buf,
        len: len,
        opcodenum: opcodenum
      });
    } else if (opcodenum === Opcode.map.OP_PUSHDATA4) {
      len = br.readUInt32LE();
      buf = br.buffer(len);
      this.chunks.push({
        buf: buf,
        len: len,
        opcodenum: opcodenum
      });
    } else {
      this.chunks.push(opcodenum);
    }
  }

  return this;
};

Script.prototype.toBuffer = function() {
  var bw = new BufferWriter();

  for (var key in this.chunks) {
    if (this.chunks.hasOwnProperty(key)) {
      var chunk = this.chunks[key];
      if (typeof chunk === 'number') {
        
      }
    }
  }
};

module.exports = Script;

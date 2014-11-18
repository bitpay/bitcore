var BufferReader = require('./bufferreader');
var BufferWriter = require('./bufferwriter');
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

Script.prototype.fromJSON = function(json) {
  return this.fromString(json);
};

Script.prototype.toJSON = function() {
  return this.toString();
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
        buf: br.read(len),
        len: len,
        opcodenum: opcodenum
      });
    } else if (opcodenum === Opcode.map.OP_PUSHDATA1) {
      len = br.readUInt8();
      var buf = br.read(len);
      this.chunks.push({
        buf: buf,
        len: len,
        opcodenum: opcodenum
      });
    } else if (opcodenum === Opcode.map.OP_PUSHDATA2) {
      len = br.readUInt16LE();
      buf = br.read(len);
      this.chunks.push({
        buf: buf,
        len: len,
        opcodenum: opcodenum
      });
    } else if (opcodenum === Opcode.map.OP_PUSHDATA4) {
      len = br.readUInt32LE();
      buf = br.read(len);
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

  for (var i = 0; i < this.chunks.length; i++) {
    var chunk = this.chunks[i];
    if (typeof chunk === 'number') {
      var opcodenum = chunk;
      bw.writeUInt8(opcodenum);
    } else {
      var opcodenum = chunk.opcodenum;
      bw.writeUInt8(chunk.opcodenum);
      if (opcodenum < Opcode.map.OP_PUSHDATA1) {
        bw.write(chunk.buf);
      }
      else if (opcodenum === Opcode.map.OP_PUSHDATA1) {
        bw.writeUInt8(chunk.len);
        bw.write(chunk.buf);
      }
      else if (opcodenum === Opcode.map.OP_PUSHDATA2) {
        bw.writeUInt16LE(chunk.len);
        bw.write(chunk.buf);
      }
      else if (opcodenum === Opcode.map.OP_PUSHDATA4) {
        bw.writeUInt32LE(chunk.len);
        bw.write(chunk.buf);
      }
    }
  }

  return bw.concat();
};

Script.prototype.fromString = function(str) {
  this.chunks = [];

  var tokens = str.split(' ');
  var i = 0;
  while (i < tokens.length) {
    var token = tokens[i];
    var opcode = Opcode(token);
    var opcodenum = opcode.toNumber();

    if (typeof opcodenum === 'undefined') {
      opcodenum = parseInt(token);
      if (opcodenum > 0 && opcodenum < Opcode.map.OP_PUSHDATA1) {
        this.chunks.push({
          buf: new Buffer(tokens[i + 1].slice(2), 'hex'),
          len: opcodenum,
          opcodenum: opcodenum
        });
        i = i + 2;
      }
      else {
        throw new Error('Invalid script');
      }
    } else if (opcodenum === Opcode.map.OP_PUSHDATA1 || opcodenum === Opcode.map.OP_PUSHDATA2 || opcodenum === Opcode.map.OP_PUSHDATA4) {
      if (tokens[i + 2].slice(0, 2) != '0x')
        throw new Error('Pushdata data must start with 0x');
      this.chunks.push({
        buf: new Buffer(tokens[i + 2].slice(2), 'hex'),
        len: parseInt(tokens[i + 1]),
        opcodenum: opcodenum
      });
      i = i + 3;
    } else {
      this.chunks.push(opcodenum);
      i = i + 1;
    }
  }
  return this;
};

Script.prototype.toString = function() {
  var str = "";

  for (var i = 0; i < this.chunks.length; i++) {
    var chunk = this.chunks[i];
    if (typeof chunk === 'number') {
      var opcodenum = chunk;
      str = str + Opcode(opcodenum).toString() + " ";
    } else {
      var opcodenum = chunk.opcodenum;
      if (opcodenum === Opcode.map.OP_PUSHDATA1 || opcodenum === Opcode.map.OP_PUSHDATA2 || opcodenum === Opcode.map.OP_PUSHDATA4)
        str = str + Opcode(opcodenum).toString() + " " ;
      str = str + chunk.len + " " ;
      str = str + "0x" + chunk.buf.toString('hex') + " ";
    }
  }

  return str.substr(0, str.length - 1);
};

Script.prototype.isOpReturn = function() {
  if (this.chunks[0] === Opcode('OP_RETURN').toNumber()
    &&
    (this.chunks.length === 1
    ||
    (this.chunks.length === 2
    && this.chunks[1].buf
    && this.chunks[1].buf.length <= 40
    && this.chunks[1].length === this.chunks.len))) {
    return true;
  } else {
    return false;
  }
};

Script.prototype.isPubkeyhashOut = function() {
  if (this.chunks[0] === Opcode('OP_DUP').toNumber()
    && this.chunks[1] === Opcode('OP_HASH160').toNumber()
    && this.chunks[2].buf
    && this.chunks[3] === Opcode('OP_EQUALVERIFY').toNumber()
    && this.chunks[4] === Opcode('OP_CHECKSIG').toNumber()) {
    return true;
  } else {
    return false;
  }
};

Script.prototype.isPubkeyhashIn = function() {
  if (this.chunks.length === 2
    && this.chunks[0].buf
    && this.chunks[1].buf) {
    return true;
  } else {
    return false;
  }
};

Script.prototype.isScripthashOut = function() {
  if (this.chunks.length === 3
    && this.chunks[0] === Opcode('OP_HASH160').toNumber()
    && this.chunks[1].buf
    && this.chunks[1].buf.length === 20
    && this.chunks[2] === Opcode('OP_EQUAL').toNumber()) {
    return true;
  } else {
    return false;
  }
};

//note that these are frequently indistinguishable from pubkeyhashin
Script.prototype.isScripthashIn = function() {
  var allpush = this.chunks.every(function(chunk) {
    return Buffer.isBuffer(chunk.buf);
  });
  if (allpush) {
    return true;
  } else {
    return false;
  }
};

Script.prototype.write = function(obj) {
  if (typeof obj === 'string')
    this.writeOp(obj);
  else if (typeof obj === 'number')
    this.writeOp(obj);
  else if (Buffer.isBuffer(obj))
    this.writeBuffer(obj);
  else if (typeof obj === 'object')
    this.chunks.push(obj);
  else
    throw new Error('Invalid script chunk');
  return this;
};

Script.prototype.writeOp = function(str) {
  if (typeof str === 'number')
    this.chunks.push(str);
  else
    this.chunks.push(Opcode(str).toNumber());
  return this;
};

Script.prototype.writeBuffer = function(buf) {
  var opcodenum;
  var len = buf.length;
  if (buf.length > 0 && buf.length < Opcode.map.OP_PUSHDATA1) {
    opcodenum = buf.length;
  } else if (buf.length < Math.pow(2, 8)) {
    opcodenum = Opcode.map.OP_PUSHDATA1;
  } else if (buf.length < Math.pow(2, 16)) {
    opcodenum = Opcode.map.OP_PUSHDATA2;
  } else if (buf.length < Math.pow(2, 32)) {
    opcodenum = Opcode.map.OP_PUSHDATA4;
  } else {
    throw new Error("You can't push that much data");
  }
  this.chunks.push({
    buf: buf,
    len: len,
    opcodenum: opcodenum
  });
  return this;
};

module.exports = Script;

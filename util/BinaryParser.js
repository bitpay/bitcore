/**
 * Simple synchronous parser based on node-binary.
 */

function Parser(buffer) {
  this.subject = buffer;
  this.pos = 0;
};

Parser.prototype.buffer = function buffer(len) {
  var buf = this.subject.slice(this.pos, this.pos + len);
  this.pos += len;
  return buf;
};

Parser.prototype.search = function search(needle) {
  var len;

  if ("string" === typeof needle || Buffer.isBuffer(needle)) {
    // TODO: Slicing is probably too slow
    len = this.subject.slice(this.pos).indexOf(needle);
    if (len !== -1) {
      this.pos += len + needle.length;
    }
    return len;
  }
  if ("number" === typeof needle) {
    needle = needle & 0xff;
    // Search for single byte
    for (var i = this.pos, l = this.subject.length; i < l; i++) {
      if (this.subject[i] == needle) {
        len = i - this.pos;
        this.pos = i + 1;
        return len;
      }
    }
    return -1;
  }
};

/**
 * Like search(), but returns the skipped bytes
 */
Parser.prototype.scan = function scan(needle) {
  var startPos = this.pos;
  var len = this.search(needle);
  if (len !== -1) {
    return this.subject.slice(startPos, startPos + len);
  } else {
    throw new Error('No match');
  }
};

Parser.prototype.eof = function eof() {
  return this.pos >= this.subject.length;
};

// convert byte strings to unsigned little endian numbers
function decodeLEu(bytes) {
  var acc = 0;
  for (var i = 0; i < bytes.length; i++) {
    acc += Math.pow(256, i) * bytes[i];
  }
  return acc;
}

// convert byte strings to unsigned big endian numbers
function decodeBEu(bytes) {
  var acc = 0;
  for (var i = 0; i < bytes.length; i++) {
    acc += Math.pow(256, bytes.length - i - 1) * bytes[i];
  }
  return acc;
}

// convert byte strings to signed big endian numbers
function decodeBEs(bytes) {
  var val = decodeBEu(bytes);
  if ((bytes[0] & 0x80) == 0x80) {
    val -= Math.pow(256, bytes.length);
  }
  return val;
}

// convert byte strings to signed little endian numbers
function decodeLEs(bytes) {
  var val = decodeLEu(bytes);
  if ((bytes[bytes.length - 1] & 0x80) == 0x80) {
    val -= Math.pow(256, bytes.length);
  }
  return val;
}

function getDecoder(len, fn) {
  return function() {
    var buf = this.buffer(len);
    return fn(buf);
  };
};
[1, 2, 4, 8].forEach(function(bytes) {
  var bits = bytes * 8;

  Parser.prototype['word' + bits + 'le'] = Parser.prototype['word' + bits + 'lu'] = getDecoder(bytes, decodeLEu);

  Parser.prototype['word' + bits + 'ls'] = getDecoder(bytes, decodeLEs);

  Parser.prototype['word' + bits + 'be'] = Parser.prototype['word' + bits + 'bu'] = getDecoder(bytes, decodeBEu);

  Parser.prototype['word' + bits + 'bs'] = getDecoder(bytes, decodeBEs);

  Parser.prototype.word8 = Parser.prototype.word8u = Parser.prototype.word8be;
  Parser.prototype.word8s = Parser.prototype.word8bs;
});

Parser.prototype.varInt = function() {
  var firstByte = this.word8();
  switch (firstByte) {
    case 0xFD:
      return this.word16le();

    case 0xFE:
      return this.word32le();

    case 0xFF:
      return this.word64le();

    default:
      return firstByte;
  }
};

Parser.prototype.varStr = function() {
  var len = this.varInt();
  return this.buffer(len);
};

module.exports = Parser;

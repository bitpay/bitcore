var base58 = require('../lib/Base58').base58Check;

// Constructor.  Takes the following forms:
//   new EncodedData(<base58_address_string>)
//   new EncodedData(<binary_buffer>)
//   new EncodedData(<data>, <encoding>)
//   new EncodedData(<version>, <20-byte-hash>)
function EncodedData(data, encoding) {
  this.data = data;
  if (!encoding && (typeof data == 'string')) {
    encoding = 'base58';
    this.converters = this.encodings[encoding].converters;
    this._encoding = this.encodings[encoding]._encoding;
  } else {
    if (typeof this.encodings[encoding] === 'undefined')
      encoding = 'binary';
    this.converters = this.encodings[encoding].converters;
    this._encoding = this.encodings[encoding]._encoding;
  }
};

// get or set the encoding used (transforms data)
EncodedData.prototype.encoding = function(encoding) {
  if (encoding && (encoding != this._encoding)) {
    this.data = this.as(encoding);
    this.converters = this.encodings[encoding].converters;
    this._encoding = this.encodings[encoding]._encoding;
  }
  return this._encoding;
};

// answer a new instance having the given encoding
EncodedData.prototype.withEncoding = function(encoding) {
  return new EncodedData(this.as(encoding), encoding);
};

// answer the data in the given encoding
EncodedData.prototype.as = function(encoding) {
  if (!encodings[encoding]) throw new Error('invalid encoding: '+encoding);
  return this.converters[encoding].call(this);
};

// validate that we can convert to binary
EncodedData.prototype._validate = function() {
  this.withEncoding('binary');
};

// Boolean protocol for testing if valid
EncodedData.prototype.isValid = function() {
  try {
    this.validate();
    return true;
  } catch (e) {
    return false;
  }
};

// subclasses can override to do more stuff
EncodedData.prototype.validate = function() {
  this._validate();
};

// convert to a string (in base58 form)
EncodedData.prototype.toString = function() {
  return this.as('base58');
};

// utility
EncodedData.prototype.doAsBinary = function(callback) {
  var oldEncoding = this.encoding();
  this.encoding('binary');
  callback.apply(this);
  this.encoding(oldEncoding);
};

// Setup support for various address encodings.  The object for
// each encoding inherits from the EncodedData prototype.  This
// allows any encoding to override any method...changing the encoding
// for an instance will change the encoding it inherits from.  Note,
// this will present some problems for anyone wanting to inherit from
// EncodedData (we'll deal with that when needed).
var encodings = {
  'binary': {
    converters: {
      'binary': function() {
        var answer = new Buffer(this.data.length);
        this.data.copy(answer);
        return answer;
      },
      'base58': function() {
        return base58.encode(this.data);
      },
      'hex': function() {
        return this.data.toString('hex');
      },
    },

    _validate: function() {
      //nothing to do here...we make no assumptions about the data
    },
  },

  'base58': {
    converters: {
      'binary': function() {
        return base58.decode(this.data);
      },
      'hex': function() {
        return this.withEncoding('binary').as('hex');
      },
    },
  },

  'hex': {
    converters: {
      'binary': function() {
        return new Buffer(this.data, 'hex');
      },
      'base58': function() {
        return this.withEncoding('binary').as('base58');
      },
    },
  },
};

var no_conversion = function() {
  return this.data;
};
for (var k in encodings) {
  if (encodings.hasOwnProperty(k)) {
    if (!encodings[k].converters[k])
      encodings[k].converters[k] = no_conversion;
    encodings[k]._encoding = k;
  }
}

EncodedData.applyEncodingsTo = function(aClass) {
  var tmp = {};
  for (var k in encodings) {
    var enc = encodings[k];
    var obj = Object.create(aClass.prototype);
    for (var j in enc) {
      obj[j] = enc[j];
    }
    tmp[k] = obj;
  }
  aClass.prototype.encodings = tmp;
};

EncodedData.applyEncodingsTo(EncodedData);

module.exports = EncodedData;

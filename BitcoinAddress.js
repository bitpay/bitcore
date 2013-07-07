require('classtool');

function ClassSpec(b) {
  var base58 = b.base58 || require('base58-native').base58Check;

  function BitcoinAddress(data, encoding) {
    this.data = data;
    this.__proto__ = encodings[encoding || 'base58'];
	};

  // return the bitcoin address version (the first byte of the address)
  BitcoinAddress.prototype.version = function() {
    return this.as('binary').readUInt8(0);
  };

  // get or set the encoding used (transforms data)
  BitcoinAddress.prototype.encoding = function(encoding) {
    if(encoding) {
      this.data = this.as(encoding);
      this.__proto__ = encodings[encoding];
    }
    return this._encoding;
  };

  // answer a new instance having the given encoding
  BitcoinAddress.prototype.withEncoding = function(encoding) {
    return new BitcoinAddress(this.as(encoding), encoding);
  };

  // answer the data in the given encoding
  BitcoinAddress.prototype.as = function(encoding) {
    if(!encodings[encoding]) throw new Error('invalid encoding');
    return this.converters[encoding].call(this);
  };

  // validate the address (basically just check that we have 21 bytes)
  BitcoinAddress.prototype.validate = function() {
    this.withEncoding('binary').validate();
  };

  // convert to a string (in base58 form)
	BitcoinAddress.prototype.toString = function() {
    return this.as('base58');
	};

  // Setup support for various address encodings.  The object for
  // each encoding inherits from the BitcoinAddress prototype.  This
  // allows any encoding to override any method...changing the encoding
  // for an instance will change the encoding it inherits from.  Note,
  // this will present some problems for anyone wanting to inherit from
  // BitcoinAddress (we'll deal with that when needed).
  var encodings = {
    'binary': {
      converters: {
        'base58': function() {
          return base58.encode(this.data);
        },
        'hex': function() {
          return this.data.toString('hex');
        },
      },

      validate: function() {
        if(this.data.length != 21) throw new Error('invalid data length');
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

  for(var k in encodings) {
    encodings[k].converters[k] = function() {return this.data;};
    encodings[k]._encoding = k;
    encodings[k].__proto__ = BitcoinAddress.prototype;
  };
  
	return BitcoinAddress;
};
module.defineClass(ClassSpec);

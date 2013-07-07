require('classtool');

function ClassSpec(b) {
  var base58 = b.base58 || require('base58-native').base58Check;

  // Constructor.  Takes the following forms:
  //   new BitcoinAddress();
  //   new BitcoinAddress(<base58_address_string>)
  //   new BitcoinAddress(<21-byte-buffer>)
  //   new BitcoinAddress(<data>, <encoding>)
  //   new BitcoinAddress(<version>, <20-byte-hash>)
  function BitcoinAddress(arg1, arg2) {
    if(typeof arg1 == 'number') {
      this.data = new Buffer(21);
      this.__proto__ = encodings['binary'];
      this.version(arg1);
      this.hash(arg2);
    } else {
      this.data = arg1 || new Buffer(21);
      if(!arg2 && (typeof arg1 == 'string')) {
        this.__proto__ = encodings['base58'];
      } else {
        this.__proto__ = encodings[arg2 || 'binary'];
      }
    }
  };

  // get or set the bitcoin address version (the first byte of the address)
  BitcoinAddress.prototype.version = function(num) {
    if(num || (num === 0)) {
      this.doAsBinary(function() {this.data.writeUInt8(num, 0);});
      return num;
    }
    return this.as('binary').readUInt8(0);
  };

  // get or set the hash data (as a Buffer object)
  BitcoinAddress.prototype.hash = function(data) {
    if(data) {
      this.doAsBinary(function() {data.copy(this.data,1);});
      return data;
    }
    return this.as('binary').slice(1);
  };

  // get or set the encoding used (transforms data)
  BitcoinAddress.prototype.encoding = function(encoding) {
    if(encoding && (encoding != this._encoding)) {
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

  // utility
  BitcoinAddress.prototype.doAsBinary = function(callback) {
    var oldEncoding = this.encoding();
    this.encoding('binary');
    callback.apply(this);
    this.encoding(oldEncoding);
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

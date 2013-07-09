require('classtool');

function ClassSpec(b) {
  var base58 = b.base58 || require('base58-native').base58Check;

  // Constructor.  Takes the following forms:
  //   new Address();
  //   new Address(<base58_address_string>)
  //   new Address(<21-byte-buffer>)
  //   new Address(<data>, <encoding>)
  //   new Address(<version>, <20-byte-hash>)
  function Address(arg1, arg2) {
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
  Address.prototype.version = function(num) {
    if(num || (num === 0)) {
      this.doAsBinary(function() {this.data.writeUInt8(num, 0);});
      return num;
    }
    return this.as('binary').readUInt8(0);
  };

  // get or set the hash data (as a Buffer object)
  Address.prototype.hash = function(data) {
    if(data) {
      this.doAsBinary(function() {data.copy(this.data,1);});
      return data;
    }
    return this.as('binary').slice(1);
  };

  // get or set the encoding used (transforms data)
  Address.prototype.encoding = function(encoding) {
    if(encoding && (encoding != this._encoding)) {
      this.data = this.as(encoding);
      this.__proto__ = encodings[encoding];
    }
    return this._encoding;
  };

  // answer a new instance having the given encoding
  Address.prototype.withEncoding = function(encoding) {
    return new Address(this.as(encoding), encoding);
  };

  // answer the data in the given encoding
  Address.prototype.as = function(encoding) {
    if(!encodings[encoding]) throw new Error('invalid encoding');
    return this.converters[encoding].call(this);
  };

  // validate the address (basically just check that we have 21 bytes)
  Address.prototype.validate = function() {
    this.withEncoding('binary').validate();
  };

  // convert to a string (in base58 form)
  Address.prototype.toString = function() {
    return this.as('base58');
  };

  // utility
  Address.prototype.doAsBinary = function(callback) {
    var oldEncoding = this.encoding();
    this.encoding('binary');
    callback.apply(this);
    this.encoding(oldEncoding);
  };

  // Setup support for various address encodings.  The object for
  // each encoding inherits from the Address prototype.  This
  // allows any encoding to override any method...changing the encoding
  // for an instance will change the encoding it inherits from.  Note,
  // this will present some problems for anyone wanting to inherit from
  // Address (we'll deal with that when needed).
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
    if(!encodings[k].converters[k])
      encodings[k].converters[k] = function() {return this.data;};
    encodings[k]._encoding = k;
    encodings[k].__proto__ = Address.prototype;
  };
  
  return Address;
};
module.defineClass(ClassSpec);

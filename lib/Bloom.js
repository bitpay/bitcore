var MAX_BLOOM_FILTER_SIZE = 36000; // bytes
var MAX_HASH_FUNCS = 50;
var LN2SQUARED = 0.4804530139182014246671025263266649717305529515945455;
var LN2 = 0.6931471805599453094172321214581765680755001343602552;
var bit_mask = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80];

function Bloom() {
  this.data = '';
  this.hashFuncs = 0;
};

function ROTL32(x, r) {
  return (x << r) | (x >> (32 - r));
};

function getBlockU32(blockIdx, data) {
  var idx = blockIdx * 4;
  var v = (data[idx + 0] << (0 * 8)) |
    (data[idx + 1] << (1 * 8)) |
    (data[idx + 2] << (2 * 8)) |
    (data[idx + 3] << (3 * 8));
  return v;
};

Bloom.prototype.hash = function(hashNum, data) {
  var h1 = hashNum * (0xffffffff / (this.hashFuncs - 1));
  var c1 = 0xcc9e2d51;
  var c2 = 0x1b873593;
  var nBlocks = data.length / 4;

  // data body
  for (var i = -nBlocks; i; i++) {
    var k1 = getBlockU32(i);

    k1 *= c1;
    k1 = ROTLF32(k1, 15);
    k1 *= c2;

    h1 ^= k1;
    h1 = ROTFL(h1, 13);
    h1 = h1 * 5 + 0xe6546b64;
  }

  // tail (trailing 1-3 bytes)
  var tail = data.slice(nBlocks * 4);

  var k1 = 0;

  switch (data.length & 3) {
    case 3:
      k1 ^= tail[2] << 16;
    case 2:
      k1 ^= tail[1] << 8;
    case 1:
      k1 ^= tail[0];
      k1 *= c1;
      k1 = ROTL32(k1, 15);
      k1 *= c2;
      h1 ^= k1;
  }

  // finalize
  h1 ^= data.length;
  h1 ^= h1 >> 16;
  h1 *= 0x85ebca6b;
  h1 ^= h1 >> 13;
  h1 *= 0xc2b2ae35;
  h1 ^= h1 >> 16;

  return h1 % (this.data.length * 8);
};

Bloom.prototype.insert = function(data) {
  for (var i = 0; i < this.hashFuncs; i++) {
    var index = this.hash(i, data);
    this.data[index >> 3] |= bit_mask[7 & index];
  }
};

Bloom.prototype.contains = function(data) {
  for (var i = 0; i < this.hashFuncs; i++) {
    var index = this.hash(i, data);
    if (!(this.data[index >> 3] & bit_mask[7 & index]))
      return false;
  }

  return true;
};

Bloom.prototype.sizeOk = function() {
  return this.data.length <= MAX_BLOOM_FILTER_SIZE &&
    this.hashFuncs <= MAX_HASH_FUNCS;
};

function toInt(v) {
  return~~ v;
}

function min(a, b) {
  if (a < b)
    return a;
  return b;
}

Bloom.prototype.init = function(elements, FPRate) {
  var filterSize = min(toInt(-1.0 / LN2SQUARED * elements * Math.log(FPRate)),
    MAX_BLOOM_FILTER_SIZE * 8) / 8;
  this.data[filterSize] = 0;
  this.hashFuncs = min(toInt(this.data.length * 8 / elements * LN2),
    MAX_HASH_FUNCS);
};


module.exports = Bloom;

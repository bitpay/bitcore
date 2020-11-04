import asn from 'asn1.js';

export const RSAPrivateKey = asn.define('RSAPrivateKey', function() {
  this.seq().obj(
    this.key('version').int(),
    this.key('n').int(), // modulus
    this.key('e').int(), // public exponent
    this.key('d').int(), // private exponent
    this.key('p').int(), // prime1
    this.key('q').int(), // prime2
    this.key('dp').int(), // d mod (p-1)
    this.key('dq').int(), // d mod (q-1)
    this.key('qi').int(), // (1/q) mod p
    this.key('other').any().optional()
  );
});

export const RSAPublicKey = asn.define('RSAPublicKey', function() {
  this.seq().obj(
    this.key('n').int(), // modulus
    this.key('e').int() // public exponent
  );
});
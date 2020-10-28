import asn from 'asn1.js';

export const JWK = asn.define('ECPrivateKey', function() {
  this.seq().obj(
    this.key('d').int(),
    this.key('x').int(),
    this.key('y').int()
  );
});

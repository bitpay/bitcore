import asn from 'asn1.js';

export const OKPPrivateKey = asn.define('OKPPrivateKey', function() {
  this.key('key').octstr();
});
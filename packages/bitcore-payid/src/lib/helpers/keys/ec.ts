import asn from 'asn1.js';
import objIds from './objectIdentifiers';

export const ECPrivateKey = asn.define('ECPrivateKey', function() {
  this.seq().obj(
    this.key('version').int(),
    this.key('privateKey').octstr(),
    this.key('parameters').explicit(0).optional().obj(
      this.key('curve').objid(objIds)
    ),
    this.key('publicKey').explicit(1).optional().bitstr()
  );
});

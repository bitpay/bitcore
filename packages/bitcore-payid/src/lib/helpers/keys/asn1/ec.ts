import asn from 'asn1.js';
import { ASN1, Isec1 } from '../../../../index.d';
import objIds from './objectIdentifiers';

export const ECPrivateKey: ASN1<Isec1> = asn.define('sec1', function() {
  this.seq().obj(
    this.key('version').int(),
    this.key('privateKey').octstr(),
    this.key('curve').explicit(0).optional().objid(objIds),
    this.key('publicKey').explicit(1).optional().bitstr()
  );
});

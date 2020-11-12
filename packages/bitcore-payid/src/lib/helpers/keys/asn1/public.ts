import asn from 'asn1.js';
import { ASN1, Ispki } from '../../../../index.d';
import objIds from './objectIdentifiers';

export const PublicKey: ASN1<Ispki> = asn.define('spki', function() {
  this.seq().obj(
    this.key('attributes').seq().obj(
      this.key('type').objid(objIds),
      this.key('curve').objid(objIds).optional()
    ),
    this.key('publicKey').bitstr()
  );
});
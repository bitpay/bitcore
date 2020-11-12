import asn from 'asn1.js';
import { ASN1, Ipkcs8 } from '../../../../index.d';
import objIds from './objectIdentifiers';

export const PrivateKey: ASN1<Ipkcs8> = asn.define('pkcs8', function() {
  this.seq().obj(
    this.key('version').int(),
    this.key('attributes').seq().obj(
      this.key('type').objid(objIds),
      this.key('curve').objid(objIds).optional()
    ),
    this.key('privateKey').octstr()
  );
});
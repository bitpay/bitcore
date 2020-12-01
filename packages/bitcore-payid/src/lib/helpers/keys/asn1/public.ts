import asn from 'asn1.js';
import { ASN1, Ispki } from '../../../../index.d';
import objIds from './objectIdentifiers';

export const PublicKey: ASN1<Ispki> = asn.define('spki', function() {
  this.seq().obj(
    this.key('attributes').seq().obj(
      this.key('type').objid(objIds),
      // curve isn't included w/ EdDSA keys, but EC keys have the curve, and RSA has a NULL field.
      this.key('curve').choice({ curve: this.objid(objIds), null: this.null_() }).optional()
    ),
    this.key('publicKey').bitstr()
  );
});
import asn from 'asn1.js';
import { ASN1, Iokp } from '../../../../index.d';

export const OKPPrivateKey: ASN1<Iokp> = asn.define('OKPPrivateKey', function() {
  this.key('key').octstr();
});
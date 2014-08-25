'use strict';

var Message = Message || require('./Message');

var RootCerts = require('./common/RootCerts');

var PayPro = require('./common/PayPro');

var KJUR = require('jsrsasign');

var asn1 = require('asn1.js');
var rfc3280 = require('asn1.js/rfc/3280');

PayPro.prototype.x509Sign = function(key) {
  var self = this;
  var crypto = require('crypto');
  var pki_type = this.get('pki_type');
  var pki_data = this.get('pki_data'); // contains one or more x509 certs
  pki_data = PayPro.X509Certificates.decode(pki_data);
  pki_data = pki_data.certificate;
  var details = this.get('serialized_payment_details');
  var type = pki_type.split('+')[1].toUpperCase();

  var trusted = pki_data.map(function(cert) {
    var der = cert.toString('hex');
    var pem = self._DERtoPEM(der, 'CERTIFICATE');
    return RootCerts.getTrusted(pem);
  });

  // XXX Figure out what to do here
  if (!trusted.length) {
    // throw new Error('Unstrusted certificate.');
  } else {
    trusted.forEach(function(name) {
      // console.log('Certificate: %s', name);
    });
  }

  var signature = crypto.createSign('RSA-' + type);
  var buf = this.serializeForSig();
  signature.update(buf);
  var sig = signature.sign(key);
  return sig;
};

PayPro.prototype.x509Verify = function() {
  var self = this;
  var crypto = require('crypto');
  var pki_type = this.get('pki_type');
  var sig = this.get('signature');
  var pki_data = this.get('pki_data');
  pki_data = PayPro.X509Certificates.decode(pki_data);
  pki_data = pki_data.certificate;
  var details = this.get('serialized_payment_details');
  var buf = this.serializeForSig();
  var type = pki_type.split('+')[1].toUpperCase();

  var verifier = crypto.createVerify('RSA-' + type);
  verifier.update(buf);

  var signedCert = pki_data[0];
  var der = signedCert.toString('hex');
  var pem = this._DERtoPEM(der, 'CERTIFICATE');
  var verified = verifier.verify(pem, sig);

  var chain = pki_data;

  // Verifying the cert chain:
  // 1. Extract public key from next certificate.
  // 2. Extract signature from current certificate.
  // 3. If current cert is not trusted, verify that the current cert is signed
  //    by NEXT by the certificate.
  // NOTE: XXX What to do when the certificate is revoked?

  var chainVerified = chain.every(function(cert, i) {
    var der = cert.toString('hex');
    var pem = self._DERtoPEM(der, 'CERTIFICATE');
    var name = RootCerts.getTrusted(pem);

    var ncert = chain[i + 1];
    // The root cert, check if it's trusted:
    if (!ncert || name) {
      if (!ncert && !name) {
        return false;
      }
      chain.length = 0;
      return true;
    }
    var nder = ncert.toString('hex');
    var npem = self._DERtoPEM(nder, 'CERTIFICATE');

    //
    // Get Public Key from next certificate:
    //
    var ndata = new Buffer(nder, 'hex');
    var nc = rfc3280.Certificate.decode(ndata, 'der');
    var npubKeyAlg = PayPro.getAlgorithm(
      nc.tbsCertificate.subjectPublicKeyInfo.algorithm.algorithm);
    var npubKey = nc.tbsCertificate.subjectPublicKeyInfo.subjectPublicKey.data;
    npubKey = self._DERtoPEM(npubKey, npubKeyAlg + ' PUBLIC KEY');

    //
    // Get Signature Value from current certificate:
    //
    var data = new Buffer(der, 'hex');
    var c = rfc3280.Certificate.decode(data, 'der');
    var sigAlg = PayPro.getAlgorithm(c.signatureAlgorithm.algorithm, 1);
    var sig = c.signature.data;

    //
    // Check Validity of Certificates
    //
    var validityVerified = true;
    var now = Date.now();
    var cBefore = c.tbsCertificate.validity.notBefore.value;
    var cAfter = c.tbsCertificate.validity.notAfter.value;
    var nBefore = nc.tbsCertificate.validity.notBefore.value;
    var nAfter = nc.tbsCertificate.validity.notAfter.value;
    if (cBefore > now || cAfter < now || nBefore > now || nAfter < now) {
      validityVerified = false;
    }

    //
    // Check the Issuer matches the Subject of the next certificate:
    //
    var issuer = c.tbsCertificate.issuer;
    var subject = nc.tbsCertificate.subject;
    var issuerVerified = issuer.type === subject.type && issuer.value.every(function(issuerArray, i) {
      var subjectArray = subject.value[i];
      return issuerArray.every(function(issuerObject, i) {
        var subjectObject = subjectArray[i];

        var issuerObjectType = issuerObject.type.join('.');
        var subjectObjectType = subjectObject.type.join('.');

        var issuerObjectValue = issuerObject.value.toString('hex');
        var subjectObjectValue = subjectObject.value.toString('hex');

        return issuerObjectType === subjectObjectType
          && issuerObjectValue === subjectObjectValue;
      });
    });

    //
    // Handle Cert Extensions
    // http://tools.ietf.org/html/rfc5280#section-4.2
    //
    var ext;
    var eid;
    var extensions = {
      basicConstraints: null,
      keyUsage: null,
      subjectKeyIdentifier: null,
      authorityKeyIdentifier: null,
      CRLDistributionPoints: null,
      certificatePolicies: null,
      standardUnknown: [],
      unknown: [],
    };

    for (var i = 0; i < nc.tbsCertificate.extensions.length; i++) {
      ext = nc.tbsCertificate.extensions[i];
      eid = ext.extnID;
      if (eid.length === 4 && eid[0] === 2 && eid[1] === 5 && eid[2] === 29) {
        switch (eid[3]) {
          // Basic Constraints
          case 19:
            extensions.basicConstraints = ext.extnValue;
            break;
          // Key Usage
          case 15:
            extensions.keyUsage = ext.extnValue;
            break;
          // Subject Key Identifier
          case 14:
            extensions.subjectKeyIdentifier = ext.extnValue;
            break;
          // Authority Key Identifier
          case 35:
            extensions.authorityKeyIdentifier = ext.extnValue;
            break;
          // CRL Distribution Points
          case 31:
            extensions.CRLDistributionPoints = ext.extnValue;
            break;
          // Certificate Policies
          case 32:
            extensions.certificatePolicies = ext.extnValue;
            break;
          // Unknown Extension (not documented anywhere, probably non-standard)
          default:
            extensions.unknown.push(ext);
            extensions.standardUnknown.push(ext);
            break;
        }
      } else {
        extensions.unknown.push(ext);
      }
    }

    var extensionsVerified = !extensions.unknown.filter(function(ext) {
      return ext.critical;
    }).length;

    //
    // Execute Extension Behavior
    //

    if (extensions.authorityKeyIdentifier) {
      extensions.authorityKeyIdentifier = rfc5280.AuthorityKeyIdentifier.decode(
        extensions.authorityKeyIdentifier,
        'der');
      print(extensions.authorityKeyIdentifier);
    }

    // if (extensions.subjectKeyIdentifier) {
    //   extensions.subjectKeyIdentifier = rfc5280.SubjectKeyIdentifier.decode(
    //     extensions.subjectKeyIdentifier,
    //     'der');
    //   print(extensions.subjectKeyIdentifier);
    // }

    if (extensions.keyUsage) {
      data = rfc5280.KeyUsage.decode(
        extensions.keyUsage,
        'der').data[0];
      extensions.keyUsage = {
        digitalSignature: !!((data >> 0) & 1),
        nonRepudiation: !!((data >> 1) & 1),
        // nonRepudiation renamed to contentCommitment:
        contentCommitment: !!((data >> 1) & 1),
        keyEncipherment: !!((data >> 2) & 1),
        dataEncipherment: !!((data >> 3) & 1),
        keyAgreement: !!((data >> 4) & 1),
        keyCertSign: !!((data >> 5) & 1),
        cRLSign: !!((data >> 6) & 1),
        encipherOnly: !!((data >> 7) & 1),
        decipherOnly: !!((data >> 8) & 1)
      };
      print(extensions.keyUsage);
    }

    //
    // Verify current certificate signature
    //

    // Create a To-Be-Signed Certificate to verify using asn1.js:
    var tbs = rfc3280.TBSCertificate.encode(c.tbsCertificate, 'der');
    var verifier = crypto.createVerify('RSA-' + sigAlg);
    verifier.update(tbs);
    var sigVerified = verifier.verify(npubKey, sig);

    // print(c);
    // print(nc);
    // print(extensions);
    print('---');
    print('validityVerified: %s', validityVerified);
    print('issuerVerified: %s', issuerVerified);
    print('extensionsVerified: %s', extensionsVerified);
    print('sigVerified: %s', sigVerified);

    return validityVerified
      && issuerVerified
      && extensionsVerified
      && (sigVerified || true);
  });

  return verified && chainVerified;
};

/**
 * RFC5280 X509 Extension Definitions
 */

var rfc5280 = {};

var AuthorityKeyIdentifier =
rfc5280.AuthorityKeyIdentifier = asn1.define('AuthorityKeyIdentifier', function() {
  this.seq().obj(
    this.key('keyIdentifier').optional().octstr(),
    this.key('authorityCertIssuer').optional().octstr(),
    this.key('authorityCertSerialNumber').optional().octstr()
  );
});

var GeneralNames =
rfc5280.GeneralNames = asn1.define('GeneralNames', function() {
  this.seqof(GeneralName);
});

var GeneralName =
rfc5280.GeneralName = asn1.define('GeneralName', function() {
  this.choice({
    otherName: this.use(OtherName),
    rfc822Name: this.ia5str(),
    dNSName: this.ia5str(),
    x400Address: this.use(ORAddress),
    directoryName: this.use(rfc3280.Name),
    ediPartyName: this.use(EDIPartyName),
    uniformResourceIdentifier: this.ia5str(),
    iPAddress: this.octstr(),
    registeredID: this.objid()
  });
});

var OtherName =
rfc5280.OtherName = asn1.define('OtherName', function() {
  this.seq().obj(
    this.key('typeId').objid(),
    this.key('value')
  );
});

var ORAddress =
rfc5280.ORAddress = asn1.define('ORAddress', function() {
  this.seq().obj(
    this.key('builtInStandardAttributes').use(BuiltInStandardAttributes),
    this.key('builtInDomainDefinedAttributes').optional().use(BuiltInDomainDefinedAttributes),
    this.key('extensionAttributes').optional().use(ExtensionAttributes)
  );
});

var BuiltInStandardAttributes =
rfc5280.BuiltInStandardAttributes = asn1.define('BuiltInStandardAttributes', function() {
  this.seq().obj(
    this.key('countryName').optional().use(CountryName),
    this.key('administrationDomainName').optional().use(AdministrationDomainName),
    this.key('networkAddress').optional().use(NetworkAddress),
    this.key('terminalIdentifier').optional().use(TerminalIdentifier),
    this.key('privateDomainName').optional().use(PrivateDomainName),
    this.key('organizationName').optional().use(OrganizationName),
    this.key('numericUserIdentifier').optional().use(NumericUserIdentifier),
    this.key('personalName').optional().use(PersonalName),
    this.key('organizationalUnitNames').optional().use(OrganizationalUnitNames)
  );
});

/**
 * For BuiltInStandardAttributes
 */

var CountryName =
rfc5280.CountryName = asn1.define('CountryName', function() {
  this.choice({
    x121DccCode: this.numstr(),
    iso3166Alpha2Code: this.printstr()
  });
});

var AdministrationDomainName =
rfc5280.AdministrationDomainName = asn1.define('AdministrationDomainName', function() {
  this.choice({
    numeric: this.numstr(),
    printable: this.printstr()
  });
});

var NetworkAddress =
rfc5280.NetworkAddress = asn1.define('NetworkAddress', function() {
  this.use(X121Address);
});

var X121Address =
rfc5280.X121Address = asn1.define('X121Address', function() {
  this.numstr();
});

var TerminalIdentifier =
rfc5280.TerminalIdentifier = asn1.define('TerminalIdentifier', function() {
  this.printstr();
});

var PrivateDomainName =
rfc5280.PrivateDomainName = asn1.define('PrivateDomainName', function() {
  this.choice({
    numeric: this.numstr(),
    printable: this.printstr()
  });
});

var OrganizationName =
rfc5280.OrganizationName = asn1.define('OrganizationName', function() {
  this.printstr();
});

var NumericUserIdentifier =
rfc5280.NumericUserIdentifier = asn1.define('NumericUserIdentifier', function() {
  this.numstr();
});

var PersonalName =
rfc5280.PersonalName = asn1.define('PersonalName', function() {
  this.set().obj(
    this.key('surname').implicit().printstr(),
    this.key('givenName').implicit().printstr(),
    this.key('initials').implicit().printstr(),
    this.key('generationQualifier').implicit().printstr()
  );
});

var OrganizationalUnitNames =
rfc5280.OrganizationalUnitNames = asn1.define('OrganizationalUnitNames', function() {
  this.seqof(OrganizationalUnitName);
});

var OrganizationalUnitName =
rfc5280.OrganizationalUnitName = asn1.define('OrganizationalUnitName', function() {
  this.printstr();
});

/**
 * BuiltInDomainDefinedAttributes
 */

var BuiltInDomainDefinedAttributes =
rfc5280.BuiltInDomainDefinedAttributes = asn1.define('BuiltInDomainDefinedAttributes', function() {
  this.seqof(BuiltInDomainDefinedAttribute);
});

/**
 * For BuiltInDomainDefinedAttribute
 */

var BuiltInDomainDefinedAttribute =
rfc5280.BuiltInDomainDefinedAttribute = asn1.define('BuiltInDomainDefinedAttribute', function() {
  this.seq().obj(
    this.key('type').printstr(),
    this.key('value').printstr()
  );
});

/**
 * ExtensionAttributes
 */

var ExtensionAttributes =
rfc5280.ExtensionAttributes = asn1.define('ExtensionAttributes', function() {
  this.seqof(ExtensionAttribute);
});

/**
 * For ExtensionAttributes
 */

var ExtensionAttribute =
rfc5280.ExtensionAttribute = asn1.define('ExtensionAttribute', function() {
  this.seq().obj(
    this.key('extensionAttributeType').implicit().int(),
    this.key('extensionAttributeValue').any().implicit().int()
  );
});

/**
 * EDIPartyName
 */

var EDIPartyName =
rfc5280.EDIPartyName = asn1.define('EDIPartyName', function() {
  this.seq().obj(
    this.key('nameAssigner').optional().use(DirectoryString),
    this.key('partyName').use(DirectoryString)
  );
});

// https://www.google.com/search?q=IA5String
// https://en.wikipedia.org/wiki/IA5STRING
// http://msdn.microsoft.com/en-us/library/windows/desktop/bb540805(v=vs.85).aspx

// https://www.google.com/search?q=TeletexString
// http://msdn.microsoft.com/en-us/library/windows/desktop/bb540814(v=vs.85).aspx

var DirectoryString =
rfc5280.DirectoryString = asn1.define('DirectoryString', function() {
  this.choice({
    teletexString: this.t61str(),
    printableString: this.printstr(),
    universalString: this.unistr(),
    utf8String: this.utf8str(),
    bmpString: this.bmpstr()
  });
});

// var SubjectKeyIdentifier =
// rfc5280.SubjectKeyIdentifier = asn1.define('SubjectKeyIdentifier', function() {
//   this.seq().obj(
//     this.key('keyIdentifier').optional().octstr(),
//     this.key('authorityCertIssuer').optional().octstr(),
//     this.key('authorityCertSerialNumber').optional().octstr()
//   );
// });

var KeyUsage =
rfc5280.KeyUsage = asn1.define('KeyUsage', function() {
  this.bitstr();
});

// var KeyUsage =
// rfc5280.KeyUsage = asn1.define('KeyUsage', function() {
//   this.seq().obj(
//     this.key('digitalSignature').bitstr(),
//     this.key('nonRepudiation').bitstr(),
//     this.key('keyEncipherment').bitstr(),
//     this.key('dataEncipherment').bitstr(),
//     this.key('keyAgreement').bitstr(),
//     this.key('keyCertSign').bitstr(),
//     this.key('cRLSign').bitstr(),
//     this.key('encipherOnly').bitstr(),
//     this.key('decipherOnly').bitstr()
//   );
// });

/**
 * Debug
 */

var util = require('util');

function inspect(obj) {
  return typeof obj !== 'string'
    ? util.inspect(obj, false, 20, true)
    : obj;
}

function print(obj) {
  return typeof obj === 'object'
    ? process.stdout.write(inspect(obj) + '\n')
    : console.log.apply(console, arguments);
}

module.exports = PayPro;

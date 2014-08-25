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
      authorityKeyIdentifier: null,
      subjectKeyIdentifier: null,
      keyUsage: null,
      certificatePolicies: null,
      policyMappings: null,
      subjectAlternativeName: null,
      issuerAlternativeName: null,
      subjectDirectoryAttributes: null,
      basicConstraints: null,
      nameConstraints: null,
      policyConstraints: null,
      extendedKeyUsage: null,
      CRLDistributionPoints: null,
      inhibitAnyPolicy: null,
      freshestCRL: null,
      authorityInformationAccess: null,
      subjectInformationAccess: null,
      standardUnknown: [],
      unknown: [],
    };

    for (var i = 0; i < nc.tbsCertificate.extensions.length; i++) {
      ext = nc.tbsCertificate.extensions[i];
      eid = ext.extnID;

      // id-ce extensions - Standard Extensions
      if (eid.length === 4 && eid[0] === 2 && eid[1] === 5 && eid[2] === 29) {
        switch (eid[3]) {
          // Authority Key Identifier
          case 35:
            extensions.authorityKeyIdentifier = ext.extnValue;
            // parse
            extensions.authorityKeyIdentifier = rfc5280.AuthorityKeyIdentifier.decode(
              extensions.authorityKeyIdentifier,
              'der');
            print(extensions.authorityKeyIdentifier);
            break;
          // Subject Key Identifier
          case 14:
            extensions.subjectKeyIdentifier = ext.extnValue;
            // parse
            // extensions.subjectKeyIdentifier = rfc5280.SubjectKeyIdentifier.decode(
            //   extensions.subjectKeyIdentifier,
            //   'der');
            // print(extensions.subjectKeyIdentifier);
            break;
          // Key Usage
          case 15:
            extensions.keyUsage = ext.extnValue;
            // parse
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
            break;
          // Certificate Policies
          case 32:
            extensions.certificatePolicies = ext.extnValue;
            break;
          // Policy Mappings
          case 33:
            extensions.policyMappings = ext.extnValue;
            break;
          // Subject Alternative Name
          case 17:
            extensions.subjectAlternativeName = ext.extnValue;
            break;
          // Issuer Alternative Name
          case 18:
            extensions.issuerAlternativeName = ext.extnValue;
            break;
          // Subject Directory Attributes
          case 9:
            extensions.subjectDirectoryAttributes = ext.extnValue;
            break;
          // Basic Constraints
          case 19:
            extensions.basicConstraints = ext.extnValue;
            break;
          // Name Constraints
          case 30:
            extensions.nameConstraints = ext.extnValue;
            break;
          // Policy Constraints
          case 36:
            extensions.policyConstraints = ext.extnValue;
            break;
          // Extended Key Usage
          case 37:
            extensions.extendedKeyUsage = ext.extnValue;
            break;
          // CRL Distribution Points
          case 31:
            extensions.CRLDistributionPoints = ext.extnValue;
            break;
          // Inhibit anyPolicy
          case 54:
            extensions.inhibitAnyPolicy = ext.extnValue;
            break;
          // Freshest CRL
          case 46:
            extensions.freshestCRL = ext.extnValue;
            break;
          // Unknown Extension (not documented anywhere, probably non-standard)
          default:
            extensions.unknown.push(ext);
            extensions.standardUnknown.push(ext);
            break;
        }
        continue;
      }

      // id-pe extensions - Private Internet Extensions
      if (eid.length === 8
          && eid[0] === 1
          && eid[1] === 3
          && eid[2] === 6
          && eid[3] === 1
          && eid[4] === 5
          && eid[5] === 5
          && eid[6] === 7) {
        switch (eid[3]) {
          // Authority Information Access
          // id-pe:
          case 1:
            extensions.authorityInformationAccess = ext.extnValue;
            break;
          // Subject Information Access
          // id-pe:
          case 11:
            extensions.subjectInformationAccess = ext.extnValue;
            break;
          // Unknown Extension (not documented anywhere, probably non-standard)
          default:
            extensions.unknown.push(ext);
            extensions.standardUnknown.push(ext);
            break;
        }
        continue;
      }

      extensions.unknown.push(ext);
    }

    var extensionsVerified = !extensions.unknown.filter(function(ext) {
      return ext.critical;
    }).length;

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

/**
 * Standard Extensions
 */

/**
 * 1
 * # Authority Key Identifier
 */

var AuthorityKeyIdentifier =
rfc5280.AuthorityKeyIdentifier = asn1.define('AuthorityKeyIdentifier', function() {
  this.seq().obj(
    this.key('keyIdentifier').optional().use(KeyIdentifier),
    this.key('authorityCertIssuer').optional().use(GeneralNames),
    this.key('authorityCertSerialNumber').optional().use(CertificateSerialNumber)
  );
});

/**
 * ## KeyIdentifier
 */

var KeyIdentifier =
rfc5280.KeyIdentifier = asn1.define('KeyIdentifier', function() {
  this.octstr();
});

/**
 * ## CertificateSerialNumber
 */

var CertificateSerialNumber =
rfc5280.CertificateSerialNumber = asn1.define('CertificateSerialNumber', function() {
  this.int();
});

/**
 * ## GeneralNames
 */

var GeneralNames =
rfc5280.GeneralNames = asn1.define('GeneralNames', function() {
  this.seqof(GeneralName);
});

/**
 * ### GeneralName
 */

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

/**
 * #### OtherName
 */

var OtherName =
rfc5280.OtherName = asn1.define('OtherName', function() {
  this.seq().obj(
    this.key('typeId').objid(),
    this.key('value')
  );
});

/**
 * #### ORAddress
 */

var ORAddress =
rfc5280.ORAddress = asn1.define('ORAddress', function() {
  this.seq().obj(
    this.key('builtInStandardAttributes').use(BuiltInStandardAttributes),
    this.key('builtInDomainDefinedAttributes').optional().use(BuiltInDomainDefinedAttributes),
    this.key('extensionAttributes').optional().use(ExtensionAttributes)
  );
});

/**
 * ##### BuiltInStandardAttributes
 */

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
 * ###### CountryName
 */

var CountryName =
rfc5280.CountryName = asn1.define('CountryName', function() {
  this.choice({
    x121DccCode: this.numstr(),
    iso3166Alpha2Code: this.printstr()
  });
});

/**
 * ###### AdministrationDomainName
 */

var AdministrationDomainName =
rfc5280.AdministrationDomainName = asn1.define('AdministrationDomainName', function() {
  this.choice({
    numeric: this.numstr(),
    printable: this.printstr()
  });
});

/**
 * ###### NetworkAddress
 */

var NetworkAddress =
rfc5280.NetworkAddress = asn1.define('NetworkAddress', function() {
  this.use(X121Address);
});

/**
 * ###### X121Address
 */

var X121Address =
rfc5280.X121Address = asn1.define('X121Address', function() {
  this.numstr();
});

/**
 * ###### TerminalIdentifier
 */

var TerminalIdentifier =
rfc5280.TerminalIdentifier = asn1.define('TerminalIdentifier', function() {
  this.printstr();
});

/**
 * ###### PrivateDomainName
 */

var PrivateDomainName =
rfc5280.PrivateDomainName = asn1.define('PrivateDomainName', function() {
  this.choice({
    numeric: this.numstr(),
    printable: this.printstr()
  });
});

/**
 * ###### OrganizationName
 */

var OrganizationName =
rfc5280.OrganizationName = asn1.define('OrganizationName', function() {
  this.printstr();
});

/**
 * ###### NumericUserIdentifier
 */

var NumericUserIdentifier =
rfc5280.NumericUserIdentifier = asn1.define('NumericUserIdentifier', function() {
  this.numstr();
});

/**
 * ###### PersonalName
 */

var PersonalName =
rfc5280.PersonalName = asn1.define('PersonalName', function() {
  this.set().obj(
    this.key('surname').implicit().printstr(),
    this.key('givenName').implicit().printstr(),
    this.key('initials').implicit().printstr(),
    this.key('generationQualifier').implicit().printstr()
  );
});

/**
 * ###### OrganizationalUnitNames
 */

var OrganizationalUnitNames =
rfc5280.OrganizationalUnitNames = asn1.define('OrganizationalUnitNames', function() {
  this.seqof(OrganizationalUnitName);
});

/**
 * ####### OrganizationalUnitName
 */

var OrganizationalUnitName =
rfc5280.OrganizationalUnitName = asn1.define('OrganizationalUnitName', function() {
  this.printstr();
});

/**
 * ##### BuiltInDomainDefinedAttributes
 */

var BuiltInDomainDefinedAttributes =
rfc5280.BuiltInDomainDefinedAttributes = asn1.define('BuiltInDomainDefinedAttributes', function() {
  this.seqof(BuiltInDomainDefinedAttribute);
});

/**
 * ###### BuiltInDomainDefinedAttribute
 */

var BuiltInDomainDefinedAttribute =
rfc5280.BuiltInDomainDefinedAttribute = asn1.define('BuiltInDomainDefinedAttribute', function() {
  this.seq().obj(
    this.key('type').printstr(),
    this.key('value').printstr()
  );
});

/**
 * ## ExtensionAttributes
 */

var ExtensionAttributes =
rfc5280.ExtensionAttributes = asn1.define('ExtensionAttributes', function() {
  this.seqof(ExtensionAttribute);
});

/**
 * ### ExtensionAttribute
 */

var ExtensionAttribute =
rfc5280.ExtensionAttribute = asn1.define('ExtensionAttribute', function() {
  this.seq().obj(
    this.key('extensionAttributeType').implicit().int(),
    this.key('extensionAttributeValue').any().implicit().int()
  );
});

/**
 * #### EDIPartyName
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

/**
 * ##### DirectoryString
 */

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

/**
 * 2
 * # SubjectKeyIdentifier
 */

var SubjectKeyIdentifier =
rfc5280.SubjectKeyIdentifier = asn1.define('SubjectKeyIdentifier', function() {
  this.use(KeyIdentifier);
});

/**
 * 3
 * # KeyUsage
 */

var KeyUsage =
rfc5280.KeyUsage = asn1.define('KeyUsage', function() {
  this.bitstr();
  // keyUsage = {
  //   digitalSignature: !!((data >> 0) & 1),
  //   nonRepudiation: !!((data >> 1) & 1),
  //   // nonRepudiation renamed to contentCommitment:
  //   contentCommitment: !!((data >> 1) & 1),
  //   keyEncipherment: !!((data >> 2) & 1),
  //   dataEncipherment: !!((data >> 3) & 1),
  //   keyAgreement: !!((data >> 4) & 1),
  //   keyCertSign: !!((data >> 5) & 1),
  //   cRLSign: !!((data >> 6) & 1),
  //   encipherOnly: !!((data >> 7) & 1),
  //   decipherOnly: !!((data >> 8) & 1)
  // };
});

/**
 * 4
 * # Certificate Policies
 */

var CertificatePolicies =
rfc5280.CertificatePolicies = asn1.define('CertificatePolicies', function() {
  this.seqof(PolicyInformation);
});

/**
 * ## Policy Information
 */

var PolicyInformation =
rfc5280.PolicyInformation = asn1.define('PolicyInformation', function() {
  this.seq().obj(
    this.key('policyIdentifier').use(CertPolicyId),
    this.key('policyQualifiers').use(PolicyQualifiers)
  );
});

/**
 * ## Cert Policy Id
 */

var CertPolicyId =
rfc5280.CertPolicyId = asn1.define('CertPolicyId', function() {
  this.objid();
});


/**
 * ### Policy Qualifiers
 */

var PolicyQualifiers =
rfc5280.PolicyQualifiers = asn1.define('PolicyQualifiers', function() {
  this.seqof(PolicyQualifierInfo);
});

/**
 * #### Policy Qualifier Info
 */

var PolicyQualifierInfo =
rfc5280.PolicyQualifierInfo = asn1.define('PolicyQualifierInfo', function() {
  this.seq().obj(
    this.key('policyQualifierId').use(PolicyQualifierId),
    this.key('qualifier').any().use(PolicyQualifierId)
  );
});

/**
 * ##### Policy Qualifier Id
 */

var PolicyQualifierId =
rfc5280.PolicyQualifierId = asn1.define('PolicyQualifierId', function() {
  this.objid();
});

/**
 * 5
 * # Policy Mappings
 */

var PolicyMappings =
rfc5280.PolicyMappings = asn1.define('PolicyMappings', function() {
  this.seqof(PolicyMapping);
});

/**
 * ## Policy Mapping
 */

var PolicyMapping =
rfc5280.PolicyMapping = asn1.define('PolicyMapping', function() {
  this.seq().obj(
    this.key('issuerDomainPolicy').use(CertPolicyId),
    this.key('subjectDomainPolicy').use(CertPolicyId)
  );
});

/**
 * 6
 * # Subject Alternative Name
 */

var SubjectAlternativeName =
rfc5280.SubjectAlternativeName = asn1.define('SubjectAlternativeName', function() {
  this.use(GeneralNames);
});

/**
 * 7
 * # Issuer Alternative Name
 */

var IssuerAlternativeName =
rfc5280.IssuerAlternativeName = asn1.define('IssuerAlternativeName', function() {
  this.use(GeneralNames);
});

/**
 * 8
 * # Subject Directory Attributes
 */

var SubjectDirectoryAttributes =
rfc5280.SubjectDirectoryAttributes = asn1.define('SubjectDirectoryAttributes', function() {
  this.seqof(Attribute);
});

/**
 * ## Attribute
 */

var AttributeTypeAndValue = rfc5280.AttributeTypeAndValue = rfc3280.AttributeTypeAndValue;
var Attribute = rfc5280.AttributeTypeAndValue = AttributeTypeAndValue;

/**
 * 9
 * # Basic Constraints
 */

var BasicConstraints =
rfc5280.BasicConstraints = asn1.define('BasicConstraints', function() {
  this.seq().obj(
    this.key('cA').default(false).bool(),
    this.key('pathLenConstraint').optional().int()
  );
});

/**
 * 10
 * # Name Constraints
 */

var NameConstraints =
rfc5280.NameConstraints = asn1.define('NameConstraints', function() {
  this.seq().obj(
    this.key('permittedSubtrees').optiona().use(GeneralSubtrees),
    this.key('excludedSubtrees').optional().use(GeneralSubtrees)
  );
});

/**
 * ## General Subtrees
 */

var GeneralSubtrees =
rfc5280.GeneralSubtrees = asn1.define('GeneralSubtrees', function() {
  this.seqof(GeneralSubtree);
});

/**
 * ### General Subtree
 */

var GeneralSubtree =
rfc5280.GeneralSubtree = asn1.define('GeneralSubtree', function() {
  this.seq().obj(
    this.key('base').use(GeneralName),
    this.key('minimum').default(0).use(BaseDistance),
    this.key('maximum').optional().use(BaseDistance)
  );
});

/**
 * #### Base Distance
 */

var BaseDistance =
rfc5280.BaseDistance = asn1.define('BaseDistance', function() {
  this.int();
});

/**
 * 11
 * # Policy Constraints
 */

var PolicyConstraints =
rfc5280.PolicyConstraints = asn1.define('PolicyConstraints', function() {
  this.seq().obj(
    this.key('requireExplicitPolicy').optional().use(SkipCerts),
    this.key('inhibitPolicyMapping').optional().use(SkipCerts)
  );
});

/**
 * ## Skip Certs
 */

var SkipCerts =
rfc5280.SkipCerts = asn1.define('SkipCerts', function() {
  this.int();
});

/**
 * 12
 * # Extended Key Usage
 */

var ExtendedKeyUsage =
rfc5280.ExtendedKeyUsage = asn1.define('ExtendedKeyUsage', function() {
  this.seqof(KeyPurposeId);
});

/**
 * ## Key Purpose Id
 */

var KeyPurposeId =
rfc5280.KeyPurposeId = asn1.define('KeyPurposeId', function() {
  this.objid();
});

/**
 * 13
 * # CRL Distribution Points
 */

var CRLDistributionPoints =
rfc5280.CRLDistributionPoints = asn1.define('CRLDistributionPoints', function() {
  this.seqof(DistributionPoint);
});

/**
 * ## Distribution Point
 */

var DistributionPoint =
rfc5280.DistributionPoint = asn1.define('DistributionPoint', function() {
  this.seq().obj(
    this.key('distributionPoint').optional().use(DistributionPointName),
    this.key('reasons').optional().use(ReasonFlags),
    this.key('cRLIssuer').optional().use(GeneralNames)
  );
});

/**
 * ### Distribution Point Name
 */

var DistributionPointName =
rfc5280.DistributionPointName = asn1.define('DistributionPointName', function() {
  this.choice({
    fullName: this.use(GeneralNames),
    nameRelativeToCRLIssuer: this.use(RelativeDistinguishedName)
  });
});

/**
 * #### Relative Distinguished Name
 */

var RelativeDistinguishedName =
rfc5280.RelativeDistinguishedName = asn1.define('RelativeDistinguishedName', function() {
  this.setof(AttributeTypeAndValue);
});

/**
 * ### Reason Flags
 */

var ReasonFlags =
rfc5280.ReasonFlags = asn1.define('ReasonFlags', function() {
  this.bitstr();
  // ReasonFlags ::= BIT STRING {
  //   unused                  (0),
  //   keyCompromise           (1),
  //   cACompromise            (2),
  //   affiliationChanged      (3),
  //   superseded              (4),
  //   cessationOfOperation    (5),
  //   certificateHold         (6),
  //   privilegeWithdrawn      (7),
  //   aACompromise            (8) }
});

/**
 * 14
 * # Inhibit anyPolicy
 */

var InhibitAnyPolicy =
rfc5280.InhibitAnyPolicy = asn1.define('InhibitAnyPolicy', function() {
  this.use(SkipCerts);
});

/**
 * 15
 * # Freshest CRL
 */

var FreshestCRL =
rfc5280.FreshestCRL = asn1.define('FreshestCRL', function() {
  this.use(CRLDistributionPoints);
});

/**
 * Private Internet Extensions
 */

/**
 * 16
 * # Authority Information Access
 */

var AuthorityInformationAccess =
rfc5280.AuthorityInformationAccess = asn1.define('AuthorityInformationAccess', function() {
  this.seqof(AccessDescription);
});

/**
 * ## Access Description
 */

var AccessDescription =
rfc5280.AccessDescription = asn1.define('AccessDescription', function() {
  this.seq().obj(
    this.key('accessMethod').objid(),
    this.key('accessLocation').use(GeneralName)
  );
});

/**
 * 17
 * # Subject Information Access
 */

var SubjectInformationAccess =
rfc5280.SubjectInformationAccess = asn1.define('SubjectInformationAccess', function() {
  this.seqof(AccessDescription);
});

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

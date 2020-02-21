const crypto = require('crypto');

const bs58 = require('bs58');
const kbpgp = require('kbpgp');
const request = require('request-promise');

let bitpayPgpKeys = {};
let githubPgpKeys = {};
let importedPgpKeys = {};
let signatureCount = 0;

let eccPayload;
let parsedEccPayload;
let eccKeysHash;

let keyRequests = [];

keyRequests.push(
  (() => {
    console.log('Fetching keys from github.com/bitpay/pgp-keys...');
    return request({
      method: 'GET',
      url: 'https://api.github.com/repos/bitpay/pgp-keys/contents/keys',
      headers: {
        'user-agent': 'BitPay Key-Check Utility'
      },
      json: true
    }).then(pgpKeyFiles => {
      let fileDataPromises = [];
      pgpKeyFiles.forEach(file => {
        fileDataPromises.push(
          (() => {
            return request({
              method: 'GET',
              url: file.download_url,
              headers: {
                'user-agent': 'BitPay Key-Check Utility'
              }
            }).then(body => {
              let hash = crypto
                .createHash('sha256')
                .update(body)
                .digest('hex');
              githubPgpKeys[hash] = body;
              return Promise.resolve();
            });
          })()
        );
      });
      return Promise.all(fileDataPromises);
    });
  })()
);

keyRequests.push(
  (() => {
    console.log('Fetching keys from bitpay.com/pgp-keys...');
    return request({
      method: 'GET',
      url: 'https://bitpay.com/pgp-keys.json',
      headers: {
        'user-agent': 'BitPay Key-Check Utility'
      },
      json: true
    }).then(body => {
      body.pgpKeys.forEach(function(key) {
        let hash = crypto
          .createHash('sha256')
          .update(key.publicKey)
          .digest('hex');
        bitpayPgpKeys[hash] = key.publicKey;
      });
      return Promise.resolve();
    });
  })()
);

Promise.all(keyRequests)
  .then(() => {
    if (Object.keys(githubPgpKeys).length !== Object.keys(bitpayPgpKeys).length) {
      console.log('Warning: Different number of keys returned by key lists');
    }

    let bitpayOnlyKeys = Object.keys(bitpayPgpKeys).filter(keyHash => {
      return !githubPgpKeys[keyHash];
    });

    let githubOnlyKeys = Object.keys(githubPgpKeys).filter(keyHash => {
      return !bitpayPgpKeys[keyHash];
    });

    if (bitpayOnlyKeys.length) {
      console.log('BitPay returned some keys which are not present in github');
      Object.keys(bitpayOnlyKeys).forEach(keyHash => {
        console.log(`Hash ${keyHash} Key: ${bitpayOnlyKeys[keyHash]}`);
      });
    }

    if (githubOnlyKeys.length) {
      console.log('GitHub returned some keys which are not present in BitPay');
      Object.keys(githubOnlyKeys).forEach(keyHash => {
        console.log(`Hash ${keyHash} Key: ${githubOnlyKeys[keyHash]}`);
      });
    }

    if (!githubOnlyKeys.length && !bitpayOnlyKeys.length) {
      console.log(`Both sites returned ${Object.keys(githubPgpKeys).length} keys. Key lists from both are identical.`);
      return Promise.resolve();
    } else {
      return Promise.reject('Aborting signature checks due to key mismatch');
    }
  })
  .then(() => {
    console.log('Importing PGP keys for later use...');
    return Promise.all(
      Object.values(bitpayPgpKeys).map(pgpKeyString => {
        return new Promise((resolve, reject) => {
          kbpgp.KeyManager.import_from_armored_pgp({ armored: pgpKeyString }, (err, km) => {
            if (err) {
              return reject(err);
            }
            importedPgpKeys[
              km.pgp
                .key(km.pgp.primary)
                .get_fingerprint()
                .toString('hex')
            ] = km;
            return resolve();
          });
        });
      })
    );
  })
  .then(() => {
    console.log('Fetching current ECC keys from bitpay.com/signingKeys/paymentProtocol.json');
    return request({
      method: 'GET',
      url: 'https://bitpay.com/signingKeys/paymentProtocol.json',
      headers: {
        'user-agent': 'BitPay Key-Check Utility'
      }
    }).then(rawEccPayload => {
      if (rawEccPayload.indexOf('rate limit') !== -1) {
        return Promise.reject('Rate limited by BitPay');
      }
      eccPayload = rawEccPayload;
      parsedEccPayload = JSON.parse(rawEccPayload);
      //    if (new Date(parsedEccPayload.expirationDate) < Date.now()) {
      //      return console.log('The currently published ECC keys are expired');
      //    }
      eccKeysHash = crypto
        .createHash('sha256')
        .update(rawEccPayload)
        .digest('hex');
      return Promise.resolve();
    });
  })
  .then(() => {
    console.log(`Fetching signatures for ECC payload with hash ${eccKeysHash}`);
    return request({
      method: 'GET',
      url: `https://bitpay.com/signatures/${eccKeysHash}.json`,
      headers: {
        'user-agent': 'BitPay Key-Check Utility'
      },
      json: true
    }).then(signatureData => {
      console.log('Verifying each signature is valid and comes from the set of PGP keys retrieved earlier');
      Promise.all(
        signatureData.signatures.map(signature => {
          return new Promise((resolve, reject) => {
            let pgpKey = importedPgpKeys[signature.identifier];
            if (!pgpKey) {
              return reject(`PGP key ${signature.identifier} missing for signature`);
            }
            let armoredSignature = Buffer.from(signature.signature, 'hex').toString();

            kbpgp.unbox(
              { armored: armoredSignature, data: Buffer.from(eccPayload), keyfetch: pgpKey },
              (err, result) => {
                if (err) {
                  return reject(`Unable to verify signature from ${signature.identifier} ${err}`);
                }
                signatureCount++;
                console.log(`Good signature from ${signature.identifier} (${pgpKey.get_userids()[0].get_username()})`);
                return Promise.resolve();
              }
            );
          });
        })
      );
    });
  })
  .then(() => {
    if (signatureCount >= Object.keys(bitpayPgpKeys).length / 2) {
      console.log(
        `----\nThe following ECC key set has been verified against signatures from ${signatureCount} of the ${
          Object.keys(bitpayPgpKeys).length
        } published BitPay PGP keys.`
      );
      console.log(eccPayload);

      let keyMap = {};

      console.log('----\nValid keymap for use in bitcoinRpc example:');

      parsedEccPayload.publicKeys.forEach(pubkey => {
        // Here we are just generating the pubkey hash (btc address) of each of the public keys received for easy lookup later
        // as this is what will be provided by the x-identity header
        let a = crypto
          .createHash('sha256')
          .update(pubkey, 'hex')
          .digest();
        let b = crypto
          .createHash('rmd160')
          .update(a)
          .digest('hex');
        let c = '00' + b; // This is assuming livenet
        let d = crypto
          .createHash('sha256')
          .update(c, 'hex')
          .digest();
        let e = crypto
          .createHash('sha256')
          .update(d)
          .digest('hex');

        let pubKeyHash = bs58.encode(Buffer.from(c + e.substr(0, 8), 'hex'));

        keyMap[pubKeyHash] = {
          owner: parsedEccPayload.owner,
          networks: ['main'],
          domains: parsedEccPayload.domains,
          publicKey: pubkey
        };

        // Add Bitpay's testnet
        keyMap['mh65MN7drqmwpCRZcEeBEE9ceQCQ95HtZc'] = {
          owner: 'BitPay (TESTNET ONLY - DO NOT TRUST FOR ACTUAL BITCOIN)',
          networks: ['test'],
          domains: ['test.bitpay.com'],
          publicKey: '03159069584176096f1c89763488b94dbc8d5e1fa7bf91f50b42f4befe4e45295a'
        };
      });

      console.log(keyMap);

      const fs = require('fs');

      fs.writeFileSync('JsonPaymentProtocolKeys.js', 'module.exports = ' + JSON.stringify(keyMap, null, 2));
    } else {
      return Promise.reject(`Insufficient good signatures ${signatureCount} for a proper validity check`);
    }
  })
  .catch(err => {
    console.log(`Error encountered ${err}`);
  });

process.on('unhandledRejection', console.log);

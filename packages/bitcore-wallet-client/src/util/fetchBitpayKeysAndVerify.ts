import * as ncrypto from 'crypto'; // renamed in order to prevent redeclaration of block-scoped variable 'crypto' from typescript dom library
import * as fs from 'fs';
import * as bs58 from 'bs58';
import { unbox } from 'kbpgp/lib/openpgp/hilev';
import { KeyManager } from 'kbpgp/lib/openpgp/keymanager';
import request from 'request-promise';

const bitpayPgpKeys = {};
const githubPgpKeys = {};
const importedPgpKeys = {};
let signatureCount = 0;

let eccPayload;
let parsedEccPayload;
let eccKeysHash;

const keyRequests = [];

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
      const fileDataPromises = [];
      for (const file of pgpKeyFiles) {
        fileDataPromises.push(
          (() => {
            return request({
              method: 'GET',
              url: file.download_url,
              headers: {
                'user-agent': 'BitPay Key-Check Utility'
              }
            }).then(body => {
              const hash = ncrypto.createHash('sha256').update(body).digest('hex');
              githubPgpKeys[hash] = body;
              return Promise.resolve();
            });
          })()
        );
      }
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
      for (const key of body.pgpKeys) {
        const hash = ncrypto
          .createHash('sha256')
          .update(key.publicKey)
          .digest('hex');
        bitpayPgpKeys[hash] = key.publicKey;
      }
      return Promise.resolve();
    });
  })()
);

Promise.all(keyRequests)
  .then(() => {
    if (
      Object.keys(githubPgpKeys).length !== Object.keys(bitpayPgpKeys).length
    ) {
      console.log('Warning: Different number of keys returned by key lists');
    }

    const bitpayOnlyKeys = Object.keys(bitpayPgpKeys).filter(keyHash => {
      return !githubPgpKeys[keyHash];
    });

    const githubOnlyKeys = Object.keys(githubPgpKeys).filter(keyHash => {
      return !bitpayPgpKeys[keyHash];
    });

    if (bitpayOnlyKeys.length) {
      console.log('BitPay returned some keys which are not present in github');
      for (const keyHash of Object.keys(bitpayOnlyKeys)) {
        console.log(`Hash ${keyHash} Key: ${bitpayOnlyKeys[keyHash]}`);
      }
    }

    if (githubOnlyKeys.length) {
      console.log('GitHub returned some keys which are not present in BitPay');
      for (const keyHash of Object.keys(githubOnlyKeys)) {
        console.log(`Hash ${keyHash} Key: ${githubOnlyKeys[keyHash]}`);
      }
    }

    if (!githubOnlyKeys.length && !bitpayOnlyKeys.length) {
      console.log(
        `Both sites returned ${
          Object.keys(githubPgpKeys).length
        } keys. Key lists from both are identical.`
      );
      return Promise.resolve();
    } else {
      return Promise.reject('Aborting signature checks due to key mismatch');
    }
  })
  .then(() => {
    console.log('Importing PGP keys for later use...');
    return Promise.all(
      Object.values(bitpayPgpKeys).map(pgpKeyString => {
        return new Promise<void>((resolve, reject) => {
          KeyManager.import_from_armored_pgp(
            { armored: pgpKeyString },
            (err, km) => {
              if (err) {
                return reject(err);
              }
              importedPgpKeys[
                km.pgp.key(km.pgp.primary).get_fingerprint().toString('hex')
              ] = km;
              return resolve();
            }
          );
        });
      })
    );
  })
  .then(() => {
    console.log(
      'Fetching current ECC keys from bitpay.com/signingKeys/paymentProtocol.json'
    );
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
      eccKeysHash = ncrypto
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
      console.log(
        'Verifying each signature is valid and comes from the set of PGP keys retrieved earlier'
      );
      Promise.all(
        signatureData.signatures.map(signature => {
          return new Promise((resolve, reject) => {
            const pgpKey = importedPgpKeys[signature.identifier];
            if (!pgpKey) {
              return reject(
                `PGP key ${signature.identifier} missing for signature`
              );
            }
            const armoredSignature = Buffer.from(
              signature.signature,
              'hex'
            ).toString();

            unbox(
              {
                armored: armoredSignature,
                data: Buffer.from(eccPayload),
                keyfetch: pgpKey
              },
              (err, _result) => {
                if (err) {
                  return reject(
                    `Unable to verify signature from ${signature.identifier} ${err}`
                  );
                }
                signatureCount++;
                console.log(
                  `Good signature from ${signature.identifier} (${pgpKey
                    .get_userids()[0]
                    .get_username()})`
                );
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

      const keyMap = {};

      console.log('----\nValid keymap for use in bitcoinRpc example:');

      for (const pubkey of parsedEccPayload.publicKeys) {
        // Here we are just generating the pubkey hash (btc address) of each of the public keys received for easy lookup later
        // as this is what will be provided by the x-identity header
        const a = ncrypto.createHash('sha256').update(pubkey, 'hex').digest();
        const b = ncrypto.createHash('rmd160').update(a).digest('hex');
        const c = '00' + b; // This is assuming livenet
        const d = ncrypto.createHash('sha256').update(c, 'hex').digest();
        const e = ncrypto.createHash('sha256').update(d).digest('hex');

        const pubKeyHash = bs58.encode(Buffer.from(c + e.substr(0, 8), 'hex'));

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
          publicKey:
            '03159069584176096f1c89763488b94dbc8d5e1fa7bf91f50b42f4befe4e45295a'
        };
      }

      console.log(keyMap);

      fs.writeFileSync(
        'JsonPaymentProtocolKeys.js',
        'module.exports = ' + JSON.stringify(keyMap, null, 2)
      );
    } else {
      return Promise.reject(
        `Insufficient good signatures ${signatureCount} for a proper validity check`
      );
    }
  })
  .catch(err => {
    console.log(`Error encountered ${err}`);
  });

process.on('unhandledRejection', console.log);

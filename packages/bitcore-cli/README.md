# Bitcore CLI

[![NPM Package](https://img.shields.io/npm/v/bitcore-wallet.svg?style=flat-square)](https://www.npmjs.org/package/bitcore-wallet)

**A simple Command Line Interface Wallet using [Bitcore Wallet Service](https://github.com/bitpay/bitcore/tree/master/packages/bitcore-wallet-service) and its *official* client lib [Bitcore Wallet Client](https://github.com/bitpay/bitcore/tree/master/packages/bitcore-wallet-client).**

This can be used to operate Bitcoin and Bitcoin Cash wallets.

## Quick Guide

```sh
# Start a local BWS instance by doing:
# cd packages/bitcore-wallet-service
# npm stop; npm start

cd bin

# List all commands:
wallet --help

# Interact with the wallet via the <walletName> argument (~/.wallets/<walletName>.json is the default filename where the wallet critical data will be stored)
#
# TIP: Use -H or BITCORE_CLI_HOST to point to your local BWS URL. By default, it points to https://bws.bitpay.com/

wallet my-wallet -H http://localhost:3232

```

## Password protection

This tool will encrypt the wallet's sensitive data (private key(s)) with a password. The password will be asked interactively. The initial setting of the password will show `*` placeholders for each character. Prompts to unlock the wallet (e.g. when signing a transaction) will have a `hidden` password input, meaning it won't look like you're typing anything in.

Password-based key derivation function 2 ([PBKDF2](https://en.wikipedia.org/wiki/PBKDF2)) is used to derive the key to encrypt the data. AES is used to do the actual encryption. Where possible, native modules are used.

## Airgapped Operation (Coming Soon)

Air gapped (non connected) devices are supported. This setup can be useful if maximum security is needed, to prevent private keys from being compromised. In this setup, a device is installed without network access, and transactions are signed off-line. Transactions can be pulled from BWS using a `proxy` device, then downloaded to a pendrive to be moved to the air-gapped device, signed there, and then moved back the `proxy` device to be sent back to BWS. Note that Private keys are generated off-line in the airgapped device.

> Note: Airgapped signing is not supported for Threshold Signature (TSS) wallets.

> The below is obsolete. To be updated once completed

```sh
# On the Air-gapped device

# Generate extended private key (add -t for testnet)
airgapped$ wallet genkey
  * Livenet Extended Private Key Created.

airgapped$ wallet export -o toproxy --nosign
  * Wallet data saved at toproxy without signing capability.


# On the proxy machine
proxy$ wallet import toproxy
  * Wallet Imported without signing capability.
proxy$ wallet join <secret>    # Or wallet create 
proxy$ wallet address
proxy$ wallet balance

# It is not possible to sign transactions from the proxy device
proxy$ wallet sign
  [Error: You do not have the required keys to sign transactions]

# Export pending transaction to be signed offline
proxy$ wallet txproposals -o txproposals.dat

## Back to air-gapped device

# Sign them
airgapped$ wallet airsign txproposals.dat -o signatures.dat

# NOTE: To allow the airgapped device to check the transaction proposals being signed, the public keys of the copayers will be imported from the txproposals archive. That information is exported automatically by the proxy machine, and encrypted using copayer's xpriv derivatives.

## Back to proxy machine

# Send signatures to BWS
proxy$ wallet sign -i signatures.dat
  Transaction 014255.... signed by you.
```

## Contributing

See [CONTRIBUTING.md](https://github.com/bitpay/bitcore/blob/master/CONTRIBUTING.md) for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).

Copyright 2013-2025 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.
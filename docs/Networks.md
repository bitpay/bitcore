# Networks

Bitcore provides support for both the main bitcoin network as well as for
`testnet3`, the current test blockchain. We encourage the use of
`Networks.livenet` and `Networks.testnet` as constants. Note that the library
sometimes may check for equality against this object. Avoid creating a deep
copy of this object and using that.

## Setting the default network

Most project will only need to work in one of either networks. The value of
`Networks.defaultNetwork` can be set to `Networks.testnet` if the project will
needs only to work on testnet (the default is `Networks.livenet`).

## Network constants

The functionality of testnet and livenet is mostly similar (except for some
relaxed block validation rules on testnet). They differ in the constants being
used for human representation of base58 encoded strings. These are sometimes
referred to as "version" constants.

## Source
TODO: Include source here

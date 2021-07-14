# Insight

**A blockchain explorer for Bitcore.**

## Quick Start

To get started, first [start a `bitcore` node](../bitcore-node/readme.md), then run insight:

```sh
cd bitcore
npm run insight

//If you are making UI changes only:
cd packages/insight
npm run start:prod
```

## Network / Chain setting

To use a specific network / chain set the `NETWORK` and `CHAIN` environment variable, e.g.:

```sh
NETWORK=testnet CHAIN=BCH npm start
```

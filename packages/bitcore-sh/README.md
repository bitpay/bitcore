# Bitcore SH
A repl environment to interact with `crypto-rpc` using the rpcs in the bitcore config

## Usage
In packages/bitcore-sh run:
```
npm start
```
Starts repl environment
```
>
```
Run a command
```
> BTC regtest getTip
{
  height: 1280,
  hash: '1cb2e03e7c644f6346db5d0ca06f48bb989e3dc4088ce348bc0817a89cbfd6aa'
}
```
Run a command with arguments
```
> BTC regtest getBlock --hash 1cb2e03e7c644f6346db5d0ca06f48bb989e3dc4088ce348bc0817a89cbfd6aa
{
  hash: '1cb2e03e7c644f6346db5d0ca06f48bb989e3dc4088ce348bc0817a89cbfd6aa',
  confirmations: 1,
  height: 1280,
  version: 536870912,
  versionHex: '20000000',
  merkleroot: 'b7fe62d037fe3577ba8531676ad772dad5879e0f8fee2d79e4707883bef0bb1d',
  time: 1778809084,
  mediantime: 1778807940,
  nonce: 1,
  bits: '207fffff',
  difficulty: 4.656542373906925e-10,
  chainwork: '0000000000000000000000000000000000000000000000000000000000000a02',
  nTx: 1,
  previousblockhash: '6d044b0b7b84518f601c8b84c7e65b5387a9afa440968ae1c8bbe9062cf8105a',
  strippedsize: 214,
  size: 250,
  weight: 892,
  tx: [
    'b7fe62d037fe3577ba8531676ad772dad5879e0f8fee2d79e4707883bef0bb1d'
  ]
}
```
The `use` command speeds up execution by appending arguments to the start of the following commands
```
> use BTC regtest
BTC regtest> getTip
{
  height: 1280,
  hash: '1cb2e03e7c644f6346db5d0ca06f48bb989e3dc4088ce348bc0817a89cbfd6aa'
}
```
`bitcore-sh` includes command completion, try using tab

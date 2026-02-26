# Join a room

```javascript
socket.on('connect', () => {
  console.log('Connected to socket');
  socket.emit('room', '/BTC/regtest/inv');
});
```

## Room Namespaces

```sh
/${chain}/${network}/inv

/${chain}/${network}/address

# Examples

/BTC/regtest/inv

/BTC/mainnet/address
```

## Tx Event Listener

```javascript
socket.on('tx', sanitizedTx => {
  console.log(sanitizedTx);
});
```

@return **sanitizedTx** - Transactions object without wallets property

```json
sanitizedTx = {
  "txid": string,
  "chain": string,
  "network": string,
  "blockHeight?": number,
  "blockHash?": string,
  "blockTime?": Date,
  "blockTimeNormalized?": Date,
  "coinbase": boolean,
  "fee": number,
  "size": number,
  "locktime": number,
  "inputCount": number,
  "outputCount": number,
  "value": number
}
```

## Block Event Listener

```javascript
socket.on('block', block => {
  console.log(block);
});
```

@returns - **block** - A specified block on a blockchain

```json
block = {
  "chain": "BTC",
  "network": "regtest",
  "hash": "529e8ecb8db4e40f604b180e835cf53cf0eafbd43fbea13ced38ac9faf819560",
  "height": 611,
  "version": 536870912,
  "nextBlockHash": "",
  "previousBlockHash": "089a4f003633b5a9b845c0d0fa22dd0601780bdc7eba0367ae89d11809552cd7",
  "merkleRoot": "dcc481de07b3cac9d9bac855beddaf1679653b92a89e721c93b740d6d4f39ade",
  "time": "2019-01-17T21:41:31.000Z",
  "timeNormalized": "2019-01-17T21:41:31.000Z",
  "bits": 545259519,
  "nonce": 2,
  "transactionCount": 2,
  "size": 430,
  "reward": 312505140,
  "processed": false
}
```

## Address Event Listener

```javascript
socket.on(address, sanitizedCoin => {
  console.log(sanitizedCoin);
});

# Example

socket.on('1JfbZRwdDHKZmuiZgYArJZhcuuzuw2HuMu', sanitizedCoin => {
  console.log(sanitizedCoin);
});
```

@returns - **sanitizedCoin** - A coin object without wallets property

```json
sanitizedCoin = {
  "network": string,
  "chain": string,
  "mintTxid": string,
  "mintIndex": number,
  "mintHeight": number,
  "coinbase": boolean,
  "value": number,
  "address": string,
  "script": Buffer,
  "spentTxid": string,
  "spentHeight": number
}
```

## Coin Event Listener

```javascript
socket.on('coin', sanitizedCoin => {
  console.log(sanitizedCoin);
});
```

@returns - **sanitizedCoin** - A coin object without wallets property

```json
sanitizedCoin = {
  "network": string,
  "chain": string,
  "mintTxid": string,
  "mintIndex": number,
  "mintHeight": number,
  "coinbase": boolean,
  "value": number,
  "address": string,
  "script": Buffer,
  "spentTxid": string,
  "spentHeight": number
}
```
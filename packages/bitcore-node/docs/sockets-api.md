# Join a room
```
socket.on('connect', () => {
  console.log('Connected to socket');
  socket.emit('room', '/BTC/regtest/inv');
});
```

## Room Namespaces
```
/${chain}/${network}/inv

/${chain}/${network}/address

# Examples

/BTC/regtest/inv

/BTC/mainnet/address
```

## Tx Event Listener
```
socket.on('tx', sanitizedTx => {
  console.log(sanitizedTx);
});
```

@params **sanitizedTx** - Transactions object without wallets property
```
sanitizedTx = {
  txid: string;
  chain: string;
  network: string;
  blockHeight?: number;
  blockHash?: string;
  blockTime?: Date;
  blockTimeNormalized?: Date;
  coinbase: boolean;
  fee: number;
  size: number;
  locktime: number;
  inputCount: number;
  outputCount: number;
  value: number;
}
```

## Block Event Listener
```
socket.on('block', block => {
  console.log(block);
});
```

@params - **block** - A specified block on a blockchain
```
block = {
  chain: string;
  confirmations?: number;
  network: string;
  height: number;
  hash: string;
  version: number;
  merkleRoot: string;
  time: Date;
  timeNormalized: Date;
  nonce: number;
  previousBlockHash: string;
  nextBlockHash: string;
  transactionCount: number;
  size: number;
  bits: number;
  reward: number;
  processed: boolean;
}
```

## Address Event Listener
```
socket.on(address, sanitizedCoin => {
  console.log(sanitizedCoin);
});

# Example

socket.on('1JfbZRwdDHKZmuiZgYArJZhcuuzuw2HuMu', sanitizedCoin => {
  console.log(sanitizedCoin);
});
```

@params - **sanitizedCoin** - A coin object without wallets property
```
sanitizedCoin = {
  network: string;
  chain: string;
  mintTxid: string;
  mintIndex: number;
  mintHeight: number;
  coinbase: boolean;
  value: number;
  address: string;
  script: Buffer;
  spentTxid: string;
  spentHeight: number;
}
```

## Coin Event Listener
```
socket.on('coin', sanitizedCoin => {
  console.log(sanitizedCoin);
});
```

@params - **sanitizedCoin** - A coin object without wallets property
```
sanitizedCoin = {
  network: string;
  chain: string;
  mintTxid: string;
  mintIndex: number;
  mintHeight: number;
  coinbase: boolean;
  value: number;
  address: string;
  script: Buffer;
  spentTxid: string;
  spentHeight: number;
}
```
Event Listener Event:
"data"

@params: tx - An object with properties associated to a transaction
```
tx = {
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
  wallets: ObjectID[];
}
```

Room namespace: 
```
/${chain}/${network}/inv
```

Emit Event:
```
'tx'
```

@returns sanitizedTx - An object with a list of sanitized wallets
```
sanitizedTx = {
    wallets: ObjectID[];
} & {
    wallets: undefined;
}
```

Room namespace:
```
/${chain}/${network}/inv
```

Emit Event
```
'block'
```

@params && @returns - a Block on a blockchain
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

@params - A coin and an address
```
addressCoin = { 
    coins: {
  network: string;
  chain: string;
  mintTxid: string;
  mintIndex: number;
  mintHeight: number;
  coinbase: boolean;
  value: number;
  address: string;
  script: Buffer;
  wallets: Array<ObjectID>;
  spentTxid: string;
  spentHeight: number;
  confirmations?: number;
    }
    address: string
}
```

Room namespaces: 
```
/${chain}/${network}/address

/${chain}/${network}/inv
```

Emit Events
```
'address'
'coin'
```

@returns - sanitizedCoins
```
sanitizedCoin = {
    wallets: ObjectID[];
} & {
    wallets: undefined;
}
```
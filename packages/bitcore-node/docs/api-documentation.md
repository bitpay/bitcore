# Transactions

## Get Transactions by block

GET `/api/BTC/mainnet/tx/?blockHeight=123456`

GET `/api/BTC/mainnet/tx/?blockHash=0000000000002917ed80650c6174aac8dfc46f5fe36480aaef682ff6cd83c3ca`

## Get Transaction by txid

GET `/api/BTC/mainnet/tx/5c8a63e695caf95c28a0155beaa22b84a7adb18b8693ba90f04d94891d122afe`

# Address

## Get Transaction Outputs by Address

GET `/api/BTC/mainnet/address/mmEsgUprBEQkGDKowPQSLEYDbMtGRKxaF4/?unspent=true`

## Get Balance for an Address

GET `/api/BTC/mainnet/address/mmEsgUprBEQkGDKowPQSLEYDbMtGRKxaF4/balance`

# Block

## Get Block

GET `/api/BTC/mainnet/block/000000000001bd9673585488213888bb53b669196aedf41beda7d39813940718`

<details>
<summary>**Example response**</summary>
<br>
```
{
    "_id": "5c3612679e28322477a90cd2",
    "chain": "BTC",
    "network": "mainnet",
    "hash": "000000000001bd9673585488213888bb53b669196aedf41beda7d39813940718",
    "height": 99720,
    "version": 1,
    "size": 439,
    "merkleRoot": "5a8a0af17855da42b358b47053c72558aaef2773fdd6fc845500fea6189b93f0",
    "time": "2010-12-27T20:41:12.000Z",
    "timeNormalized": "2010-12-27T20:41:12.000Z",
    "nonce": 1837081266,
    "bits": 453281356,
    "previousBlockHash": "0000000000000133e27223dfdbd4519cd38b982760826456c7ff3bb2cc9a5e5e",
    "nextBlockHash": "000000000000a9d244f9e21224bb9188dfe8c9c4e9f8b6f9f1a9dbd8e8bf8b68",
    "reward": 5000000000,
    "transactionCount": 2,
    "confirmations": 3
}
```
</details>


GET `/api/BTC/mainnet/block/123456`


# Authenticated Methods
## Wallet

### Add Wallet:

POST `/api/BTC/mainnet/wallet`

BODY:
```
{
  "name": "WalletName",
  "chain": "BTC",
  "network": "mainnet",
  "pubKey": "03bdb94afdc7e5c4811bf9b160ac475b82156ea42c8659c8358b68c828df9a1c3d",
  "path": "m/44'/0'/0'"
}
```

### Get Wallet:

GET `/api/BTC/mainnet/wallet/:pubKey`

### Import Addresses:

POST `/api/BTC/mainnet/wallet/:pubKey`

BODY: raw jsonl wallet file of the form
```
{"address": "bItCoInAddReSSHeRe"}
```

### Get Wallet Addresses

GET `/api/BTC/mainnet/wallet/:pubKey/addresses`

### Get Wallet Transactions:

GET `/api/BTC/mainnet/wallet/:pubKey/transactions`

### Get Balance:

GET `/api/BTC/mainnet/wallet/:pubKey/balance`

### Get Wallet UTXOS

GET `/api/BTC/mainnet/wallet/:pubKey/utxos`

# Transactions

## Get Transactions by block

GET `/api/BTC/mainnet/tx/?blockHeight=12`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```
curl -v localhost:3000/api/BTC/mainnet/tx/?blockHeight=12
```

```
[
    {
        "_id": "5c34b35d69d5562c2fc44026",
        "txid": "3b96bb7e197ef276b85131afd4a09c059cc368133a26ca04ebffb0ab4f75c8b8",
        "network": "mainnet",
        "chain": "BTC",
        "blockHeight": 12,
        "blockHash": "0000000027c2488e2510d1acf4369787784fa20ee084c258b58d9fbd43802b5e",
        "blockTime": "2009-01-09T04:21:28.000Z",
        "blockTimeNormalized": "2009-01-09T04:21:28.000Z",
        "coinbase": true,
        "locktime": -1,
        "inputCount": 1,
        "outputCount": 1,
        "size": 134,
        "fee": -1,
        "value": 5000000000,
        "confirmations": 99754
    }
]
```

</details>
<br>

GET `/api/BTC/mainnet/tx?blockHash=000000006a625f06636b8bb6ac7b960a8d03705d1ace08b1a19da3fdcc99ddbd`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```
curl -v localhost:3000/api/BTC/mainnet/tx?blockHash=000000006a625f06636b8bb6ac7b960a8d03705d1ace08b1a19da3fdcc99ddbd
```

```
[
    {
        "_id": "5c34b35d69d5562c2fc43eff",
        "txid": "9b0fc92260312ce44e74ef369f5c66bbb85848f2eddd5a7a1cde251e54ccfdd5",
        "network": "mainnet",
        "chain": "BTC",
        "blockHeight": 2,
        "blockHash": "000000006a625f06636b8bb6ac7b960a8d03705d1ace08b1a19da3fdcc99ddbd",
        "blockTime": "2009-01-09T02:55:44.000Z",
        "blockTimeNormalized": "2009-01-09T02:55:44.000Z",
        "coinbase": true,
        "locktime": -1,
        "inputCount": 1,
        "outputCount": 1,
        "size": 134,
        "fee": -1,
        "value": 5000000000,
        "confirmations": 102293
    }
]
```

</details>
<br>

## Get Transaction by txid

GET `/api/BTC/mainnet/tx/9b0fc92260312ce44e74ef369f5c66bbb85848f2eddd5a7a1cde251e54ccfdd5`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```
curl -v localhost:3000/api/BTC/mainnet/tx/9b0fc92260312ce44e74ef369f5c66bbb85848f2eddd5a7a1cde251e54ccfdd5
```

```
{
    "_id": "5c34b35d69d5562c2fc43eff",
    "txid": "9b0fc92260312ce44e74ef369f5c66bbb85848f2eddd5a7a1cde251e54ccfdd5",
    "network": "mainnet",
    "chain": "BTC",
    "blockHeight": 2,
    "blockHash": "000000006a625f06636b8bb6ac7b960a8d03705d1ace08b1a19da3fdcc99ddbd",
    "blockTime": "2009-01-09T02:55:44.000Z",
    "blockTimeNormalized": "2009-01-09T02:55:44.000Z",
    "coinbase": true,
    "locktime": -1,
    "inputCount": 1,
    "outputCount": 1,
    "size": 134,
    "fee": -1,
    "value": 5000000000,
    "confirmations": 102293
}
```

</details>
<br>

# Address

## Get Transaction Outputs by Address

GET `/api/BTC/mainnet/address/12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX/?unspent=true`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```
curl -v localhost:3000/api/BTC/mainnet/address/12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX/?unspent=true
```

```
[
    {
        "_id": "5c34b35d69d5562c2fc43e89",
        "chain": "BTC",
        "network": "mainnet",
        "coinbase": true,
        "mintIndex": 0,
        "spentTxid": "",
        "mintTxid": "0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098",
        "mintHeight": 1,
        "spentHeight": -2,
        "address": "12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX",
        "script": "410496b538e853519c726a2c91e61ec11600ae1390813a627c66fb8be7947be63c52da7589379515d4e0a604f8141781e62294721166bf621e73a82cbf2342c858eeac",
        "value": 5000000000,
        "confirmations": -1
    }
]
```

</details>
<br>

## Get Balance for an Address

GET `/api/BTC/mainnet/address/12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX/balance`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```
curl -v localhost:3000/api/BTC/mainnet/address/12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX/balance
```

```
{
    "confirmed": 5000000000,
    "unconfirmed": 0,
    "balance": 5000000000
}
```

</details>
<br>

# Block

## Get Block

GET `/api/BTC/mainnet/block/00000000839a8e6886ab5951d76f411475428afc90947ee320161bbf18eb6048`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```
curl -v localhost:3000/api/BTC/mainnet/block/00000000839a8e6886ab5951d76f411475428afc90947ee320161bbf18eb6048
```

```
{
    "_id": "5c34b53569d5562c2fc8e65a",
    "chain": "BTC",
    "network": "mainnet",
    "hash": "00000000839a8e6886ab5951d76f411475428afc90947ee320161bbf18eb6048",
    "height": 1,
    "version": 1,
    "size": 215,
    "merkleRoot": "0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098",
    "time": "2009-01-09T02:54:25.000Z",
    "timeNormalized": "2009-01-09T02:54:25.000Z",
    "nonce": 2573394689,
    "bits": 486604799,
    "previousBlockHash": "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
    "nextBlockHash": "000000006a625f06636b8bb6ac7b960a8d03705d1ace08b1a19da3fdcc99ddbd",
    "reward": 5000000000,
    "transactionCount": 1,
    "confirmations": 102295
}
```

</details>
<br>

# Authenticated Methods
## Wallet

**To test wallet api routes change config.ts inside /src folder to:**

```
wallets: {
          allowCreationBeforeCompleteSync: false,
          allowUnauthenticatedCalls: true
        }
```

### Add Wallet:

POST `/api/BTC/mainnet/wallet`

BODY:
```
{
  "name": "WalletName2",
  "chain": "BTC",
  "network": "mainnet",
  "pubKey": "03bdb94afdc7e5c4811bf9b160ac475b82156ea42c8659c8358b68c828df9a1c3d",
  "path": "m/44'/0'/0'"
}
```

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```
curl -v POST -H "Content-Type: application/json" -d "{
  "name": "WalletName2",
  "chain": "BTC",
  "network": "mainnet",
  "pubKey": "03bdb94afdc7e5c4811bf9b160ac475b82156ea42c8659c8358b68c828df9a1c3d",
  "path": "m/44'/0'/0'"
}" 
localhost:3000/api/BTC/mainnet/wallet/
```

```
{
    "chain": "BTC",
    "network": "mainnet",
    "name": "WalletName2",
    "pubKey": "03bdb94afdc7e5c4811bf9b160ac475b82156ea42c8659c8358b68c828df9a1c3d",
    "path": "m/44'/0'/0'",
    "_id": "5c3631e538704e27c6f146c3"
}
```

</details>
<br>

### Get Wallet:

GET `/api/BTC/mainnet/wallet/:pubKey`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```
curl -v localhost:3000/api/BTC/mainnet/wallet/03bdb94afdc7e5c4811bf9b160ac475b82156ea42c8659c8358b68c828df9a1c3d
```

```
{
    "_id": "5c3639d1e60f7b2e174afc65",
    "chain": "BTC",
    "network": "mainnet",
    "name": "WalletName",
    "pubKey": "03bdb94afdc7e5c4811bf9b160ac475b82156ea42c8659c8358b68c828df9a1c3d",
    "path": "m/44'/0'/0'",
    "singleAddress": null
}
```

</details>
<br>

### Import Addresses:

POST `/api/BTC/mainnet/wallet/:pubKey`

BODY: raw jsonl wallet file of the form
```
{"address": "mmEsgUprBEQkGDKowPQSLEYDbMtGRKxaF4"}
```

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```
curl -v localhost:3000/api/BTC/mainnet/wallet/03bdb94afdc7e5c4811bf9b160ac475b82156ea42c8659c8358b68c828df9a1c3d
```

```
{
    "_id": "5c3639d1e60f7b2e174afc65",
    "chain": "BTC",
    "network": "mainnet",
    "name": "WalletName",
    "pubKey": "03bdb94afdc7e5c4811bf9b160ac475b82156ea42c8659c8358b68c828df9a1c3d",
    "path": "m/44'/0'/0'",
    "singleAddress": null
}
```

</details>
<br>

### Get Wallet Addresses

GET `/api/BTC/mainnet/wallet/:pubKey/addresses`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```
curl -v localhost:3000/api/BTC/mainnet/wallet/03bdb94afdc7e5c4811bf9b160ac475b82156ea42c8659c8358b68c828df9a1c3d/addresses
```

```
[]
```

</details>
<br>

### Get Wallet Transactions:

GET `/api/BTC/mainnet/wallet/:pubKey/transactions`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```
curl -v localhost:3000/api/BTC/mainnet/wallet/03bdb94afdc7e5c4811bf9b160ac475b82156ea42c8659c8358b68c828df9a1c3d/transactions
```

```
[]
```

</details>
<br>

### Get Balance:

GET `/api/BTC/mainnet/wallet/:pubKey/balance`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```
curl -v localhost:3000/api/BTC/mainnet/wallet/03bdb94afdc7e5c4811bf9b160ac475b82156ea42c8659c8358b68c828df9a1c3d/balance
```

```
{
    "confirmed": 500000,
    "unconfirmed": 0,
    "balance": 500000
}
```

</details>
<br>

### Get Wallet UTXOS

GET `/api/BTC/mainnet/wallet/:pubKey/utxos`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```
curl -v localhost:3000/api/BTC/mainnet/wallet/03bdb94afdc7e5c4811bf9b160ac475b82156ea42c8659c8358b68c828df9a1c3d/utxos
```

```
[]
```

</details>
<br>

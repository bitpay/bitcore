# Transactions

## Get Transactions by block

GET `/api/BTC/mainnet/tx/?blockHeight=12`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```
curl -v https://localhost:3000/api/BTC/mainnet/tx/?blockHeight=12
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
curl -v https://localhost:3000/api/BTC/mainnet/tx?blockHash=000000006a625f06636b8bb6ac7b960a8d03705d1ace08b1a19da3fdcc99ddbd
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
curl -v https://localhost:3000/api/BTC/mainnet/tx/9b0fc92260312ce44e74ef369f5c66bbb85848f2eddd5a7a1cde251e54ccfdd5
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
curl -v https://localhost:3000/api/BTC/mainnet/address/12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX/?unspent=true
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
curl -v https://localhost:3000/api/BTC/mainnet/address/12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX/balance
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
curl -v https://localhost:3000/api/BTC/mainnet/block/00000000839a8e6886ab5951d76f411475428afc90947ee320161bbf18eb6048
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

### Add Wallet:

!! POST `/api/BTC/mainnet/wallet`

BODY:
```
{
  "name": "WalletName2",
  "chain": "BTC",
  "network": "mainnet",
  "pubKey": "19buW9spaejyU3ejvHgTacRktw1LW14ivo",
  "path": "m/44'/0'/0'"
}
```

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```
curl -X -v POST -H "Content-Type: application/json" -d "{
  "name": "WalletName2",
  "chain": "BTC",
  "network": "mainnet",
  "pubKey": "19buW9spaejyU3ejvHgTacRktw1LW14ivo",
  "path": "m/44'/0'/0'"
}" 
https://localhost:3000/api/BTC/mainnet/wallet/
```

```
{
    "chain": "BTC",
    "network": "mainnet",
    "name": "WalletName2",
    "pubKey": "19buW9spaejyU3ejvHgTacRktw1LW14ivo",
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
curl -v https://localhost:3000/api/BTC/mainnet/wallet/16fVqzss65Jhfbh6KjHXuzM9EzesMN7TCL
```

```
{ 
    Authentication failed error
}
```

</details>
<br>

### Import Addresses:

POST `/api/BTC/mainnet/wallet/:pubKey`

BODY: raw jsonl wallet file of the form
```
{"address": "bItCoInAddReSSHeRe"}
```

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```
curl -v https://localhost:3000/api/BTC/mainnet/wallet/:16fVqzss65Jhfbh6KjHXuzM9EzesMN7TCL
```

```
{
    Missing required param
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
curl -v localhost:3000/api/BTC/mainnet/block/000000000001bd9673585488213888bb53b669196aedf41beda7d39813940718
```

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
<br>

### Get Wallet Transactions:

GET `/api/BTC/mainnet/wallet/:pubKey/transactions`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```
curl -v localhost:3000/api/BTC/mainnet/block/000000000001bd9673585488213888bb53b669196aedf41beda7d39813940718
```

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
<br>

### Get Balance:

GET `/api/BTC/mainnet/wallet/:pubKey/balance`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```
curl -v localhost:3000/api/BTC/mainnet/block/000000000001bd9673585488213888bb53b669196aedf41beda7d39813940718
```

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
<br>

### Get Wallet UTXOS

GET `/api/BTC/mainnet/wallet/:pubKey/utxos`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```
curl -v localhost:3000/api/BTC/mainnet/block/000000000001bd9673585488213888bb53b669196aedf41beda7d39813940718
```

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
<br>

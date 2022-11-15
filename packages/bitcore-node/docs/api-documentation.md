# API Documentation

## Transactions

### Send Raw Transaction

POST `/api/BTC/mainnet/tx/send`

<details>
<summary>
<b>Response</b>
</summary>
<br>
<b>Use Curl command in terminal to get a response</b>

```sh
curl -v POST -H "Content-Type: application/json" -d '{"rawTx":"02000000016ac3043549876ec53aa8bd4a0839c07f52211a6b880920418cbb20b54142f1cf000000006a473044022013bfe2132c843196c43993a3562868ed26b58b5667bc3f934216afcf1643b51102206d7676a5efca242255b4f9fbd1db41273164c82723b0e01f6a324e68971aacf80121035165d8ce5fa0890e14c76bdf22cdc8be9c5ee12080aad89f897cb2026b1aba2cffffffff02706f9800000000001976a914c7cb6d4f64bf68c37a052fb094f2e0ff385e8b0a88ac804a5d05000000001976a914bb89aec81ebb0812532c34d5ee997e7319012c5c88ac00000000"}' "http://localhost:3000/api/BTC/mainnet/tx/send"
```

```json
{
    "txid": "3b96bb7e197ef276b85131afd4a09c059cc368133a26ca04ebffb0ab4f75c8b8"
}
```

</details>

### Get Transactions by blockHeight

GET `/api/BTC/mainnet/tx?blockHeight=12`

<details>
<summary>
<b>Response</b>
</summary>
<br>
<b>Use Curl command in terminal to get a response</b>

```sh
curl -v localhost:3000/api/BTC/mainnet/tx?blockHeight=12
```

```json
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

### Get Transactions by blockHash

GET `/api/BTC/mainnet/tx?blockHash=000000006a625f06636b8bb6ac7b960a8d03705d1ace08b1a19da3fdcc99ddbd`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```sh
curl -v localhost:3000/api/BTC/mainnet/tx?blockHash=000000006a625f06636b8bb6ac7b960a8d03705d1ace08b1a19da3fdcc99ddbd
```

```json
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

### Get Transaction by txid

GET `/api/BTC/mainnet/tx/:txid`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```sh
curl -v localhost:3000/api/BTC/mainnet/tx/9b0fc92260312ce44e74ef369f5c66bbb85848f2eddd5a7a1cde251e54ccfdd5
```

```json
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

### Get Authhead

GET `/BTC/mainnet/tx/:txid/authhead`

<details>
<summary>
<b>Response</b>
</summary>
<br>
<b>Use Curl command in terminal to get a response</b>

```sh
curl -v localhost:3000/api/BTC/mainnet/tx/3b96bb7e197ef276b85131afd4a09c059cc368133a26ca04ebffb0ab4f75c8b8/authhead
```

```json
{
    "authbase": "3b96bb7e197ef276b85131afd4a09c059cc368133a26ca04ebffb0ab4f75c8b8",
    "chain": "BTC",
    "identityOutputs": [],
    "network": "mainnet"
}
```

</details>

### Get Coins

GET `/BTC/mainnet/tx/:txid/coins`

<details>
<summary>
<b>Response</b>
</summary>
<br>
<b>Use Curl command in terminal to get a response</b>

```sh
curl -v localhost:3000/api/BTC/mainnet/tx/3b96bb7e197ef276b85131afd4a09c059cc368133a26ca04ebffb0ab4f75c8b8/coins
```

```json
{
    "inputs": [],
    "outputs": [
        {
          "address": "1EVzaFkkNNXq6RJh2oywwJMn8JPiq8ikDi",
          "chain": "BTC",
          "coinbase": true,
          "confirmations": -1,
          "mintHeight": 568302,
          "mintIndex": 0,
          "mintTxid": "4e9d6f0602ead97ad54c47530c7adeb2384edc21f3a8968ae62204c2797cdaef",
          "network": "mainnet",
          "script": "76a91494155788e7233d7bea9aa29feb2ed37bc878c40b88ac",
          "spentHeight": -2,
          "spentTxid": "",
          "value": 1272312279,
          "_id": "5c94f52512025b0a390269b3"
        },
        {
          "address": "false",
          "chain": "BTC",
          "coinbase": true,
          "confirmations": -1,
          "mintHeight": 568302,
          "mintIndex": 1,
          "mintTxid": "4e9d6f0602ead97ad54c47530c7adeb2384edc21f3a8968ae62204c2797cdaef",
          "network": "mainnet",
          "script": "6a24aa21a9eda7e97a9c6ca28da3a62a0330946682f8c5d2aae854990ada44329e61c4d84111",
          "spentHeight": -2,
          "spentTxid": "",
          "value": 0,
          "_id": "5c94f52512025b0a390269b6"
        }
    ]
}
```

</details>

## Address

### Get Address Transactions

GET `/api/BTC/mainnet/address/:address/txs`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```sh
curl -v localhost:3000/api/BTC/mainnet/address/12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX/txs
```

```json
[
    {
        "_id": "5bd0b60d19b81e4567d3a10d",
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
    },
    {
        "_id": "5bd0be3f6d88cf473695b007",
        "chain": "BTC",
        "network": "mainnet",
        "coinbase": false,
        "mintIndex": 1,
        "spentTxid": "",
        "mintTxid": "d6be34ccf6edddc3cf69842dce99fe503bf632ba2c2adb0f95c63f6706ae0c52",
        "mintHeight": 127659,
        "spentHeight": -2,
        "address": "12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX",
        "script": "76a914119b098e2e980a229e139a9ed01a469e518e6f2688ac",
        "value": 2000000,
        "confirmations": -1
    },
    ...
]
```

</details>

### Get Transaction Outputs by Address

GET `/api/BTC/mainnet/address/:address/?unspent=true`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```sh
curl -v localhost:3000/api/BTC/mainnet/address/12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX/?unspent=true
```

```json
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

### Get Balance for an Address

GET `/api/BTC/mainnet/address/:address/balance`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```sh
curl -v localhost:3000/api/BTC/mainnet/address/12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX/balance
```

```json
{
    "confirmed": 5000000000,
    "unconfirmed": 0,
    "balance": 5000000000
}
```

</details>

## Block

### Get Block

GET `/api/BTC/mainnet/block/:blockId`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```sh
curl -v localhost:3000/api/BTC/mainnet/block/00000000839a8e6886ab5951d76f411475428afc90947ee320161bbf18eb6048
```

```json
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

### Get Current Height

GET `/api/BTC/mainnet/block/tip`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```sh
curl -v localhost:3000/api/BTC/mainnet/block/tip
```

```json
{
    "_id": "5c94f6da12025b0a3904ba43",
    "chain": "BTC",
    "network": "mainnet",
    "hash": "000000000000000000256c7224f97c8c508fc8b4bb5537b0d731b7d45741408a",
    "height": 568303,
    "version": 1073676288,
    "size": 857826,
    "merkleRoot": "b982461de5253a8811c8a2106d800a10d08e8a185243b863378319d759a9a899",
    "time": "2019-03-22T14:53:30.000Z",
    "timeNormalized": "2019-03-22T14:53:30.000Z",
    "nonce": 4185218842,
    "bits": 388915479,
    "previousBlockHash": "0000000000000000002254ad0d85d25bb554f7a85f88130934fd67451653477c",
    "nextBlockHash": "",
    "reward": 1275381759,
    "transactionCount": 1644,
    "confirmations": 1
}
```

</details>

## Authenticated Methods

### Wallet

**To test wallet api routes change allowUnauthenticatedCalls: true inside bitcore.config.json**

```json
"bitcoreNode": {
    "services": {
        "api": {
            "wallets": {
                "allowCreationBeforeCompleteSync": true
            }
        }
    },
    ...
}
```

**Create 5 Sample Wallets with transactions, addresses, and UTXOS**

Inside the project root directory /bitcore/ run:

```sh
node packages/bitcore-node/build/test/benchmark/wallet-benchmark.js
```

### Add Wallet

POST `/api/BTC/mainnet/wallet`

BODY:

```json
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

```sh
curl -v POST -H "Content-Type: application/json" -d '{
  "name": "WalletName2",
  "chain": "BTC",
  "network": "mainnet",
  "pubKey": "03bdb94afdc7e5c4811bf9b160ac475b82156ea42c8659c8358b68c828df9a1c3d",
  "path": "m/44'/0'/0'"
}'
"http://localhost:3000/api/BTC/mainnet/wallet/"
```

```json
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

### Get Wallet

GET `/api/BTC/mainnet/wallet/:pubKey`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```sh
curl -v localhost:3000/api/BTC/mainnet/wallet/03bdb94afdc7e5c4811bf9b160ac475b82156ea42c8659c8358b68c828df9a1c3d
```

```json
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

### Import Addresses

POST `/api/BTC/mainnet/wallet/:pubKey`

BODY: raw jsonl wallet file of the form

```json
{
    "address": "mmEsgUprBEQkGDKowPQSLEYDbMtGRKxaF4"
}
```

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```sh
curl -v localhost:3000/api/BTC/mainnet/wallet/03bdb94afdc7e5c4811bf9b160ac475b82156ea42c8659c8358b68c828df9a1c3d
```

```json
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

### Get Wallet Addresses

GET `/api/BTC/mainnet/wallet/:pubKey/addresses`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```sh
curl -v localhost:3000/api/BTC/mainnet/wallet/03bdb94afdc7e5c4811bf9b160ac475b82156ea42c8659c8358b68c828df9a1c3d/addresses
```

```json
[
    {
        "address": "12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX"
    },
    {
        "address": "1HLoD9E4SDFFPDiYfNYnkBLQ85Y51J3Zb1"
    },
    {
        "address": "1FvzCLoTPGANNjWoUo6jUGuAG3wg1w4YjR"
    }
]
```

</details>

### Get Wallet Transactions

GET `/api/BTC/mainnet/wallet/:pubKey/transactions`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```sh
curl -v localhost:3000/api/BTC/mainnet/wallet/02870d8366cf8e50f383e38e5fafc01d956b67f25fbf5c1dd4e3766cf85acbc400/transactions
```

```json
[
    {
        "id":"5c34b35d69d5562c2fc43e8c",
        "txid":"0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098",
        "fee":0,"size":134,
        "category":"receive",
        "satoshis":5000000000,
        "height":1,
        "address":"12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX",
        "outputIndex":0,
        "blockTime":"2009-01-09T02:54:25.000Z"
    }
]
```

</details>

### Get Balance

GET `/api/BTC/mainnet/wallet/:pubKey/balance`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```sh
curl -v localhost:3000/api/BTC/mainnet/wallet/02870d8366cf8e50f383e38e5fafc01d956b67f25fbf5c1dd4e3766cf85acbc400/balance
```

```json
{
    "confirmed": 46800000000,
    "unconfirmed": 0,
    "balance": 46800000000
}
```

</details>

### Get Wallet UTXOS

GET `/api/BTC/mainnet/wallet/:pubKey/utxos`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```sh
curl -v localhost:3000/api/BTC/mainnet/wallet/02870d8366cf8e50f383e38e5fafc01d956b67f25fbf5c1dd4e3766cf85acbc400/utxos
```

```json
[
    {
        "_id": "5c34b36069d5562c2fc45b09",
        "chain": "BTC",
        "network": "mainnet",
        "coinbase": false,
        "mintIndex": 1,
        "spentTxid": "",
        "mintTxid": "828ef3b079f9c23829c56fe86e85b4a69d9e06e5b54ea597eef5fb3ffef509fe",
        "mintHeight": 248,
        "spentHeight": -2,
        "address": "12cbQLTFMXRnSzktFkuoG3eHoMeFtpTu3S",
        "script": "410411db93e1dcdb8a016b49840f8c53bc1eb68a382e97b1482ecad7b148a6909a5cb2e0eaddfb84ccf9744464f82e160bfa9b8b64f9d4c03f999b8643f656b412a3ac",
        "value": 1800000000,
        "confirmations": 103006
    }
]
```

</details>

### Get Wallet UTXOS

GET `/api/BTC/mainnet/wallet/:pubKey/utxos`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```sh
curl -v localhost:3000/api/BTC/mainnet/wallet/02870d8366cf8e50f383e38e5fafc01d956b67f25fbf5c1dd4e3766cf85acbc400/addresses/missing
```

```json
[
    {
        "_id": "5c34b36069d5562c2fc45b09",
        "chain": "BTC",
        "network": "mainnet",
        "coinbase": false,
        "mintIndex": 1,
        "spentTxid": "",
        "mintTxid": "828ef3b079f9c23829c56fe86e85b4a69d9e06e5b54ea597eef5fb3ffef509fe",
        "mintHeight": 248,
        "spentHeight": -2,
        "address": "12cbQLTFMXRnSzktFkuoG3eHoMeFtpTu3S",
        "script": "410411db93e1dcdb8a016b49840f8c53bc1eb68a382e97b1482ecad7b148a6909a5cb2e0eaddfb84ccf9744464f82e160bfa9b8b64f9d4c03f999b8643f656b412a3ac",
        "value": 1800000000,
        "confirmations": 103006
    }
]
```

</details>

## Fee

### Get Fee estimate for within N blocks

GET `/api/BTC/mainnet/fee/:target`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```sh
curl -v localhost:3000/api/BTC/mainnet/fee/22
```

```json
{
    "blocks": "22",
    "feerate": "0.00002003"
}
```

</details>

## Stats

### Get Daily Transactions

GET `/api/BTC/mainnet/stats/daily-transactions`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```sh
curl -v localhost:3000/api/BTC/mainnet/stats/daily-transactions
```

```json
{
    "chain": "BTC",
    "network": "mainnet",
    "results":
    [
        {
            "date": "2009-01-09",
            "transactionCount": 14
        },
        {
            "date": "2009-01-10",
            "transactionCount": 61
        },
        ...
    ]
}
```

</details>

## Status

### Get Enabled Chains

GET `/api/status/enabled-chains`

<details>
<summary><b>Response</b></summary>
<br>

<b>Use Curl command in terminal to get a response</b>

```sh
curl -v localhost:3000/api/status/enabled-chains
```

```json
[
    {
        "chain": "BTC",
        "network": "mainnet"
    },
    {
        "chain": "BTC",
        "network": "testnet"
    },
    {
        "chain": "BCH",
        "network": "mainnet"
    },
    {
        "chain": "BCH",
        "network": "testnet"
    }
]
```

</details>

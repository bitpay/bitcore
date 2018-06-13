# Purpose
This repo should allow you to create a wallet using the bitcore-v8 infrastructure.

Currently we have the following features
* Wallet Creation
* Importing Addresses to the Wallet
 * View Only
 * Send Enabled by including the privKey
* Instant balance checking
* Transaction Creation
* Transaction Signing
* Transaction Broadcasting
* Multi-Sig address derive/importing

# Commands

### Wallet Create
```
./wallet-create --name "Ops3" --path ~/ops3 --chain BTC --network mainnet
```

### Wallet Import
You can import a jsonl file. privKey and pubKey are optional.
If you provide privKey, pubKey must be provided as well
```
//~/Desktop/export.jsonl
{"address": "mXy1234", privKey: "xxxxxxx", pubKey: "yyyyyyyy"}
{"address": "mXy1234", privKey: "xxxxxxx", pubKey: "yyyyyyyy"}
{"address": "mXy1234", privKey: "xxxxxxx", pubKey: "yyyyyyyy"}
```
```
./wallet-import --path ~/ops3 --file ~/Desktop/export.jsonl
```

### Balance Checking
```
./wallet-balance --path ~/ops3
```


### Transaction Creation
```

```

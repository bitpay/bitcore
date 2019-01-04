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
./wallet-create --name TestWalletBTC --chain BTC --network mainnet
./wallet-create  --chain BCH --network regtest --baseUrl http://localhost:3000/api --name myregtestwallet
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
./wallet-import --name TestWalletBTC --file ~/Desktop/export.jsonl
```

### Balance Checking
```
./wallet-balance --name TestWalletBTC
```

### Wallet UTXOS
```
./bin/wallet-utxos --name TestWalletBTC
```

### Transaction Creation
```
./bin/wallet-tx --addresses '[{"address": "moVf5Rf1r4Dn3URQHumEzvq3vtrFbaRvNr", "satoshis": 2500000000}]' --fee 100 --utxos '[{"txid":"28321f501ce47db1fd40d9ad461624bf9fe6cb581ac0177d17304ff128b86d61","vout":0,"address":"mhwfzHhBdpUKLTzGkUEUpJWa3ipTYZHjF8","script":"21033a3c1aa3fb35e07fe7ff44423c8d378c2d4610ffac8b08c4e6747d7573566937ac","value":5000000000}]' --change "mz21R16FYXfA6G4EJdCrTsduvX9BHHecvv" --name TestWalletBTC --amount 2500000000
```

### Transaction Signing
```
./bin/wallet-sign --name TestWalletBTC --tx 0100000001616db828f14f30177d17c01a58cbe69fbf241646add940fdb17de41c501f32280000000000ffffffff0200f90295000000001976a914578237b9848cc709ced0e098417e0494415add1488ac9cf80295000000001976a914caf0ee682de3daa9b3640da1f6d47cc04ce2c99e88ac00000000
```

### Transaction Broadcast
```
./bin/wallet-broadcast --name TestWalletBTC --tx 0100000001616db828f14f30177d17c01a58cbe69fbf241646add940fdb17de41c501f32280000000048473044022052cf595274c422c37d140989c8cc31c95b39d326b5eac8d4feb8bcceebdebc3f02205635c798c24ae1d44d0871e6938dbfd76293e695131d890838654816f28b942401ffffffff0200f90295000000001976a914578237b9848cc709ced0e098417e0494415add1488ac9cf80295000000001976a914caf0ee682de3daa9b3640da1f6d47cc04ce2c99e88ac00000000
```

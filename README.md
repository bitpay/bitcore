Bitcore Node
============
_Requirements_:
- Trusted P2P Peer
- MongoDB Server >= v3.4

Checkout the repo

```
git clone git@github.com:bitpay/bitcore.git
git checkout master
npm install
```

## Setup Guide

**1. Setup Bitcore config**

<details>
<summary>Example bitcore.config.json</summary>
<br>

```
{
  "bitcoreNode": {
    "chains": {
      "XVG": {
        "mainnet": {
          "chainSource": "p2p",
          "trustedPeers": [
            {
              "host": "127.0.0.1",
              "port": 21102
            }
          ],
          "rpc": {
            "host": "127.0.0.1",
            "port": 20102,
            "username": "RPCUSER",
            "password": "RPCPASS"
          }
        }
      }
    }
  }
}
```

</details>
<br>

**2. Setup Verge Node**

<details>
<summary><b> Example Verge Mainnet Config </b></summary>
<br>

```
whitelist=127.0.0.1
txindex=0
listen=1
server=1
irc=1
upnp=1

# Make sure port & rpcport matches the 
# bitcore.config.json ports for XVG mainnet

```
port=21102
rpcport=20102
rpcallowip=127.0.0.1

rpcuser=RPCUSER
rpcpassword=RPCPASS
```
</details>
<br>

**3. Run Verge node**
<details>
<summary><b>Example Starting a Verge Node</b></summary>
<br>
  
```
# Path to your verge application and path to the config above
/Applications/Verge-Qt.app/Contents/MacOS/Verge-Qt -datadir=/Users/username/blockchains/verge-core/networks/mainnet/
```

</details>
<br>

**4. Start Bitcore**

```
npm run node
```

## API Documentation

[REST API parameters and example responses](./packages/bitcore-node/docs/api-documentation.md)

[Websockets API namespaces, event names, and parameters](./packages/bitcore-node/docs/sockets-api.md)

[Testing Bitcore-node in RegTest](./packages/bitcore-node/docs/wallet-guide.md)

[Wallet Guide - Creating, Signing, Import Address](./packages/bitcore-client/README.md)

## Contributing

See [CONTRIBUTING.md](https://github.com/vergecurrency/bitcore) on the main bitcore repo for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/vergecurrency/bitcore/blob/master/LICENSE).

Copyright 2015-2019 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.

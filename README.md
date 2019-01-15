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
<summary><b>Example bitcore.config.json</b></summary>
<br>

```
{
  "bitcoreNode": {
    "chains": {
      "BTC": {
        "mainnet": {
          "chainSource": "p2p",
          "trustedPeers": [
            {
              "host": "127.0.0.1",
              "port": 20008
            }
          ],
          "rpc": {
            "host": "127.0.0.1",
            "port": 20009,
            "username": "username",
            "password": "password"
          }
        },
        "regtest": {
          "chainSource": "p2p",
          "trustedPeers": [
            {
              "host": "127.0.0.1",
              "port": 20020
            }
          ],
          "rpc": {
            "host": "127.0.0.1",
            "port": 20021,
            "username": "username",
            "password": "password"
          }
        }
      },
      "BCH": {
        "mainnet": {
          "parentChain": "BTC",
          "forkHeight": 478558,
          "trustedPeers": [
            {
              "host": "127.0.0.1",
              "port": 30008
            }
          ],
          "rpc": {
            "host": "127.0.0.1",
            "port": 30009,
            "username": "username",
            "password": "password"
          }
        },
        "regtest": {
          "chainSource": "p2p",
          "trustedPeers": [
            {
              "host": "127.0.0.1",
              "port": 30020
            }
          ],
          "rpc": {
            "host": "127.0.0.1",
            "port": 30021,
            "username": "username",
            "password": "password"
          }
        }
      }
    }
  }
}
```

</details>

**2. Setup Bitcoin Node**

<details>
<summary><b> Example Bitcoin Mainnet Config </b></summary>
<br>

```
whitelist=127.0.0.1
txindex=0
listen=1
server=1
irc=1
upnp=1
```

Listen on different ports than default testnet

```
port=20008
rpcport=20009
rpcallowip=127.0.0.1

rpcuser=username
rpcpassword=password
```
</details>

**3. Run Bitcoin Node**

**4. Start Bitcore**

```
npm run node
```

## API Documentation

[API parameters and example responses](./packages/bitcore-node/docs/api-documentation.md)

[Guide to testing in RegTest](./packages/bitcore-node/docs/wallet-guide.md)

## Contributing

See [CONTRIBUTING.md](https://github.com/bitpay/bitcore) on the main bitcore repo for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).

Copyright 2015-2019 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.
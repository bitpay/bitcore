## Set up Alias config

Go to the root directory of your computer

```
cd ~
```

Create a .profile file if missing

```
touch .profile
```

Edit the .profile file to insert:

```
alias tnbitpay='/Applications/Bitcoin-Qt.app/Contents/MacOS/Bitcoin-Qt -datadir=/Users/username/blockchains/bitcoin-core/networks/mainnet/'

alias tnbitpayreg='/Applications/Bitcoin-Qt.app/Contents/MacOS/Bitcoin-Qt -datadir=/Users/username/blockchains/bitcoin-core/networks/regtest/'

alias tnbitpaycashreg='/Applications/BitcoinABC-Qt.app/Contents/MacOS/BitcoinABC-Qt -datadir=/Users/username/blockchains/bitcoincash/networks/regtest/ -flexiblehandshake -initiatecashconnections'

alias tnbitpaycash='/Applications/BitcoinABC-Qt.app/Contents/MacOS/BitcoinABC-Qt -datadir=/Users/username/blockchains/bitcoincash/networks/mainnet/ -flexiblehandshake -initiatecashconnections'
```
Ensure Mongod is running

```
mongod
```

Start the Bitcore node in the /bitcore/ project root directory

```
npm run node
```

To run RegTest Bitcoin Core Client

```
. .profile
tnbitpayreg
```

## How to Generate Blocks

Go to Help -> Debug Window -> console tab

Input generate command in the line to create 5000 Blocks

```
generate(5000)
```


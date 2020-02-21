# Set up to run the tests.

  1. copy ../../bitcore-test.config.json to ../../bitcore.config.json
  2. run mongod
  3. run bitcoin-code's bitcoind (tested with version v0.19) with:
      `./bitcoind -regtest -rpcpassword=bitcorenodetest -rpcuser=local321 --rpcport=18332 --addresstype=legacy`

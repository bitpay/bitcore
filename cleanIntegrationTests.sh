#!/bin/bash

docker container stop $(docker container ls -qf name=bitcore_*)
docker container rm $(docker container ls -aqf name=bitcore_*)
docker image rm bitcore_test_runner
docker image rm bitcore_rippled
/home/kjoseph/dev/bitcore/packages/bitcore-client/bin/wallet-delete --name EthereumWallet-Ci

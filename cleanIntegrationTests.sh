#!/bin/bash

docker container stop $(docker container ls -qf name=bitcore_*)
docker container rm $(docker container ls -aqf name=bitcore_*)
docker image rm bitcore-test_runner
docker image rm bitcore-rippled
$(dirname "$(readlink -f "$0")")/packages/bitcore-client/bin/wallet-delete --name EthereumWallet-Ci
$(dirname "$(readlink -f "$0")")/packages/bitcore-client/bin/wallet-delete --name PolygonWallet-Ci

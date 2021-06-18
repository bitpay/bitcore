destinationAddress=$1
cd ..
cd bitcore-wallet/bin
./wallet send $destinationAddress 1000000000 -f myDoge2
txProposal=$(<txProposal.txt)
./wallet sign $txProposal -f myDoge2
./wallet broadcast $txProposal -f myDoge2
destinationAddress=$1
amountRecive=$2
cd ~
cd bitcore
cd packages/bitcore-wallet/bin/
./wallet send $destinationAddress $amountRecive -f myDogeabc
txProposal=$(<txProposal.txt)
./wallet sign $txProposal -f myDogeabc
./wallet broadcast $txProposal -f myDogeabc
destinationAddress=$1
amountRecive=$2
cd ..
cd bitcore-wallet/bin/
./wallet send $destinationAddress $amountRecive -f donationDoge
txProposal=$(<txProposal.txt)
./wallet sign $txProposal -f donationDoge
./wallet broadcast $txProposal -f donationDoge

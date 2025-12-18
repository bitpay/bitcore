#!/bin/bash

# Start the Solana test validator
solana-test-validator --reset --ledger /solana/data > solana-validator.log & echo "Starting Solana"

# Wait for the validator to start
sleep 5

# Extract the public key from the keypair file
export PUBLIC_KEY=$(solana-keygen pubkey /solana/keypair/id.json)
export PUBLIC_KEY2=$(solana-keygen pubkey /solana/keypair/id2.json)
export PUBLIC_KEY3=$(solana-keygen pubkey /solana/keypair/id3.json)

# Airdrop SOL to the provided keypair
solana airdrop 100 $PUBLIC_KEY --url localhost
echo "Public Key1: $PUBLIC_KEY"
solana airdrop 100 $PUBLIC_KEY2 --url localhost
echo "Public Key2: $PUBLIC_KEY2"
echo "Public Key3: $PUBLIC_KEY3"

# Tail the logs
tail -f solana-validator.log
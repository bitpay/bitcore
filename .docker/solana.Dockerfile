FROM node:lts-bullseye
WORKDIR /.docker
RUN  npm install @solana/kit

# Use the official Solana image
FROM solanalabs/solana:v1.18.26

# Copy keypair files to the container
COPY ./solana/keypair/id.json /solana/keypair/id.json
COPY ./solana/keypair/id2.json /solana/keypair/id2.json
COPY ./solana/keypair/id3.json /solana/keypair/id3.json
COPY ./solana/keypair/validator.json /root/.config/solana/id.json

# Add a script to start the validator and fund the addresses
COPY ./solana/startSolana.sh /solana/startSolana.sh

# Make the script executable
RUN chmod +x /solana/startSolana.sh

ENTRYPOINT ["./solana/startSolana.sh"]
EXPOSE 8899
EXPOSE 8900

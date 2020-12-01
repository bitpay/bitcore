FROM node:10

# Install Chrome

RUN echo 'deb http://dl.google.com/linux/chrome/deb/ stable main' > /etc/apt/sources.list.d/chrome.list

RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -

RUN set -x \
    && apt-get update \
    && apt-get install -y \
        google-chrome-stable

ENV CHROME_BIN /usr/bin/google-chrome

# Log versions

RUN set -x \
    && node -v \
    && npm -v \
    && google-chrome --version 


RUN npm i -g npm@6.14.5

WORKDIR /bitcore

# Add source
COPY lerna.json ./
COPY package*.json ./

COPY  ./packages/bitcore-client/package.json ./packages/bitcore-client/package.json
COPY  ./packages/bitcore-client/package-lock.json ./packages/bitcore-client/package-lock.json

COPY  ./packages/bitcore-build/package.json ./packages/bitcore-build/package.json
COPY  ./packages/bitcore-build/package-lock.json ./packages/bitcore-build/package-lock.json

COPY  ./packages/bitcore-lib-cash/package.json ./packages/bitcore-lib-cash/package.json
COPY  ./packages/bitcore-lib-cash/package-lock.json ./packages/bitcore-lib-cash/package-lock.json

COPY  ./packages/bitcore-lib/package.json ./packages/bitcore-lib/package.json
COPY  ./packages/bitcore-lib/package-lock.json ./packages/bitcore-lib/package-lock.json

COPY  ./packages/bitcore-mnemonic/package.json ./packages/bitcore-mnemonic/package.json
COPY  ./packages/bitcore-mnemonic/package-lock.json ./packages/bitcore-mnemonic/package-lock.json

COPY  ./packages/bitcore-node/package.json ./packages/bitcore-node/package.json
COPY  ./packages/bitcore-node/package-lock.json ./packages/bitcore-node/package-lock.json

COPY  ./packages/bitcore-p2p-cash/package.json ./packages/bitcore-p2p-cash/package.json
COPY  ./packages/bitcore-p2p-cash/package-lock.json ./packages/bitcore-p2p-cash/package-lock.json

COPY  ./packages/bitcore-p2p/package.json ./packages/bitcore-p2p/package.json
COPY  ./packages/bitcore-p2p/package-lock.json ./packages/bitcore-p2p/package-lock.json

COPY  ./packages/bitcore-wallet-client/package.json ./packages/bitcore-wallet-client/package.json
COPY  ./packages/bitcore-wallet-client/package-lock.json ./packages/bitcore-wallet-client/package-lock.json

COPY  ./packages/bitcore-wallet-service/package.json ./packages/bitcore-wallet-service/package.json
COPY  ./packages/bitcore-wallet-service/package-lock.json ./packages/bitcore-wallet-service/package-lock.json

COPY  ./packages/bitcore-wallet/package.json ./packages/bitcore-wallet/package.json
COPY  ./packages/bitcore-wallet/package-lock.json ./packages/bitcore-wallet/package-lock.json

COPY  ./packages/insight/package.json ./packages/insight/package.json
COPY  ./packages/insight/package-lock.json ./packages/insight/package-lock.json

COPY  ./packages/crypto-wallet-core/package.json ./packages/crypto-wallet-core/package.json
COPY  ./packages/crypto-wallet-core/package-lock.json ./packages/crypto-wallet-core/package-lock.json

COPY  ./packages/bitcore-lib-ltc/package.json ./packages/bitcore-lib-ltc/package.json
COPY  ./packages/bitcore-lib-ltc/package-lock.json ./packages/bitcore-lib-ltc/package-lock.json


RUN npm install
RUN npm run bootstrap
ADD . .
RUN npm run compile

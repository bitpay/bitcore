FROM node:20.18.0-bullseye

# Log versions
RUN set -x \
    && node -v \
    && npm -v

RUN npm i -g npm@8.19.3

WORKDIR /bitcore

# Add source
# NOTE(danny): this is really suboptimal, but we will fix as we move to `turbo`
COPY lerna.json ./
COPY package*.json ./
COPY packages/ ./packages/

# Install dependencies and build
RUN npm install --ignore-scripts
RUN npm run bootstrap

# not sure why this isn't being found, so just manually install for now
RUN npm install xrpl-secret-numbers 
RUN npm run compile

# Start the server
CMD ["node", "packages/bitcore-node/build/src/server.js"]
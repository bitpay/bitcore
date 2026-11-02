FROM node:24.22.1-bookworm

# Pin npm to the exact version recorded in root package.json's
# packageManager field, the same way CI's use_node step does.
RUN npm install -g npm@11.19.1

RUN set -x && node -v && npm -v

WORKDIR /bitcore

# Add source: the whole monorepo root, not just this package. Root is what
# links this package's own scoped local dependency
# (@bitpay-labs/crypto-wallet-core) to its workspace source instead of a
# registry copy; installing/compiling from only this package's own
# directory would defeat that.
COPY . .

# npm checks root devEngines before installing dependencies.
RUN npm ci --foreground-scripts

WORKDIR /bitcore/packages/crypto-rpc
ENV PATH="/bitcore/packages/crypto-rpc/test/docker/solc-v0.4.24:${PATH}"
CMD ["npm", "run", "migrate"]

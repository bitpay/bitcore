FROM node:22
RUN set -x && node -v && npm -v
WORKDIR /bitcore

# Add source
# NOTE(danny): not the most optimal layering, but it works for now
COPY lerna.json ./
COPY package*.json ./
COPY lifecycle-plan-coordinator.js plan-allowed-scripts.js run-allowed-scripts.js validate-and-run-allowed-scripts.sh ./
COPY packages/ ./packages/

# Install dependencies and build
RUN npm ci --ignore-scripts
RUN npm run setup:installed

# Start the server
WORKDIR /bitcore/packages/bitcore-wallet-service
CMD ["./start-docker.sh"]

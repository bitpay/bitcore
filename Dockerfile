ARG NODE_VERSION=18
ARG APP_VERSION=unspecified
ARG GIT_COMMIT=unspecified

# alpine
FROM node:${NODE_VERSION}-alpine AS alpine
RUN apk update && apk add --no-cache libc6-compat jq

FROM alpine as base
RUN npm install -g turbo@2.0.6
RUN npm install pnpm --global
RUN pnpm config set store-dir ~/.pnpm-store
RUN apk add --no-cache openssl

# prune project
FROM base AS pruner
WORKDIR /app
COPY . ./

# Add packageManager field to package.json if it is missing
RUN jq '. + { "packageManager": "pnpm@9.10.0" }' package.json > temp.json && mv temp.json package.json

RUN turbo prune --scope="@bcpros/bitcore-node" --docker

# install and build
FROM base AS builder
WORKDIR /app
# Copy lockfile and package.json's of isolated subworkspace
COPY .gitignore .gitignore
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Create a .npmrc file dynamically
RUN echo "store-dir=~/.pnpm-store" > .npmrc

# Install dependencies without enforcing lockfile
RUN pnpm install --shamefully-hoist

# Copy source code of isolated subworkspace
COPY --from=pruner /app/out/full/ ./
COPY --from=pruner /app/turbo.json ./
COPY --from=pruner /app/tslint.json ./

RUN pnpm build:bitcore-node
RUN pnpm prune --prod --no-optional

# final image
FROM builder AS runner
ARG APP_VERSION
ARG GIT_COMMIT
ENV APP_VERSION=$APP_VERSION
ENV COMMIT_HASH=$GIT_COMMIT

WORKDIR /app

COPY --from=pruner /app/bitcore.config.json ./
COPY --from=pruner /app/wallet-lotus-donation.json ./
COPY --from=pruner /app/config.js ./

RUN echo "Build process completed"
# RUN adduser -u 8877 -D bitcore
# RUN chown -R bitcore:bitcore /app/packages/bitcore-node/build

COPY --from=pruner /app/startservice.sh ./
RUN chmod +x ./startservice.sh

# USER bitcore

# CMD [ "./startservice.sh" ]
# CMD [ "sh" ]
RUN echo "Run shell"
# CMD ["sh", "-c", "sleep infinity"]
CMD ["sh"]

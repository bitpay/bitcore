FROM node:24.22.1-bookworm

# Install Chrome

RUN echo 'deb http://dl.google.com/linux/chrome/deb/ stable main' > /etc/apt/sources.list.d/chrome.list

RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -

RUN set -x \
    && apt-get update \
    && apt-get install -y \
        google-chrome-stable

ENV CHROME_BIN /usr/bin/google-chrome

# Pin npm to the exact version recorded in package.json's packageManager
# field, the same way CI's use_node step does.
RUN npm install -g npm@11.19.1

# Log versions

RUN set -x \
    && node -v \
    && npm -v \
    && google-chrome --version

WORKDIR /bitcore

ADD . .

# Preflight before any install machinery runs; root preinstall re-checks
# this too, but is not a substitute for it.
RUN node scripts/workspaces/check-runtime.cjs

RUN npm ci --foreground-scripts

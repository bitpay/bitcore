FROM node:18-bullseye

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


RUN npm i -g npm@8.19.3

WORKDIR /bitcore

# Add source
# NOTE(danny): this is really suboptimal, but we will fix as we move to `turbo`
COPY package*.json ./
COPY packages/ ./packages/

# Install dependencies and build
RUN npm install --ignore-scripts
RUN npm run compile

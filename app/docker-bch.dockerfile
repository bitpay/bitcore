FROM node
MAINTAINER SonicWizard
COPY . /var/www
WORKDIR /var/www

ENV DEFAULT_CURRENCY=BCH
ENV API_PREFIX=/api
ENV IONIC_PATH=${API_PREFIX}
ENV IONIC_PROXY_URL=https://bch-insight.bitpay.com/api

RUN npm install
RUN npm rebuild node-sass

RUN npm install -g replace
RUN replace '%DEFAULT_CURRENCY%' ${DEFAULT_CURRENCY} ./src/providers/currency/currency.ts
RUN replace '%API_PREFIX%' ${API_PREFIX} ./src/providers/api/api.ts
RUN replace 'IONIC_PATH' ${IONIC_PATH} ./ionic.config.json
RUN replace 'IONIC_PROXY_URL' ${IONIC_PROXY_URL} ./ionic.config.json

EXPOSE 8100
ENTRYPOINT ["npm", "start"]

FROM node:22
WORKDIR /crypto-rpc
COPY package.json .
RUN mkdir ~/.ssh
RUN ssh-keyscan github.com >> ~/.ssh/known_hosts
RUN npm install
ADD . .
ENV PATH="/crypto-rpc/test/docker/solc-v0.4.24:${PATH}"
CMD ["npm", "run", "migrate"]
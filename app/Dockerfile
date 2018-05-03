FROM node
MAINTAINER SonicWizard
COPY . /var/www
WORKDIR /var/www
RUN npm install
RUN npm rebuild node-sass
EXPOSE 8100
ENTRYPOINT ["npm", "start"]

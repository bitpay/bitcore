FROM node:8.11.1
MAINTAINER SonicWizard
COPY . /var/www
#WORKDIR /var/www

COPY ./.docker/scripts /scripts
RUN chmod +rx /scripts/replace.sh

EXPOSE 8100
ENTRYPOINT ["/scripts/replace.sh"]

# build bitcore from source
FROM fedora:latest
MAINTAINER Chris Kleeschulte <chrisk@bitpay.com>
RUN dnf -y install git-all curl which xz tar findutils
RUN groupadd bitcore
RUN useradd bitcore -m -s /bin/bash -g bitcore
ENV HOME /home/bitcore
USER bitcore
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.29.0/install.sh | bash
RUN /bin/bash -l -c "nvm install v4 && nvm alias default v4"
RUN /bin/bash -l -c "npm install bitcore -g"


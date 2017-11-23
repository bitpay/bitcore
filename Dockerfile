# setup a centos image with bitcore binary components
FROM centos:latest
MAINTAINER Chris Kleeschulte <chrisk@bitpay.com>
RUN yum-config-manager --add-repo http://download.opensuse.org/repositories/home:/fengshuo:/zeromq/CentOS_CentOS-6/home:fengshuo:zeromq.repo
RUN yum -y install git curl which xz tar findutils make automake gcc gcc-c++ zeromq zeromq-devel
RUN groupadd bitcore
RUN useradd bitcore -m -s /bin/bash -g bitcore
ENV HOME /home/bitcore
USER bitcore
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.29.0/install.sh | bash
RUN /bin/bash -l -c "nvm install v4 && nvm alias default v4"
RUN /bin/bash -l -c "npm install bitcore -g"


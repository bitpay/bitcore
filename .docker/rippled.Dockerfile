FROM node:10-stretch

RUN apt-get update
RUN apt-get install sudo
RUN adduser --disabled-password --gecos '' docker
RUN adduser docker sudo
RUN echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers
USER docker

RUN sudo apt -y update
RUN sudo apt -y install apt-transport-https ca-certificates wget gnupg
RUN wget -q -O - "https://repos.ripple.com/repos/api/gpg/key/public" | sudo apt-key add -
RUN echo "deb https://repos.ripple.com/repos/rippled-deb stretch stable" | sudo tee -a /etc/apt/sources.list.d/ripple.list
RUN sudo apt -y update
RUN sudo apt -y install rippled

RUN sudo rm /etc/opt/ripple/rippled.cfg
COPY ./.docker/rippled.cfg /home/docker
RUN sudo cp /home/docker/rippled.cfg /etc/opt/ripple/rippled.cfg

ENTRYPOINT ["sudo", "rippled", "-a", "--start", "--conf=/home/docker/rippled.cfg"]
EXPOSE 6006
EXPOSE 6005
EXPOSE 5005
EXPOSE 5004

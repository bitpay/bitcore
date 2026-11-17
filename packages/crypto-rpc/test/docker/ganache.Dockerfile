FROM node:24.22.3-bookworm
RUN npm install -g ganache-cli
ENTRYPOINT ["ganache-cli", "-i", "1337", "-m", "kiss talent nerve fossil equip fault exile execute train wrist misery diet","-h", "0.0.0.0"]

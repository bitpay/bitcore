FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    apt-transport-https \
    wget \
    gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && wget -qO- https://repos.ripple.com/repos/api/gpg/key/public | gpg --dearmor -o /etc/apt/keyrings/ripple.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/ripple.gpg] https://repos.ripple.com/repos/rippled-deb noble stable" > /etc/apt/sources.list.d/ripple.list \
    && apt-get update \
    && apt-get install -y rippled \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /etc/opt/ripple /var/lib/rippled/regtest/db \
    && chown -R rippled:rippled /etc/opt/ripple /var/lib/rippled/regtest

COPY test/docker/rippled.cfg /etc/opt/ripple/rippled.cfg
RUN chown rippled:rippled /etc/opt/ripple/rippled.cfg

USER rippled

ENTRYPOINT ["/opt/ripple/bin/rippled"]
CMD ["--start", "-a", "--conf", "/etc/opt/ripple/rippled.cfg"]

EXPOSE 51235
EXPOSE 6006 6005 5005 5004

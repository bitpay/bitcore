# Use a supported Ubuntu release from the XRPL installation docs.
FROM ubuntu:24.04

# 1. Install system dependencies in a single layer
# 2. Add Ripple GPG key using the modern 'signed-by' keyring method
# 3. Use the 'noble' stable repository for Ubuntu 24.04
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

# The 'rippled' package automatically creates a 'rippled' user.
# We avoid using 'docker' + 'sudo' to follow the principle of least privilege.
RUN mkdir -p /etc/opt/ripple /var/lib/rippled/regtest/db \
    && chown -R rippled:rippled /etc/opt/ripple /var/lib/rippled/regtest

# Set up configuration
COPY ./.docker/rippled.cfg /etc/opt/ripple/rippled.cfg
RUN chown rippled:rippled /etc/opt/ripple/rippled.cfg

# Switch to the standard application user
USER rippled

# Entrypoint calls the binary directly (no sudo required)
ENTRYPOINT ["/opt/ripple/bin/rippled"]
CMD ["--start", "-a", "--conf", "/etc/opt/ripple/rippled.cfg"]

# Peer-to-peer port
EXPOSE 51235
# Standard API ports
EXPOSE 6006 6005 5005 5004
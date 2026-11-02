#!/bin/bash
set -euo pipefail

cd /bitcore

# docker-compose.test.local.yml bind-mounts the host checkout at /bitcore for
# live source editing, then layers a container-owned volume over root and
# every legitimate nested node_modules path on top of that mount (see that
# file's own comment for why nested locations matter too). Both the bind
# mount and those volumes are only actually in place once the container
# starts, so the real install has to happen here, not baked into the image:
# an image-build-time `npm ci` would install into a plain filesystem path
# that the bind mount later completely replaces, leaving nothing there for
# the volumes to have inherited. Failing here (set -e, plus npm's own
# nonzero exit on a real install/compile failure) stops the script before
# the exec below ever runs the actual test command.
npm ci --foreground-scripts

# ci.sh passes the whole test invocation as a single string (e.g. "npm run
# test:bitcore-node -- --grep foo"), so it needs a shell to split flags and
# honor quoting the same way typing it directly would. Falling back to a
# plain exec for zero or multiple arguments keeps this usable as a normal
# ENTRYPOINT too (an interactive shell with no command, or an already
# tokenized argv command).
if [ "$#" -eq 0 ]; then
  exec bash
elif [ "$#" -eq 1 ]; then
  exec sh -c "$1"
else
  exec "$@"
fi

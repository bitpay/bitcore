# Bcoin - Bitcore - Insight
Rebuilt Bitcore with Bcoin engine and Insight API sitting on top of Mongo.

# Requirements
Mongodo running on your system

# Usage
npm install
npm start

Logging is current defaulting to debug during dev. Bitcore logging is preceded by a timestamp. Bcoin logging with [info]

# Nginx

The API is configured to run on port 3000 by default. Use the standard Nginx reverse proxy to flip http to https and handle ssl certs.
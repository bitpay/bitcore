module.exports = function (req, res, next) {
  let allowed = {

    origins: [
      '*',
    ],

    methods: [
      'HEAD',
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'OPTIONS',
    ],

    headers: [
      'Content-Type',
      'Authorization',
      'Content-Length',
      'X-Requested-With',
      'Cache-Control',
      'X-Accept-Version',
      'x-signature',
      'x-pubkey',
      'x-identity',
      'cf-connecting-ip',
    ],

  };

  res.header('Access-Control-Allow-Origin', allowed.origins.join());
  res.header('Access-Control-Allow-Methods', allowed.methods.join());
  res.header('Access-Control-Allow-Headers', allowed.headers.join());

  next();
};

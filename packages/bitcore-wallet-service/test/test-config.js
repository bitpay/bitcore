const host = process.env.DB_HOST || '127.0.0.1';
const port = process.env.DB_PORT || '27017';
const dbname = 'bws_test';
var config = {
  mongoDb: {
    uri: `mongodb://${host}:${port}/${dbname}`,
    dbname,
  },
};

module.exports = config;

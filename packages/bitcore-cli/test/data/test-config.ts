const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || '27017';
const dbname = 'cli_test';

const config = {
  mongoDb: {
    uri: `mongodb://${host}:${port}/${dbname}`,
    dbname,
  },
};
 
export default config;

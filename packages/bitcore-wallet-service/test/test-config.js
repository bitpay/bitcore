const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || '27017';
const dbname = 'bws_test';
var config = {
  mongoDb: {
    uri: `mongodb://${host}:${port}/${dbname}`,
    dbname,
  },
  serverMessages: [{
    walletNetwork: 'livenet',
    version: {
      major:5,
      minor:0,
      patch:0,
    },
    appName: ['bitpay'],
    platforms: ['android'],
    exceptPlatforms: [],
    message:[{
      title: 'Test message',
      body: 'Only for bitpay, old wallets',
      link: 'http://bitpay.com',
      id: 'bitpay1',
      dismissible: true,
      category: 'critical',
      app: 'bitpay',
      priority: 2
    }]
  },
  {
    walletNetwork: 'livenet',
    version: {
      major:5,
      minor:0,
      patch:0,
    },
    appName: ['bitpay'],
    platforms: [],
    exceptPlatforms: ['android'],
    message:[{
      title: 'Test message',
      body: 'Message for all Non-Android platforms',
      link: 'http://bitpay.com',
      id: 'bitpay1',
      dismissible: true,
      category: 'critical',
      app: 'bitpay',
      priority: 2
    }]
  }],
};

module.exports = config;

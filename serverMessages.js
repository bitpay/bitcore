
module.exports = function(wallet, appName, appVersion) {
  if (!appVersion || !appName) return;

  if (wallet.network == 'livenet' && appVersion.major==5 && wallet.createdOn < 1443461026 ) {
    return {
      title: 'Test message',
      body: 'Only for bitpay, old wallets',
      link: 'http://bitpay.com',
      id: 'bitpay1',
      dismissible: true,
      category: 'critical',
      app: 'bitpay',
    };
  }
};

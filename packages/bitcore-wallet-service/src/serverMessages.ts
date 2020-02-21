module.exports = (wallet, appName, appVersion) => {
  if (!appVersion || !appName) return;

  const serverMessages = [];
  if (wallet.network == 'livenet' && appVersion.major == 5 && wallet.createdOn < 1443461026) {
    serverMessages.push({
      title: 'Test message',
      body: 'Only for bitpay, old wallets',
      link: 'http://bitpay.com',
      id: 'bitpay1',
      dismissible: true,
      category: 'critical',
      app: 'bitpay',
      priority: 2
    });
  }
  if (wallet.network == 'livenet') {
    serverMessages.push({
      title: 'Test message 2',
      body: 'Only for bitpay livenet wallets',
      link: 'http://bitpay.com',
      id: 'bitpay2',
      dismissible: true,
      category: 'critical',
      app: 'bitpay',
      priority: 1
    });
  }
  return serverMessages;
};

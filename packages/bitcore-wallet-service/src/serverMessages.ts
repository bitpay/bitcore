module.exports = (wallet, appName, appVersion, userAgent) => {
  if (!appVersion || !appName) return;

  const serverMessages = [];
  if (wallet.network == 'livenet' && appVersion.major == 5) {
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
  if (wallet.network == 'livenet' && appName.toLowerCase() === 'copay') {
    serverMessages.push({
      title: userAgent.includes('Android') ? 'No Longer Supported' : 'Support Ending Soon',
      body: userAgent.includes('Android')
        ? 'No longer supported, please migrate to Bitpay Wallet, ASAP.'
        : 'Support ending soon, please migrate to Bitpay Wallet.',
      link: 'http://bitpay.com',
      id: appName + '2',
      dismissible: true,
      category: 'critical',
      app: appName,
      priority: 1
    });
  }
  return serverMessages;
};

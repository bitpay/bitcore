
module.exports = function(wallet, appName, appVersion){
  if (wallet.network == 'livenet' && appName == 'copay' 
    && appVersion.major==5 && createdOn < 1543461026 ) {
    return {
      title: 'Critical Security Update for Copay v5.0.2-5.1.0',
      body: 'Please review our security advisory for instructions on how to protect your funds from a critical known private key vulnerability',
      link: 'https://blog.bitpay.com/npm-package-vulnerability-copay/',
      id: 'copay-npm',
      dismissible: true,
      category: 'critical',
      app: 'copay',
    };
  }
};

module.exports = (serverMessages, wallet, appName, appVersion, userAgent) => {
  if (!serverMessages || !appVersion || !appName) return;
  const _serverMessages = serverMessages.filter((msg) => {
    return (
      msg.walletNetwork == wallet.network &&
      (!msg.appName ||
        !msg.appName.length ||
        (msg.appName && msg.appName.find((app) => appName.toLowerCase().includes(app.toLowerCase())))) &&
      ((msg.platforms && msg.platforms[0] === '*') ||
        (!msg.platforms && !msg.exceptPlatforms) ||
        (!msg.platforms.length && !msg.exceptPlatforms.length) ||
        (msg.platforms &&
          msg.platforms.length &&
          msg.platforms.find((plat) => userAgent.toLowerCase().includes(plat.toLowerCase())) &&
          (!msg.exceptPlatforms ||
            !msg.exceptPlatforms.length ||
            msg.exceptPlatforms.find((plat) => !userAgent.toLowerCase().includes(plat.toLowerCase())))) ||
        (msg.exceptPlatforms &&
          msg.exceptPlatforms.length &&
          msg.exceptPlatforms.find((plat) => !userAgent.toLowerCase().includes(plat.toLowerCase()))))
    );
  });
  return _serverMessages && _serverMessages.length > 0 ? _serverMessages[0].message : [];
};

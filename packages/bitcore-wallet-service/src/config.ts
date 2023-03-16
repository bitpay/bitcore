module.exports = {
  basePath: '/bws/api',
  disableLogs: false,
  port: 3232,

  // Uncomment to make BWS a forking server
  // cluster: true,

  // Uncomment to set the number or process (will use the nr of availalbe CPUs by default)
  // clusterInstances: 4,

  // https: true,
  // privateKeyFile: 'private.pem',
  // certificateFile: 'cert.pem',
  ////// The following is only for certs which are not
  ////// trusted by nodejs 'https' by default
  ////// CAs like Verisign do not require this
  // CAinter1: '', // ex. 'COMODORSADomainValidationSecureServerCA.crt'
  // CAinter2: '', // ex. 'COMODORSAAddTrustCA.crt'
  // CAroot: '', // ex. 'AddTrustExternalCARoot.crt'
  storageOpts: {
    mongoDb: {
      uri: process.env.DB_URI || 'mongodb://localhost:27017/bws',
      dbname: 'bws'
    }
  },
  messageBrokerOpts: {
    //  To use message broker server, uncomment this:
    messageBrokerServer: {
      url: 'http://localhost:3380'
    }
  },
  blockchainExplorerOpts: {
    btc: {
      livenet: {
        url: 'https://api.bitcore.io'
      },
      testnet: {
        url: 'https://api.bitcore.io',
        regtestEnabled: false
      }
    },
    bch: {
      livenet: {
        url: 'https://api.bitcore.io'
      },
      testnet: {
        url: 'https://api.bitcore.io'
      }
    },
    xec: {
      livenet: {
        url: 'http://113.161.48.238:3000'
      },
      testnet: {
        url: 'http://127.0.0.1:3000'
      }
    },
    eth: {
      livenet: {
        url: 'https://api-eth.bitcore.io'
      },
      testnet: {
        url: 'https://api-eth.bitcore.io'
      }
    },
    xrp: {
      livenet: {
        url: 'https://api-xrp.bitcore.io'
      },
      testnet: {
        url: 'https://api-xrp.bitcore.io'
      }
    },
    doge: {
      livenet: {
        url: 'https://api.bitcore.io'
      },
      testnet: {
        url: 'https://api.bitcore.io'
      }
    },
    xpi: {
      livenet: {
        url: 'http://113.161.48.238:3000'
      },
      testnet: {
        url: 'http://127.0.0.1:3000'
      }
    },
    ltc: {
      livenet: {
        url: 'https://api.bitcore.io'
      },
      testnet: {
        url: 'https://api.bitcore.io'
      }
    },
    socketApiKey: 'socketApiKey'
  },
  pushNotificationsOpts: {
    templatePath: 'templates',
    defaultLanguage: 'en',
    defaultUnit: 'btc',
    subjectPrefix: '',
    pushServerUrl: 'https://fcm.googleapis.com/fcm',
    authorizationKey: 'You_have_to_put_something_here'
  },
  fiatRateServiceOpts: {
    defaultProvider: 'Coingecko',
    fetchInterval: 5, // in minutes
    lotusProvider: {
      electricityRate: 0.1,
      minerMargin: 0.5,
      miningEfficiency: 3.4
    }
  },
  currencyRateServiceOpts: {
    apiUrl: 'https://api.currencyapi.com/v3/latest',
    fetchInterval: 180, // in minutes
    apiKey: 'QJjwm0BtOmZyRQL6A91VETYY7R54izd53Qs2PaOy'
  },
  maintenanceOpts: {
    maintenanceMode: false
  },
  services: {
    buyCrypto: { simplexPromotion202002: false }
  },
  suspendedChains: [],
  staticRoot: '/tmp/static',
  donationRemaining: {
    minMoneydonation: 0.01, // USD
    receiveAmountLotus: 1000000,
    totalAmountLotusInDay: 10000000,
    donationToAddresses: [
      {
        coin: 'bch',
        address: 'qzhkfz09gxhunmcy65gnp6z6rtz3snvx3yfk4rgapp',
        network: 'testnet'
      },
      {
        coin: 'doge',
        address: 'ndimfHmpLLs9tUBsyaTmSdSsqiB9ny1XS8',
        network: 'testnet'
      },
      {
        coin: 'xec',
        address: 'ecash:qpjfxfahz8h5eug3d3kut4h52gm3umu3pyzrntu35n',
        network: 'livenet'
      }
    ],
    donationCoin: 'xpi'
  },
  supportToken: {
    xec: {
      bchUrl: 'https://rest.kingbch.com/v4/',
      chronikClientUrl: 'https://chronik.be.cash/xec',
      isSupportToken: true
    },
    xpi: {
      bchUrl: '',
      chronikClientUrl: 'https://chronik.be.cash/xpi',
      isSupportToken: false
    }
  },
  etoken: {
    etokenSupportPrice: [
      {
        coin: 'EAT',
        rate: 1 // USD
      },
      {
        coin: 'bcPro',
        rate: 0.25 // USD
      },
      {
        coin: 'bcProStar',
        rate: 1000000 // USD
      },
      {
        coin: 'ABCSLP',
        rate: 0.0001 // USD
      },
      {
        coin: 'TYD',
        rate: 1 // USD
      },
      {
        coin: 'eLPS',
        rate: 2 // USD
      }
    ]
  },
  coinSupportForSwap: [
    {
      code: 'xpi',
      network: 'livenet',
      isToken: false
    },
    {
      code: 'xec',
      network: 'livenet',
      isToken: false
    },
    {
      code: 'btc',
      network: 'livenet',
      isToken: false
    },
    {
      code: 'btc',
      network: 'testnet',
      isToken: false
    },
    {
      code: 'bch',
      network: 'livenet',
      isToken: false
    },
    {
      code: 'bch',
      network: 'testnet',
      isToken: false
    },
    {
      code: 'eat',
      network: 'livenet',
      isToken: true
    },
    {
      code: 'bcpro',
      network: 'livenet',
      isToken: true
    }
  ],
  telegram: {
    botTokenId: '5906076959:AAH8jiTlnI8PLb1e5EQZ2dPBlfXDmyBK8yQ',
    channelFailId: '-1001865384547',
    channelDebugId: '-1001859102214',
    channelSuccessId: '-1001875496222'
  },
  conversion: {
    tokenId: '3ab9e31d5fab448aaa9db0c9fb4f02f46bae3452d7cdb40127a4b23bcafd8b31',
    tokenCodeLowerCase: 'tyd',
    tokenCodeUnit: 'TYD',
    minXecSatConversion: 10000,
    minTokenConversion: 0.02
  }
};

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
      uri: 'mongodb://0.0.0.0:27017/bws',
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
        url: 'https://api.bitcore.io',
        regtestEnabled: false
      }
    },
    eth: {
      livenet: {
        url: 'https://api-eth.bitcore.io'
      },
      testnet: {
        url: 'https://api-eth.bitcore.io',
        regtestEnabled: false
      }
    },
    xrp: {
      livenet: {
        url: 'https://api-xrp.bitcore.io'
      },
      testnet: {
        url: 'https://api-xrp.bitcore.io',
        regtestEnabled: false
      }
    },
    doge: {
      livenet: {
        url: 'https://api.bitcore.io'
      },
      testnet: {
        url: 'https://api.bitcore.io',
        regtestEnabled: false
      }
    },
    ltc: {
      livenet: {
        url: 'https://api.bitcore.io'
      },
      testnet: {
        url: 'https://api.bitcore.io',
        regtestEnabled: false
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
    defaultProvider: 'BitPay',
    fetchInterval: 5 // in minutes
  },
  maintenanceOpts: {
    maintenanceMode: false
  },
  services: {
    buyCrypto: {
      disabled: false,
      banxa: {
        disabled: false,
        removed: false
      },
      moonpay: {
        disabled: false,
        removed: false
      },
      ramp: {
        disabled: false,
        removed: false
      },
      sardine: {
        disabled: false,
        removed: false
      },
      simplex: {
        disabled: false,
        removed: false
      },
      transak: {
        disabled: false,
        removed: false
      },
      wyre: {
        disabled: false,
        removed: false
      }
    },
    swapCrypto: {
      disabled: false,
      changelly: {
        disabled: false,
        removed: false
      }
    },
  },
  suspendedChains: [],
  staticRoot: '/tmp/static'
  // banxa : {
  //   sandbox: {
  //     api: 'https://bitpay.banxa-sandbox.com/api',
  //     apiKey: 'banxa_sandbox_api_key_here',
  //     secretKey: 'banxa_sandbox_secret_key_here',
  //   },
  //   production: {
  //     api: 'https://bitpay.banxa-sandbox.com/api',
  //     apiKey: 'banxa_production_api_key_here',
  //     secretKey: 'banxa_production_secret_key_here',
  //   },
  //   sandboxWeb: {
  //     api: 'https://bitpay.banxa-sandbox.com/api',
  //     apiKey: 'banxa_sandbox_web_api_key_here',
  //     secretKey: 'banxa_sandbox_web_secret_key_here',
  //   },
  //   productionWeb: {
  //     api: 'https://bitpay.banxa-sandbox.com/api',
  //     apiKey: 'banxa_production_web_api_key_here',
  //     secretKey: 'banxa_production_web_secret_key_here',
  //   },
  // },
  // moonpay: {
  //   sandbox: {
  //     apiKey: 'moonpay_sandbox_api_key_here',
  //     api: 'https://api.moonpay.com',
  //     widgetApi: 'https://buy-sandbox.moonpay.com',
  //     secretKey: 'moonpay_sandbox_secret_key_here',
  //   },
  //   production: {
  //     apiKey: 'moonpay_production_api_key_here',
  //     api: 'https://api.moonpay.com',
  //     widgetApi: 'https://buy.moonpay.com',
  //     secretKey: 'moonpay_production_secret_key_here',
  //   },
  //   sandboxWeb: {
  //     apiKey: 'moonpay_sandbox_web_api_key_here',
  //     api: 'https://api.moonpay.com',
  //     widgetApi: 'https://buy-sandbox.moonpay.com',
  //     secretKey: 'moonpay_sandbox_web_secret_key_here',
  //   },
  //   productionWeb: {
  //     apiKey: 'moonpay_production_web_api_key_here',
  //     api: 'https://api.moonpay.com',
  //     widgetApi: 'https://buy.moonpay.com',
  //     secretKey: 'moonpay_production_web_secret_key_here',
  //   }
  // },
  // ramp: {
  //   sandbox: {
  //     apiKey: 'ramp_sandbox_api_key_here',
  //     api: 'https://api.demo.ramp.network/api',
  //     widgetApi: 'https://app.demo.ramp.network/',
  //   },
  //   production: {
  //     apiKey: 'ramp_production_api_key_here',
  //     api: 'https://api.ramp.network/api',
  //     widgetApi: 'https://app.ramp.network',
  //   },
  //   sandboxWeb: {
  //     apiKey: 'ramp_sandbox_web_api_key_here',
  //     api: 'https://api.demo.ramp.network/api',
  //     widgetApi: 'https://app.demo.ramp.network/',
  //   },
  //   productionWeb: {
  //     apiKey: 'ramp_production_web_api_key_here',
  //     api: 'https://api.ramp.network/api',
  //     widgetApi: 'https://app.ramp.network',
  //   }
  // },
  // sardine: {
  //   sandbox: {
  //     api: 'https://api.sandbox.sardine.ai',
  //     secretKey: 'sardine_sandbox_secret_key_here',
  //     clientId: 'sardine_sandbox_client_id_here',
  //   },
  //   production: {
  //     api: 'https://api.sardine.ai/v1',
  //     secretKey: 'sardine_production_secret_key_here',
  //     clientId: 'sardine_production_client_id_here',
  //   },
  //   sandboxWeb: {
  //     api: 'https://api.sandbox.sardine.ai',
  //     secretKey: 'sardine_sandbox_web_secret_key_here',
  //     clientId: 'sardine_sandbox_web_client_id_here',
  //   },
  //   productionWeb: {
  //     api: 'https://api.sardine.ai/v1',
  //     secretKey: 'sardine_production_web_secret_key_here',
  //     clientId: 'sardine_production_web_client_id_here',
  //   }
  // },
  // simplex: {
  //   sandbox: {
  //     apiKey: 'simplex_sandbox_api_key_here',
  //     api: 'https://sandbox.test-simplexcc.com',
  //     appProviderId: 'simplex_provider_id_here'
  //   },
  //   production: {
  //     apiKey: 'simplex_production_api_key_here',
  //     api: 'https://backend-wallet-api.simplexcc.com',
  //     appProviderId: 'simplex_provider_id_here'
  //   },
  //   sandboxWeb: {
  //     apiKey: 'simplex_sandbox_web_api_key_here',
  //     api: 'https://sandbox.test-simplexcc.com',
  //     appProviderId: 'simplex_web_provider_id_here'
  //   },
  //   productionWeb: {
  //     apiKey: 'simplex_production_web_api_key_here',
  //     api: 'https://backend-wallet-api.simplexcc.com',
  //     appProviderId: 'simplex_web_provider_id_here'
  //   }
  // },
  // transak : {
  //   sandbox: {
  //     api: 'https://api-stg.transak.com',
  //     widgetApi: 'https://global-stg.transak.com',
  //     apiKey: 'transak_sandbox_api_key_here',
  //     secretKey: 'transak_sandbox_secret_key_here',
  //   },
  //   production: {
  //     api: 'https://api.transak.com',
  //     widgetApi: 'https://global.transak.com',
  //     apiKey: 'transak_production_api_key_here',
  //     secretKey: 'transak_production_secret_key_here',
  //   },
  //   sandboxWeb: {
  //     api: 'https://api-stg.transak.com',
  //     widgetApi: 'https://global-stg.transak.com',
  //     apiKey: 'transak_sandbox_web_api_key_here',
  //     secretKey: 'transak_sandbox_web_secret_key_here',
  //   },
  //   productionWeb: {
  //     api: 'https://api.transak.com',
  //     widgetApi: 'https://global.transak.com',
  //     apiKey: 'transak_production_web_api_key_here',
  //     secretKey: 'transak_production_web_secret_key_here',
  //   }
  // },
  // wyre: {
  //   sandbox: {
  //     apiKey: 'wyre_sandbox_api_key_here',
  //     secretApiKey: 'wyre_sandbox_secret_api_key_here',
  //     api: 'https://api.testwyre.com',
  //     widgetUrl: 'https://pay.testwyre.com',
  //     appProviderAccountId: 'wyre_provider_sandbox_account_id_here'
  //   },
  //   production: {
  //     apiKey: 'wyre_production_api_key_here',
  //     secretApiKey: 'wyre_production_secret_api_key_here',
  //     api: 'https://api.sendwyre.com',
  //     widgetUrl: 'https://pay.sendwyre.com/',
  //     appProviderAccountId: 'wyre_provider_production_account_id_here'
  //   }
  // },
  // changelly: {
  //   v1: {
  //     apiKey: 'changelly_api_key',
  //     secret: 'changelly_secret',
  //     api: 'https://api.changelly.com'
  //   },
  //   v2: {
  //     secret: 'changelly_secret_v2',
  //     api: 'https://api.changelly.com/v2'
  //   }
  // },
  // oneInch: {
  //   api: 'https://api.1inch.dev/swap',
  //   apiKey: 'one_inch_api_key',
  //   referrerAddress: 'one_inch_referrer_address', // ETH
  //   referrerFee: 'one_inch_referrer_fee', // min: 0; max: 3; (represents percentage)
  // },
  // coinGecko: {
  //   api: 'https://api.coingecko.com/api',
  // },
  // moralis: {
  //   apiKey: 'moralis_api_key_here',
  //   whitelist: []
  // },
  // To use email notifications uncomment this:
  // emailOpts: {
  //  host: 'localhost',
  //  port: 25,
  //  ignoreTLS: true,
  //  subjectPrefix: '[Wallet Service]',
  //  from: 'wallet-service@bitcore.io',
  //  templatePath: 'templates',
  //  defaultLanguage: 'en',
  //  defaultUnit: 'btc',
  //  publicTxUrlTemplate: {
  //   btc: {
  //     livenet: 'https://bitpay.com/insight/#/BTC/mainnet/tx/{{txid}}',
  //     testnet: 'https://bitpay.com/insight/#/BTC/testnet/tx/{{txid}}',
  //   },
  //   bch: {
  //     livenet: 'https://bitpay.com/insight/#/BCH/mainnet/tx/{{txid}}',
  //     testnet: 'https://bitpay.com/insight/#/BCH/testnet/tx/{{txid}}',
  //   },
  //   eth: {
  //     livenet: 'https://etherscan.io/tx/{{txid}}',
  //     testnet: 'https://kovan.etherscan.io/tx/{{txid}}',
  //   },
  //   xrp: {
  //     livenet: 'https://xrpscan.com/tx/{{txid}}',
  //     testnet: 'https://test.bithomp.com/explorer//tx/{{txid}}',
  //   },
  //   doge: {
  //     livenet: 'https://blockchair.com/dogecoin/transaction/{{txid}}',
  //     testnet: 'https://sochain.com/tx/DOGETEST/{{txid}}',
  //  },
  //   ltc: {
  //     livenet: 'https://bitpay.com/insight/#/LTC/mainnet/tx/{{txid}}',
  //     testnet: 'https://bitpay.com/insight/#/LTC/testnet/tx/{{txid}}',
  //  }
  // },
  // },
  // To use sendgrid:
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  //
  //
  // //then add:
  // mailer: sgMail,
};

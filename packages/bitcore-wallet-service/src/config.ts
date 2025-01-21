import _ from 'lodash';
import { logger } from './lib/logger';

const Config = (): any => {
  let defaultConfig = {
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
        },
        testnet3: {
          url: 'https://api.bitcore.io'
        },
        testnet4: {
          url: 'https://api.bitcore.io'
        }
      },
      bch: {
        livenet: {
          url: 'https://api.bitcore.io'
        },
        testnet3: {
          url: 'https://api.bitcore.io'
        },
        testnet4: {
          url: 'https://api.bitcore.io'
        },
        scalenet: {
          url: 'https://api.bitcore.io'
        },
        chipnet: {
          url: 'https://api.bitcore.io'
        }
      },
      xec: {
        livenet: {
          url: 'https://dev-bitcore.abcpay.cash'
        },
        testnet: {
          url: 'https://dev-bitcore.abcpay.cash'
        }
      },
      xpi: {
        livenet: {
          url: 'http://127.0.0.1:3000'
        },
        testnet: {
          url: 'http://127.0.0.1:3000'
        }
      },
      doge: {
        livenet: {
          url: 'https://api.bitcore.io'
        },
        testnet3: {
          url: 'https://api.bitcore.io'
        }
      },
      ltc: {
        livenet: {
          url: 'https://api.bitcore.io'
        },
        testnet4: {
          url: 'https://api.bitcore.io'
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
      eth: {
        livenet: {
          url: 'https://api-eth.bitcore.io'
        },
        sepolia: {
          url: 'https://api-eth.bitcore.io'
        }
      },
      matic: {
        livenet: {
          url: 'https://api-matic.bitcore.io'
        },
        amoy: {
          url: 'https://api-matic.bitcore.io'
        }
      },
      arb: {
        livenet: {
          url: 'https://api-eth.bitcore.io'
        },
        sepolia: {
          url: 'https://api-eth.bitcore.io'
        }
      },
      base: {
        livenet: {
          url: 'https://api-eth.bitcore.io'
        },
        sepolia: {
          url: 'https://api-eth.bitcore.io'
        }
      },
      op: {
        livenet: {
          url: 'https://api-eth.bitcore.io'
        },
        sepolia: {
          url: 'https://api-eth.bitcore.io'
        }
      },
      socketApiKey: 'socketApiKey'
    },
    pushNotificationsOpts: {
      templatePath: 'templates',
      defaultLanguage: 'en',
      defaultUnit: 'btc',
      subjectPrefix: '',
      pushServerUrl: 'https://fcm.googleapis.com/v1/projects/abcpay-cash-wallet/messages:send',
      authorizationKey: 'You_have_to_put_something_here',
      pushServerUrlBraze: 'https://rest.iad-05.braze.com',
      authorizationKeyBraze: 'You_have_to_put_something_here'
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
    //     sellWidgetApi: 'https://sell-sandbox.moonpay.com',
    //     secretKey: 'moonpay_sandbox_secret_key_here',
    //   },
    //   production: {
    //     apiKey: 'moonpay_production_api_key_here',
    //     api: 'https://api.moonpay.com',
    //     widgetApi: 'https://buy.moonpay.com',
    //     sellWidgetApi: 'https://sell.moonpay.com',
    //     secretKey: 'moonpay_production_secret_key_here',
    //   },
    //   sandboxWeb: {
    //     apiKey: 'moonpay_sandbox_web_api_key_here',
    //     api: 'https://api.moonpay.com',
    //     widgetApi: 'https://buy-sandbox.moonpay.com',
    //     sellWidgetApi: 'https://sell-sandbox.moonpay.com',
    //     secretKey: 'moonpay_sandbox_web_secret_key_here',
    //   },
    //   productionWeb: {
    //     apiKey: 'moonpay_production_web_api_key_here',
    //     api: 'https://api.moonpay.com',
    //     widgetApi: 'https://buy.moonpay.com',
    //     sellWidgetApi: 'https://sell.moonpay.com',
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
    //     appProviderId: 'bitpaywidget'
    //   },
    //   productionWeb: {
    //     apiKey: 'simplex_production_web_api_key_here',
    //     api: 'https://backend-wallet-api.simplexcc.com',
    //     appProviderId: 'simplex_web_provider_id_here'
    //   }
    // },
    // thorswap : {
    //   sandbox: {
    //     api: 'https://dev-api.thorswap.net',
    //     apiKey: 'thorswap_sandbox_api_key_here',
    //     secretKey: 'thorswap_sandbox_secret_key_here',
    //     referer: 'thorswap_sandbox_referer_here'
    //   },
    //   production: {
    //     api: 'https://api.thorswap.net',
    //     apiKey: 'thorswap_production_api_key_here',
    //     secretKey: 'thorswap_production_secret_key_here',
    //     referer: 'thorswap_production_referer_here'
    //   },
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
    //  // Note: Prod templates are in a the copay-emails repo (https://github.com/bitpay/copay-emails)
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

  // Override default values with bws.config.js' values, if present
  try {
    const bwsConfig = require('../bws.config');
    defaultConfig = _.merge(defaultConfig, bwsConfig);
  } catch {
    logger.info('bws.config.js not found, using default configuration values');
  }
  return defaultConfig;
};

export default Config();

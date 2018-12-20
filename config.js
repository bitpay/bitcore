var config = {
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
      uri: 'mongodb://localhost:27017/bws',
    },
  },
  lockOpts: {
    //  To use locker-server, uncomment this:
    lockerServer: {
      host: 'localhost',
      port: 3231,
    },
  },
  messageBrokerOpts: {
    //  To use message broker server, uncomment this:
    messageBrokerServer: {
      url: 'http://localhost:3380',
    },
  },
  blockchainExplorerOpts: {
    btc: {
      livenet: {
        provider: 'v8',
//        provider: 'insight',
//        url: 'https://insight.bitpay.com:443',
        url: 'https://api.bitcore.io',
      },
      testnet: {
        //provider: 'insight',
        //url: 'https://test-insight.bitpay.com:443',
        // Multiple servers (in priority order)
        // url: ['http://a.b.c', 'https://test-insight.bitpay.com:443'],
        provider: 'v8',
        url: 'https://api.bitcore.io',
      },
    },
    bch: {
      livenet: {
        //provider: 'v8',
        //url: 'https://cashexplorer.bitcoin.com',
        //url: 'https://api.bitcore.io',
        //addressFormat: 'cashaddr',  // copay, cashaddr, or legacy
        provider: 'v8',
        url: 'https://api.bitcore.io',
      },
      testnet: {
        provider: 'v8',
        url: 'http://localhost:3000',
        //url: 'https://api.bitcore.io',
      },

    },
  },
  pushNotificationsOpts: {
    templatePath: './lib/templates',
    defaultLanguage: 'en',
    defaultUnit: 'btc',
    subjectPrefix: '',
    pushServerUrl: 'https://fcm.googleapis.com/fcm',
    authorizationKey: 'You_have_to_put_something_here',
  },
  fiatRateServiceOpts: {
    defaultProvider: 'BitPay',
    fetchInterval: 60, // in minutes
  },
  // To use email notifications uncomment this:
  // emailOpts: {
  //  host: 'localhost',
  //  port: 25,
  //  ignoreTLS: true,
  //  subjectPrefix: '[Wallet Service]',
  //  from: 'wallet-service@bitcore.io',
  //  templatePath: './lib/templates',
  //  defaultLanguage: 'en',
  //  defaultUnit: 'btc',
  //  publicTxUrlTemplate: {
  //    btc: {
  //      livenet: 'https://insight.bitpay.com/tx/{{txid}}',
  //      testnet: 'https://test-insight.bitpay.com/tx/{{txid}}',
  //    },
  //    bch: {
  //      livenet: 'https://bch-insight.bitpay.com/#/tx/{{txid}}',
  //      testnet: 'https://test-bch-insight.bitpay.com/#/tx/{{txid}}',
  //    }
  //  },
  // },
  // To use sendgrid:
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  //
  //
  // //then add:
  // mailer: sgMail,
};
module.exports = config;

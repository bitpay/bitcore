import { expect } from 'chai';
import { merge } from '../../../src/utils/merge';


describe('merge', function() {
  it('should merge objects realistic to a config', function() {
    let config = {
      maxPoolSize: 50,
      port: 3000,
      chains: {},
      aliasMapping: {
        chains: {},
        networks: {}
      },
      services: {
        api: {
          rateLimiter: {
            disabled: false,
            whitelist: ['::ffff:127.0.0.1', '::1']
          },
          wallets: {
            allowCreationBeforeCompleteSync: false,
            allowUnauthenticatedCalls: false
          }
        },
        storage: {}
      }
    };
    let foundConfig = {
      chains: {
        BTC: {
          mainnet: {},
          regtest: {
            chainSource: "p2p",
            trustedPeers: [
              {
                host: "127.0.0.1",
                port: 20020
              }
            ],
            rpc: {
              host: "127.0.0.1",
              port: 20021,
              username: "username",
              password: "password"
            }
          }
        }
      }
    }

    const expectedResult = {
      maxPoolSize: 50,
      port: 3000,
      chains: {
        BTC: {
          mainnet: {},
          regtest: {
            chainSource: "p2p",
            trustedPeers: [
              {
                host: "127.0.0.1",
                port: 20020
              }
            ],
            rpc: {
              host: "127.0.0.1",
              port: 20021,
              username: "username",
              password: "password"
            }
          }
        }
      },
      aliasMapping: {
        chains: {},
        networks: {}
      },
      services: {
        api: {
          rateLimiter: {
            disabled: false,
            whitelist: ['::ffff:127.0.0.1', '::1']
          },
          wallets: {
            allowCreationBeforeCompleteSync: false,
            allowUnauthenticatedCalls: false
          }
        },
        storage: {}
      }
    };

    const result = merge(config, foundConfig);
    expect(result).to.deep.equal(expectedResult);
  });
});
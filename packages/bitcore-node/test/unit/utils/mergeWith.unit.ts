import { expect } from 'chai';
import { mergeWith } from '../../../src/utils/mergeWith';


describe('mergeWith', function() {
  it('should merge number string arrays in objects', function() {
    const customizer = (objValue, srcValue) =>
      (Array.isArray(objValue)) ? objValue.concat(srcValue) : undefined;
    
    var object1 = {
      'fruits': ['apple'],
      'vegetables': ['beet']
    };
    
    var object2 = {
      'fruits': ['banana'],
      'vegetables': ['carrot']
    };

    const result = mergeWith(object1, object2, customizer);
    const expectedResult = {'fruits': ['apple', 'banana'], 'vegetables': ['beet', 'carrot']};
    expect(result).deep.equal(expectedResult);
  });
  it('should merge nested objects', function() {
    const customizer = (objValue, srcValue) =>
      (Array.isArray(objValue)) ? objValue.concat(srcValue) : undefined;
    var object1 = {
      'fruits': {'red': ['cherry'], 'yellow': ['lemon']},
      'vegetables': ['beet']
    };
    var object2 = {
      'fruits': {'red': ['strawberry'], 'yellow': ['banana']},
      'vegetables': ['carrot']
    };

    const result = mergeWith(object1, object2, customizer);
    const expectedResult = {
      'fruits': {'red': ['cherry', 'strawberry'], 
                 'yellow': ['lemon', 'banana']}, 
      'vegetables': ['beet', 'carrot']};
    expect(result).deep.equal(expectedResult);
  });
  it('should merge nested arrays', function() {
    const customizer = (objValue, srcValue) =>
      (Array.isArray(objValue)) ? objValue.concat(srcValue) : undefined;
    var object1 = {
      'fruits': [['cherry'], ['lemon']],
      'vegetables': ['beet']
    };
    var object2 = {
      'fruits': [['strawberry'], ['banana']],
      'vegetables': ['carrot']
    };

    const result = mergeWith(object1, object2, customizer);
    const expectedResult = {
      'fruits': [['cherry'],  ['lemon'], ['strawberry'], ['banana']], 
      'vegetables': ['beet', 'carrot']
    };
    expect(result).deep.equal(expectedResult);
  });
  it('should merge nested arrays where destination property is not defined', function() {
    const customizer = (objValue, srcValue) =>
      (Array.isArray(objValue)) ? objValue.concat(srcValue) : undefined;
    var object1 = {
      'fruits': ['cherry', 'lemon'],
      'vegetables': ['beet']
    };
    var object2 = {
      'fruits': ['strawberry']
    };

    const result = mergeWith(object1, object2, customizer);
    const expectedResult = {
      'fruits': ['cherry', 'lemon', 'strawberry'], 
      'vegetables': ['beet']
    };
    expect(result).deep.equal(expectedResult);
  });
  it('should merge objects realistic to a config', function() {
  const mergeCopyArray = (objVal, srcVal) => (objVal instanceof Array ? srcVal : undefined);
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

    const result = mergeWith(config, foundConfig, mergeCopyArray);
    expect(result).to.deep.equal(expectedResult);
  });
});
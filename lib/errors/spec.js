'use strict';

function format(arg) {
  return '\'' + arg
    .replace('{0}', '\' + arguments[0] + \'')
    .replace('{1}', '\' + arguments[1] + \'')
    .replace('{2}', '\' + arguments[2] + \'') + '\'';
}

module.exports = [{
    name: 'InvalidB58Char',
    message: format('Invalid Base58 character: {0} in {1}')
  }, {
    name: 'InvalidB58Checksum',
    message: format('Invalid Base58 checksum for {0}')
  }, {
    name: 'InvalidNetwork',
    message: format('Invalid version for network: got {0}')
  }, {
    name: 'InvalidState',
    message: format('Invalid state: {0}')
  }, {
    name: 'NotImplemented',
    message: format('Function {0} was not implemented yet')
  }, {
    name: 'InvalidNetworkArgument',
    message: format('Invalid network: must be "livenet" or "testnet", got {0}')
  }, {
    name: 'InvalidArgument',
    message: format('Invalid Argument' + '\' + (arguments[0] ? \': {0}\' : \'\') + \'')
  }, {
    name: 'AbstractMethodInvoked',
    message: format('Abstract Method Invokation: {0}')
  }, {
    name: 'InvalidArgumentType',
    message: format('Invalid Argument for {2}, expected {1} but got ') + '+ typeof arguments[0]',
  }, {
    name: 'Unit',
    message: format('Internal Error on Unit {0}'),
    errors: [{
      'name': 'UnknownCode',
      'message': format('Unrecognized unit code: {0}')
    },{
      'name': 'InvalidRate',
      'message': format('Invalid exchange rate: {0}')
    }]
  }, {
    name: 'Transaction',
    message: format('Internal Error on Transaction {0}'),
    errors: [
      {
        name: 'Input',
        message: format('Internal Error on Input {0}'),
        errors: [{
          name: 'MissingScript',
          message: format('Need a script to create an input')
        }]
      }, {
        name: 'NeedMoreInfo',
        message: format('{0}')
      }, {
        name: 'UnableToVerifySignature',
        message: format('Unable to verify signature: {0}')
      }, {
        name: 'FeeError',
        message: format('Fees are not correctly set {0}'),
      }, {
        name: 'ChangeAddressMissing',
        message: format('Change address is missing')
      }
    ]
  }, {
    name: 'Script',
    message: format('Internal Error on Script {0}'),
    errors: [{
      name: 'UnrecognizedAddress',
      message: format('Expected argument {0} to be an address')
    }]
  }, {
    name: 'HDPrivateKey',
    message: format('Internal Error on HDPrivateKey {0}'),
    errors: [{
      name: 'InvalidDerivationArgument',
      message: format('Invalid derivation argument {0}, expected string, or number and boolean')
    }, {
      name: 'InvalidEntropyArgument',
      message: format('Invalid entropy: must be an hexa string or binary buffer, got {0}'),
      errors: [{
        name: 'TooMuchEntropy',
        message: format('Invalid entropy: more than 512 bits is non standard, got "{0}"')
      }, {
        name: 'NotEnoughEntropy',
        message: format('Invalid entropy: at least 128 bits needed, got "{0}"')
      }]
    }, {
      name: 'InvalidLength',
      message: format('Invalid length for xprivkey string in {0}')
    }, {
      name: 'InvalidPath',
      message: format('Invalid derivation path: {0}')
    }, {
      name: 'UnrecognizedArgument',
      message: format('Invalid argument: creating a HDPrivateKey requires a string, buffer, json or object, got "{0}"')
    }]
  }, {
    name: 'HDPublicKey',
    message: format('Internal Error on HDPublicKey {0}'),
    errors: [{
      name: 'ArgumentIsPrivateExtended',
      message: format('Argument is an extended private key: {0}')
    }, {
      name: 'InvalidDerivationArgument',
      message: format('Invalid derivation argument: got {0}')
    }, {
      name: 'InvalidLength',
      message: format('Invalid length for xpubkey: got "{0}"')
    }, {
      name: 'InvalidPath',
      message: format('Invalid derivation path, it should look like: "m/1/100", got "{0}"')
    }, {
      name: 'MustSupplyArgument',
      message: format('Must supply an argument to create a HDPublicKey')
    }, {
      name: 'UnrecognizedArgument',
      message: format('Invalid argument for creation, must be string, json, buffer, or object')
    }]
  }
];

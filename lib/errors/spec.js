module.exports = [{
  name: 'HDPrivateKey',
  message: 'Internal Error on HDPrivateKey {0}',
  errors: [
    {
      name: 'InvalidArgument',
      message: 'Invalid Argument {0}, expected {1} but got {2}',
      errors: [{
        name: 'InvalidB58Char',
        message: 'Invalid Base58 character: {0} in {1}'
      }, {
        name: 'InvalidB58Checksum',
        message: 'Invalid Base58 checksum for {0}'
      }, {
        name: 'InvalidDerivationArgument',
        message: 'Invalid derivation argument {0}, expected string, or number and boolean'
      }, {
        name: 'InvalidEntropyArgument',
        message: 'Invalid entropy: must be an hexa string or binary buffer, got {0}',
        errors: [{
          name: 'TooMuchEntropy',
          message: 'Invalid entropy: more than 512 bits is non standard, got "{0}"'
        }, {
          name: 'NotEnoughEntropy',
          message: 'Invalid entropy: at least 128 bits needed, got "{0}"'
        }]
      }, {
        name: 'InvalidLength',
        message: 'Invalid length for xprivkey string in {0}'
      }, {
        name: 'InvalidNetwork',
        message: 'Invalid version for network: got {0}'
      }, {
        name: 'InvalidNetworkArgument',
        message: 'Invalid network: must be "livenet" or "testnet", got {0}'
      }, {
        name: 'InvalidPath',
        message: 'Invalid derivation path: {0}'
      }, {
        name: 'UnrecognizedArgument',
        message: 'Invalid argument: creating a HDPrivateKey requires a string, buffer, json or object, got "{0}"'
      }]
    }
  ]
}, {
  name: 'HDPublicKey',
  message: 'Internal Error on HDPublicKey {0}',
  errors: [
    {
      name: 'InvalidArgument',
      message: 'Invalid Argument {0}, expected {1} but got {2}',
      errors: [{
        name: 'ArgumentIsPrivateExtended',
        message: 'Argument is an extended private key: {0}'
      }, {
        name: 'InvalidB58Char',
        message: 'Invalid Base58 character: {0} in {1}'
      }, {
        name: 'InvalidB58Checksum',
        message: 'Invalid Base58 checksum for {0}'
      }, {
        name: 'InvalidDerivationArgument',
        message: 'Invalid derivation argument: got {0}'
      }, {
        name: 'InvalidLength',
        message: 'Invalid length for xpubkey: got "{0}"'
      }, {
        name: 'InvalidNetwork',
        message: 'Invalid network, expected a different version: got "{0}"'
      }, {
        name: 'InvalidNetworkArgument',
        message: 'Expected network to be "livenet" or "testnet", got "{0}"'
      }, {
        name: 'InvalidPath',
        message: 'Invalid derivation path, it should look like: "m/1/100", got "{0}"'
      }, {
        name: 'MustSupplyArgument',
        message: 'Must supply an argument to create a HDPublicKey' 
      }, {
        name: 'UnrecognizedArgument',
        message: 'Invalid argument for creation, must be string, json, buffer, or object'
      }]
    }
  ]
}];

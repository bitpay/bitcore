export const InvoiceAbi = [
  {
    constant: true,
    inputs: [],
    name: 'owner',
    outputs: [
      {
        name: '',
        type: 'address'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'quoteSigner',
    outputs: [
      {
        name: '',
        type: 'address'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [
      {
        name: '',
        type: 'bytes32'
      }
    ],
    name: 'isPaid',
    outputs: [
      {
        name: '',
        type: 'bool'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        name: 'valueSigner',
        type: 'address'
      }
    ],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'constructor'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'hash',
        type: 'bytes32'
      },
      {
        indexed: true,
        name: 'tokenContract',
        type: 'address'
      },
      {
        indexed: false,
        name: 'time',
        type: 'uint256'
      },
      {
        indexed: false,
        name: 'value',
        type: 'uint256'
      }
    ],
    name: 'PaymentAccepted',
    type: 'event'
  },
  {
    constant: true,
    inputs: [
      {
        name: 'value',
        type: 'uint256'
      },
      {
        name: 'gasPrice',
        type: 'uint256'
      },
      {
        name: 'expiration',
        type: 'uint256'
      },
      {
        name: 'payload',
        type: 'bytes32'
      },
      {
        name: 'hash',
        type: 'bytes32'
      },
      {
        name: 'v',
        type: 'uint8'
      },
      {
        name: 'r',
        type: 'bytes32'
      },
      {
        name: 's',
        type: 'bytes32'
      },
      {
        name: 'tokenContract',
        type: 'address'
      }
    ],
    name: 'isValidPayment',
    outputs: [
      {
        name: 'valid',
        type: 'bool'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [
      {
        name: 'value',
        type: 'uint256'
      },
      {
        name: 'gasPrice',
        type: 'uint256'
      },
      {
        name: 'expiration',
        type: 'uint256'
      },
      {
        name: 'payload',
        type: 'bytes32'
      },
      {
        name: 'hash',
        type: 'bytes32'
      },
      {
        name: 'v',
        type: 'uint8'
      },
      {
        name: 'r',
        type: 'bytes32'
      },
      {
        name: 's',
        type: 'bytes32'
      },
      {
        name: 'tokenContract',
        type: 'address'
      }
    ],
    name: 'validatePayment',
    outputs: [
      {
        name: 'valid',
        type: 'bool'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      {
        name: 'value',
        type: 'uint256'
      },
      {
        name: 'gasPrice',
        type: 'uint256'
      },
      {
        name: 'expiration',
        type: 'uint256'
      },
      {
        name: 'payload',
        type: 'bytes32'
      },
      {
        name: 'hash',
        type: 'bytes32'
      },
      {
        name: 'v',
        type: 'uint8'
      },
      {
        name: 'r',
        type: 'bytes32'
      },
      {
        name: 's',
        type: 'bytes32'
      },
      {
        name: 'tokenContract',
        type: 'address'
      }
    ],
    name: 'pay',
    outputs: [],
    payable: true,
    stateMutability: 'payable',
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      {
        name: 'tokenContract',
        type: 'address'
      }
    ],
    name: 'withdraw',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      {
        name: 'newQuoteSigner',
        type: 'address'
      }
    ],
    name: 'setSigner',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      {
        name: 'newAdmin',
        type: 'address'
      }
    ],
    name: 'setAdmin',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

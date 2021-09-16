export const MULTISENDAbi = [
  {
    "constant": false,
    "inputs": [
      {
        "name": "recipients",
        "type": "address[]"
      },
      {
        "name": "amounts",
        "type": "uint256[]"
      }
    ],
    "name": "sendEth",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": true,
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "tokenAddress",
        "type": "address"
      },
      {
        "name": "recipients",
        "type": "address[]"
      },
      {
        "name": "amounts",
        "type": "uint256[]"
      }
    ],
    "name": "sendErc20",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

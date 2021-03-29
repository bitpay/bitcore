'use strict';

const should = require('chai').should();
const BlockHeader = require('../../lib/block/blockheader');
const BufferReader = require('../../lib/encoding/bufferreader');

// Note: auxpow headers are effective @ height >= 371337 (mainnet) and >= 158100 (testnet)

describe('AuxPow', () => {
  // https://bitpay.com/insight/#/DOGE/mainnet/block/ffe64b586546320b55081dc2394e5a7787bcb0d0eb26d621d1759496a0b1157a
  const rawHeaderPreAuxPow = '0100000038c93b6f7c2a8930ff808565cbe193e57654045847acf98eccd0357f166abadddbda747a667e974755da12d09572df51c5697c9d768291147a6039cc3bc6eb7b1a76d252f68c001c00434ca5';
  // https://bitpay.com/insight/#/DOGE/mainnet/block/0655edc2a7db012a8e2a1b742f962a7bd2d6101145cd88ce482c2b7f22f5c064
  const rawHeaderPostAuxPow = '02006200b69f57f485b4abf52bca2174a3449847c4f9626a6ac7f4eb67c6c84d7b0ff8af296f11a23d3ca5bbc9f568e8a59008fd21509544a52ae6a09a81bd9e0d0a2dcd84fb1154d44b2b1ba042d23f';
  // https://bitpay.com/insight/#/DOGE/mainnet/block/dfbd3b431d5b90079f29779e7c1a52bcf6094ea1c4dc8cd2ae6e3138d174fc85
  const rawHeaderAuxPow = '03016200d0ec962228d4558ab957f0e2438b5e7f3377fe5472e59b018def19cc5ffe358d80e6bdda13683169ee88fac56452d09c43c219c65ddc3ca9d59bb1ee3a9a78fafce0075b4055041a0000000001000000010000000000000000000000000000000000000000000000000000000000000000ffffffff640351c9152cfabe6d6d25209a94048e5f4604c4a7c3996a34b30f1136a6700b72753f4a20d76871283708000000f09f9886104d696e6564206279206c786e33333333000000000000000000000000000000000000000000000000000000000000000000000100000002ab084695000000001976a914aa3750aa18b8a0f3f0590731e1fab934856680cf88ac00000000000000002f6a24aa21a9ed76a3080482f2b7c59c19ff6130026c0d7a0115b656763010b1c9240440b70d2f08000000000000000074b7483cbe30b503b440502caf9a4f6d03b53242f8e4a4aaffa15a7a3f0100000000000006ce8485b6605e48d80259d7f6b6bf3fec46622a4cb3b79a6127aeccaf705042e83ec81387539630b05ee56f84ce2cad3d34133f73e3188c0e07075a7dd9148124ea2579d51e9aa38d062d61dbd5f64c6afce5302727ba57052c835d599d7bc66ba6058e60c05d10c3131d3f902d2bd77c19a3b75df2f762b7b66c2de9bb97ddd7d372785e9a13c94548010b51dba5056ac55b56195144ca672fcec36d948f664f4a925115d465b57d7d55b156f95f3d6c8f3cd395e4f502f2e12a85b328a8dca6000000000301000000000000000000000000000000000000000000000000000000000000004bd17ef3ab1e19336a217f754ef38b3e96b9da39c79bfce6b51e9d42ce34bbd18c14e3f0cbde1320e89f4c3989499ee755685393c4ec6ec47c34ffefa70576840000000000000020ef4d0e63d07dce1c9bfefa2519539d9b1d87a205c307cb3595a1a6fa13b43068d38f3169749766cbf9061ebc4e75ea962ba7ab9c8164538ca93de3c4bb939e3cfae0075bd07b011abb7738b2';
  // https://bitpay.com/insight/#/DOGE/mainnet/block/80f90867b16fcb6ab6bb423d20dbef7abe0ea9c60a111d886bd298263e90ba33
  const rawHeaderAuxPowWithWitness = '04016200bee0f72fc9f4a3a8953de594a88905582b6e38419dbc30d3230b5c03eda1642b3b084fdb343266a6bbbc73ab7b28e9f28ae5e694557c89fb5e1179b7d4d531368c8d3d60a2c5031a00000000020000000001010000000000000000000000000000000000000000000000000000000000000000ffffffff390434f9be00fabe6d6d80f90867b16fcb6ab6bb423d20dbef7abe0ea9c60a111d886bd298263e90ba33010000000000000000002f52f8040000ffffffff020840df610c0000001976a91476063653b199113342d5eb1f5a27bd2268cb8a7d88ac0000000000000000266a24aa21a9ed4c18a437e6d14a674dc3d9f1db07d2fca82b6b2684bfa81243c47fbf69cee77301200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011f40c6cd2cb58596a156c57d2139c549a28c17456c5055fb90e1e8a1ce1dc4c700000000000000000002000020c0436ee18f46e4dc148f687038d669ffac4dda59cffb1a8b01000000000000009d7ccdb8613918a17797d8b1a3a8ea3b9f704300aff14d590df97158bdef299e9a8d3d6055ba001baa28647d';

  it('should correctly handle a pre-AuxPow header', () => {
    const header = Buffer.from(rawHeaderPreAuxPow, 'hex');
    const bh = new BlockHeader(header);
    bh.isAuxPow().should.be.false;
    should.not.exist(bh.auxpow);
  });

  it('should correctly parse a post-AuxPow but non-AuxPow header', () => {
    const header = Buffer.from(rawHeaderPostAuxPow, 'hex');
    const bh = new BlockHeader(header);
    bh.isAuxPow().should.be.false;
    should.not.exist(bh.auxpow);
  });

  it('should correctly parse an AuxPow header', () => {
    const header = Buffer.from(rawHeaderAuxPow, 'hex');
    const bh = new BlockHeader(header);
    bh.isAuxPow().should.be.true;
    should.exist(bh.auxpow);
    bh.auxpow.coinbaseTxn.inputs.some(i => i.witnesses).should.be.false;
  });

  it('should correctly parse an AuxPow header with witnesses', () => {
    const header = Buffer.from(rawHeaderAuxPowWithWitness, 'hex');
    const bh = new BlockHeader(header);
    bh.isAuxPow().should.be.true;
    should.exist(bh.auxpow);
    bh.auxpow.coinbaseTxn.inputs.some(i => i.witnesses).should.be.true;
  });

  it('should correctly encode header with no AuxPow', () => {
    const header = Buffer.from(rawHeaderPreAuxPow, 'hex');
    const bh = new BlockHeader(header);
    const headBuf = bh.toBuffer();
    headBuf.toString('hex').should.equal(rawHeaderPreAuxPow);
  });

  it('should correctly encode header with AuxPow', () => {
    const header = Buffer.from(rawHeaderAuxPow, 'hex');
    const bh = new BlockHeader(header);
    const headBuf = bh.toBuffer();
    headBuf.toString('hex').should.equal(rawHeaderAuxPow);
  });

  it('should correctly encode header with AuxPow with witness', () => {
    const header = Buffer.from(rawHeaderAuxPowWithWitness, 'hex');
    const bh = new BlockHeader(header);
    const headBuf = bh.toBuffer();
    headBuf.toString('hex').should.equal(rawHeaderAuxPowWithWitness);
  });
});

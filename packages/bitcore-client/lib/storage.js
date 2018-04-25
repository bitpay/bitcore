const fs = require('fs');
const EventEmitter = require('events');
const levelup = require('levelup');
const leveldown = require('leveldown');

class Storage {
  constructor(params){
    const { path, createIfMissing, errorIfExists } = params;
    this.db = levelup(leveldown(path), {createIfMissing, errorIfExists});
  }
  async loadWallet(params) {
    return new Promise(async (resolve, reject) => {
      try {
        const wallet = await this.db.get('wallet');
        if (wallet) {
          resolve(JSON.parse(wallet));
        }
        resolve(null);
      } catch (err) {
        reject(err);
      }
    });
  }
  async saveWallet(params){
    const { wallet } = params;
    return this.db.put('wallet', JSON.stringify(wallet));
  }
  async getKey(params){
    const { address } = params;
    return this.db.get(`address|${address}`);
  }
  async addKey(params){
    const { key } = params;
    return this.db.put(`address|${key.address}`, key.privKey);
  }
}

module.exports = Storage;
const StorageService = require('../../lib/services/storage');
StorageService.start(() => {}, {dbName: 'bitcore-test'});

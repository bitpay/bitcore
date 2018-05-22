import path from 'path';

import glob from 'glob';
import Mocha from 'mocha';

import { StorageService } from '../../src/services/storage';

const TIMEOUT = 5000;
const TEST_DIR = path.join(__dirname, '../unit');

const storageArgs = {
    dbHost: 'localhost:27017',
    dbName: 'bitcore-unit'
};

function handleError(err){
    console.error(err);
    console.log(err.stack);
    process.exit(1);
}

function runTests(){
    return new Promise(function(resolve, reject){
        const testRunner = new Mocha();
        testRunner.timeout(TIMEOUT);
        testRunner.reporter('spec');
        
        const files = glob.sync(`${TEST_DIR}/**/**.js`);
        files.forEach(function(file){
            testRunner.addFile(file);
        });
        try{
            testRunner.run(function(failures){
                process.exit(failures);
            });
        } catch(err){
            return reject(err);
        }
    });
}

runTests()
    .then(function(failures){
        process.exit(0);
    })
    .catch(function(err){
        handleError(err);
    });
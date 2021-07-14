const fs = require('fs');
const crypto = require('crypto');
const cheerio = require('cheerio');

const buildDir = '../../www/build';
const indexPath = '../../www/index.html';

// function creates a hash based on file contents and renames the file to include the hash
function hashFile(fileName) {

  const file = fs.readFileSync(buildDir + '/' + fileName, 'utf8');
  const split = fileName.split('.');
  const name = split[0];
  let extension = split[split.length - 1];
  if(extension === 'map'){
    extension = `${split[split.length -2]}.${extension}`;
  }
  const hash = crypto.createHash('sha1').update(file, 'binary').digest('hex').substr(0, 20);

  const fileNewName = `${name}.${hash}.${extension}`;
  const fileNewRelativePath = 'build/' + fileNewName;
  //Rename file
  console.log("Renaming " + fileName + " to " + fileNewName);
  fs.renameSync(buildDir + '/' + fileName, buildDir + '/' + fileNewName);

  return fileNewRelativePath;
}

const file = fs.readFileSync(indexPath, 'utf-8');
const $ = cheerio.load(file);

// finding the bundle files in the index.html and updating their references with hashed names
$('head link[href="build/main.css"]').attr('href', hashFile('main.css'));
$('body script[src="build/main.js"]').attr('src', hashFile('main.js'));
$('body script[src="build/polyfills.js"]').attr('src', hashFile('polyfills.js'));
$('body script[src="build/vendor.js"]').attr('src', hashFile('vendor.js'));

// rewriting the index file to include updates
fs.writeFileSync(indexPath, $.html());



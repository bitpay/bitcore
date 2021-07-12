const fs = require('fs');
const crypto = require('crypto');

//let files = fs.readdirSync('../assets/img');

const hashFiles = (directory) => {
  let files = fs.readdirSync(directory);
  console.log(files);
  files.forEach((fileName) => {

    if(fs.statSync(directory + '/' + fileName).isFile()){
      const file = fs.readFileSync(directory + '/' + fileName, 'utf8');
      const split = fileName.split('.');
      const name = split[0];
      const extension = split[split.length - 1];
      const hash = crypto.createHash('sha1').update(file, 'binary').digest('hex').substr(0, 20);
      const hashedFileName = `${name}.${hash}.${extension}`;

      const oldHashedFile = fs.readdirSync(directory).find(file => file.startsWith(name));
      if (oldHashedFile) {
        fs.unlinkSync(directory + '/' + oldHashedFile);
        console.log(`${oldHashedFile} successfully deleted!`);
      }
      fs.writeFileSync(directory + '/' + hashedFileName, file);
      console.log(`${fileName} rehashed!`);
    } else if(fs.statSync(directory + '/' + fileName).isDirectory()) {
      hashFiles(directory + '/' + fileName);
    }

    // Todo: write script to inject new file where it is referenced
    // const indexHTML = fs.readFileSync('../index.html', 'utf8');
    // const findOldHash = new RegExp( '\\b' + fileName + '\\.\\w+.js\\b', 'g');
    // const result = indexHTML.replace(findOldHash, `${hashedFileName}`);
    // fs.writeFileSync('../index.html', result);
    // console.log(`${hashedFileName} successfully injected!`);

  });
};

hashFiles('../assets/img');


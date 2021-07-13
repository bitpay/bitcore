const fs = require('fs');
const crypto = require('crypto');

//let files = fs.readdirSync('../assets/img');

const hashFiles = (directory) => {
  let files = fs.readdirSync(directory);
  const filesObj = {};
  files.forEach((fileName) => {
    if(fs.statSync(directory + '/' + fileName).isFile()){
      const file = fs.readFileSync(directory + '/' + fileName, 'utf8');
      const split = fileName.split('.');
      const name = split[0];
      const extension = split[split.length - 1];
      if(!['png', 'json'].includes(extension)){
        const hash = crypto.createHash('sha1').update(file, 'binary').digest('hex').substr(0, 20);
        const hashedFileName = `${name}.${hash}.${extension}`;

        const oldHashedFile = fs.readdirSync(directory).find(file => file.startsWith(name));
        if (oldHashedFile) {
          fs.unlinkSync(directory + '/' + oldHashedFile);
          console.log(`${oldHashedFile} successfully deleted!`);
        }
        fs.writeFileSync(directory + '/' + hashedFileName, file);
        console.log(`${fileName} rehashed!`);
        filesObj[name] = hashedFileName;
      }
    } else if(fs.statSync(directory + '/' + fileName).isDirectory()) {
      hashFiles(directory + '/' + fileName);
    }
    fs.unlinkSync(directory + '/file-helper.json');
    fs.writeFileSync(directory + '/file-helper.json', JSON.stringify(filesObj));
  });
};

hashFiles('../assets/img');


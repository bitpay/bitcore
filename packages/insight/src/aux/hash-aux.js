const fs = require('fs');
const crypto = require('crypto');

// function that hashes all assets (excluding .png and .json) in a directory
const hashAssets = (directory) => {
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
      hashAssets(directory + '/' + fileName);
    }
    // creating a json file that can be used to reference updated files in components
    fs.unlinkSync(directory + '/file-helper.json');
    fs.writeFileSync(directory + '/file-helper.json', JSON.stringify(filesObj));
  });
};

// calling hash assets on the img directory
hashAssets('../assets/img');


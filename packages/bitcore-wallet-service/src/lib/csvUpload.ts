const multer = require('multer');
const path = require('path');

module.exports.uploadCsv = () => {
  const csvStorage = multer.diskStorage({
    destination(req, file, cb) {
      cb(null, `${__dirname}/../../public/csv/`);
    },
    filename(req, file, cb) {
      cb(null, file.originalname);
    }
  });

  const csvFileFilter = (req, file, cb) => {
    if (!file.originalname.match(/\.(csv)$/)) {
      return cb(new Error('You can upload only file csv!'), false);
    }
    cb(null, true);
  };

  return multer({ fileFilter: csvFileFilter, storage: csvStorage });
};

'use strict';


exports.handleErrors = function (err, res, next) {
  if (err) {
    if (err.code)  {
      res.status(400).send(err.message + '. Code:' + err.code);
    }
    else {
      res.status(503).send(err.message);
    }
    return next();
  }
  else {
    res.status(404).send('Not found');
    return next();
  }
};

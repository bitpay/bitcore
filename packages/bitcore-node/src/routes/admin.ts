import express = require('express');
import {PerformanceTracker} from '../decorators/Loggify';
const router = express.Router({ mergeParams: true });

router.get('/performance', function(_, res) {
  res.json(PerformanceTracker);
});

module.exports = {
  router: router,
  path: '/admin'
};

'use strict';

/**
 * Module dependencies.
 */
var express = require('express'),
    helpers = require('view-helpers'),
    config = require('./config');

module.exports = function(app, historicSync, peerSync) {

 //custom middleware
  function setHistoric(req, res, next) {
    req.historicSync = historicSync;
    next();
  }
  function setPeer(req, res, next) {
    req.peerSync = peerSync;
    next();
  }

  app.set('showStackError', true);

  //Set views path, template engine and default layout
  app.set('views', config.root + '/app/views');
  app.set('view engine', 'jade');

  // Compress JSON outputs
  app.set('json spaces', 0);

  //Enable jsonp
  app.enable('jsonp callback');

  app.use('/api/sync', setHistoric);
  app.use('/api/peer', setPeer);
  app.use(express.logger('dev'));
  app.use(express.json());
  app.use(express.urlencoded());
  app.use(express.methodOverride());
  app.use(express.compress());

  // IMPORTANT: for html5mode, this line must to be before app.router
  app.use(express.static(config.root + '/public'));

  //dynamic helpers
  app.use(helpers(config.appName));

  // manual helpers
  app.use(function(req, res, next) {
    app.locals.config = config;
    next();
  });

  //routes should be at the last
  app.use(app.router);

  //Assume "not found" in the error msgs is a 404. this is somewhat silly, but valid, you can do whatever you like, set properties, use instanceof etc.
  app.use(function(err, req, res, next) {
    //Treat as 404
    if (~err.message.indexOf('not found')) return next();

    //Log it
    console.error(err.stack);

    //Error page
    res.status(500).render('500', {
      error: err.stack
    });
  });

  //Assume 404 since no middleware responded
  app.use(function(req, res) {
    res.status(404).render('404', {
      url: req.originalUrl,
      error: 'Not found'
    });
  });
};

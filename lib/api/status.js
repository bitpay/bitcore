module.exports = function statusAPI(app) {
  app.get('/status', (req, res) => {
    res.send('status');
  });

  app.get('/sync', (req, res) => {
    res.send('sync');
  });

  app.get('/peer', (req, res) => {
    res.send('peer');
  });

  app.get('/version', (req, res) => {
    res.send('version');
  });
};

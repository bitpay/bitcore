module.exports = function statusAPI(router) {
  router.get('/status', (req, res) => {
    res.send('status');
  });

  router.get('/sync', (req, res) => {
    res.send('sync');
  });

  router.get('/peer', (req, res) => {
    res.send('peer');
  });

  router.get('/version', (req, res) => {
    res.send('version');
  });
};

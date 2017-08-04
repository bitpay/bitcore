module.exports = function currencyAPI(app) {
  app.get('/currency', (req, res) => {
    res.send('currency');
  });
};

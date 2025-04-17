export function authRequest(req, res, next) {
  // TODO - check header sig, etc
  return next();
};
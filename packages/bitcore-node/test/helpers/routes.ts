/** Minimal express stand-ins for unit testing route handlers and middleware. */

export function makeRes() {
  const res: any = {
    statusCode: null,
    body: null,
    headers: {},
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: any) {
      res.body = payload;
      return res;
    },
    setHeader(name: string, value: string) {
      res.headers[name] = value;
    }
  };
  return res;
}

export function makeReqRes(over: any = {}) {
  const req: any = {
    method: over.method || 'GET',
    originalUrl: over.originalUrl || '/api/wallet-stats',
    body: over.body !== undefined ? over.body : {},
    headers: over.headers || {}
  };
  return { req, res: makeRes() };
}

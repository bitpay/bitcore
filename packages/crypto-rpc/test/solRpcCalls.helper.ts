// Records every request SolRpc/SplRpc sends through `this.rpc`, and optionally answers some of them.
// The kit RPC client is a Proxy with no own properties, so sinon can't stub it (see getAccountInfo.helper.js).
// This swaps in a Proxy that wraps every method instead, so a test can count round trips and fake responses
// the local validator can't produce on demand (a tx that has aged out of the status cache, a failed lookup).
//
// `respond({ method, args, send })` is called for each request; return `send()` to pass it to the validator,
// or anything else to answer it. Without `respond`, every request goes to the validator.
export function recordRpcCalls(rpcClient, { respond } = {}) {
  const realRpc = rpcClient.rpc;
  const calls = [];
  rpcClient.rpc = new Proxy(realRpc, {
    get(target, method) {
      if (typeof method !== 'string' || method === 'then') {
        return Reflect.get(target, method, target);
      }
      return (...args) => ({
        send: async (...sendArgs) => {
          calls.push({ method, args });
          const send = () => target[method](...args).send(...sendArgs);
          return respond ? respond({ method, args, send }) : send();
        }
      });
    }
  });
  return {
    calls,
    methods: () => calls.map(({ method }) => method),
    restore: () => { rpcClient.rpc = realRpc; }
  };
}

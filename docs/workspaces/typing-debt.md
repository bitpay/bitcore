# Follow-up: request-mock and Sinon typing

Status: separate follow-up. This records the remaining test-mock typing debt
from the workspace migration. It does not waive public declaration or consumer
checks in the [acceptance contract](acceptance-spec.md).

## Current state

The historical migration note described package-wide `sinon`-as-`any` shims.
Those shims were removed in commit `9af824827` (`add @types/sinon at package
levels & remove shims`). They are absent from the current source, and the
wallet-service, wallet-client, and CLI tsconfigs no longer map `sinon` to a
shim. Each package now declares its own `@types/sinon: ^22.0.0`:

| Package | Declared Sinon runtime range | Type declaration |
| --- | --- | --- |
| wallet-service | `^7.1.1` | `@types/sinon: ^22.0.0` |
| wallet-client | `^7.1.1` | `@types/sinon: ^22.0.0` |
| CLI | `^21.0.0` | `@types/sinon: ^22.0.0` |

Node's separate legacy Sinon 4/type 4 declarations are not the only typing
source available to these packages. Do not treat removal of the old shims as
outstanding work or reintroduce them as a compilation shortcut.

## Remaining debt

Wallet-client still gives its request clients explicit `any` types so tests can
substitute lightweight fakes:

- [`PayPro.r`](../../packages/bitcore-wallet-client/src/lib/paypro.ts).
- [`PayProV2.request`](../../packages/bitcore-wallet-client/src/lib/payproV2.ts).

The production implementations use Superagent, while test helpers provide a
smaller method set; see
[`test/helpers.ts`](../../packages/bitcore-wallet-client/test/helpers.ts).
Replacing these `any` fields requires an interface that covers the methods
actually used by both production requests and the fakes. A narrow request
interface may be more appropriate than requiring every fake to implement the
entire Superagent API.

Some tests also retain local assertions around mock-specific behavior, such as
`(BwsTssKeyGen.getMessagesForParty as any).wrappedMethod` in
[`test/tss.test.ts`](../../packages/bitcore-wallet-client/test/tss.test.ts).
The wallet-service wallet-read fixture uses an explicit `w: any` callback
parameter. These are bounded call-site follow-ups, not evidence that entire
packages are still untyped. Review each case against the runtime API and the
package's declared types before replacing an assertion.

## Completion criteria

Replace request-client `any` fields with an interface supported by their real
call sites and test doubles. Modernize legacy Sinon mock access where needed,
and confirm that the chosen types describe the runtime methods in use. Work
can proceed per package without coupling it to a broad dependency refresh.

Validate each change with the affected package's real compile and relevant
existing tests, preserving runtime behavior and coverage requirements. Changes
to exported declarations also need external consumer type checking with
`skipLibCheck: false`. Public API compatibility and query-input behavior remain
separate review questions; a typing cleanup does not settle them.

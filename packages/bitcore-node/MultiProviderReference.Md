**Created:** January 2, 2026
**Purpose:** Technical reference for multi-provider infrastructure implementation

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [File Structure](#file-structure)
3. [API Adapter Interface](#api-adapter-interface)
4. [Provider Adapters](#provider-adapters)
5. [Multi-Provider Module](#multi-provider-module)
6. [Circuit Breaker](#circuit-breaker)
7. [Stream Improvements](#stream-improvements)
8. [Metrics](#metrics)
9. [Configuration](#configuration)

---

## Architecture Overview

### Context: Moving to Provider-Based Infrastructure

**The Challenge:** Currently managing 118.4 TB of blockchain data across local nodes with significant storage costs (~$100K/year). Moving to external providers for all EVM chains (ETH, Polygon, BASE, ARB, OP) eliminates storage while maintaining service reliability.

**Key Decision:** Use multiple providers with automatic failover instead of depending on a single provider. This prevents vendor lock-in and ensures high availability.

### RPC vs Indexed APIs: Two Different Patterns

| Layer | What It Does | Current State | Action Needed |
|-------|-------------|---------------|---------------|
| **RPC Providers** | Direct blockchain access (getBalance, sendTx, estimateGas) | ✅ Already multi-provider via `getWeb3()` | None - working pattern |
| **Indexed APIs** | Complex queries requiring indexing (address history, token transfers) | ❌ Single provider only | **Implement multi-provider** |

**This migration focuses on Indexed APIs** - implementing the same multi-provider pattern that RPC already uses.

### The Multi-Provider Pattern

```
┌───────────────────────────────────────────────────────────┐
│         BITCORE-NODE (Multi-Provider)                     │
├───────────────────────────────────────────────────────────┤
│  MultiProviderStateProvider                               │
│    │                                                       │
│    ├─ 1. Try Primary (Moralis) ──────────┐                │
│    │                                      │                │
│    ├─ 2. On error → Secondary (Chainstack)                │
│    │                                      │                │
│    ├─ 3. On error → Tertiary (Tatum)     ├──→ Provider    │
│    │                                      │    Router with │
│    └─ 4. All failed → Error Response     │    Health      │
│                                           │    Tracking    │
│  Health Tracking:                         │                │
│    - Moralis: HEALTHY ✅                  │                │
│    - Chainstack: HEALTHY ✅               │                │
│    - Tatum: DEGRADED ⚠️ BYPASSED          │                │
│                                           │                │
└───────────────────────────────────────────────────────────┘
                    │
                    ↓
   Bitpay | Bitpay App | External Consumers
```

### Sequential vs Parallel Strategy

**Why Sequential Failover:**
- **Cost Efficient:** Only pay for successful queries (most succeed on first try)
- **Simpler Logic:** One provider at a time, clear error handling
- **Fast Path:** Primary provider handles 95%+ of requests, no parallel overhead
- **Still Reliable:** Circuit breaker ensures failing providers are bypassed quickly

### Multi-Provider Benefits

| Aspect | Single Provider | Multi-Provider |
|--------|----------------|----------------|
| **Uptime** | Provider uptime (99.9%) | Combined uptime (99.999%) |
| **Vendor Lock-in** | High risk | Low risk - can switch anytime |
| **Rate Limiting** | Service degradation | Automatic spillover to secondary |
| **Cost Control** | One vendor sets price | Competition & negotiation leverage |
| **Recovery** | Manual intervention | Automatic failover |

### Example Provider Selection

| Provider | Chains | Role | Notes |
|----------|--------|------|-------|
| **Moralis** | ETH, Polygon, BASE, ARB, OP | Primary | Proven in production, familiar API |
| **Chainstack** | ETH, Polygon, BASE, ARB, OP, more | Secondary | Global infrastructure, cost-effective |
| **Tatum** | 100+ chains | Tertiary | Broad chain support, many integrations |

### Rollout Strategy

**Phased approach to minimize risk:**

1. **Phase 1:** BASE testnet → BASE mainnet (lowest volume, validate architecture)
2. **Phase 2:** ETH testnet (Sepolia/Holesky) → validate at scale
3. **Phase 3:** Polygon, ARB, OP mainnet (already using Moralis, add secondary providers)
4. **Phase 4:** ETH mainnet (highest volume, most critical)

---

## File Structure

### IIndexedAPIAdapter Interface and Adapters

```
bitcore/packages/bitcore-node/
└── src/
    └── providers/
        └── chain-state/
            ├── external/
            │   ├── adapters/
            │   │   ├── IIndexedAPIAdapter.ts       # Base interface
            │   │   ├── factory.ts                  # Adapter factory
            │   │   ├── moralis.ts                  # Moralis adapter
            │   │   ├── chainstack.ts               # Chainstack adapter
            │   │   └── tatum.ts                    # Tatum adapter
            │   │
            │   ├── streams/
            │   │   ├── apiStream.ts                # Enhanced API streaming
            │   │   └── streamTransform.ts          # Transform utilities
            │   │
            │   ├── circuitBreaker.ts               # Circuit breaker implementation
            │   └── metrics.ts                      # Provider metrics collection
            │
            └── evm/
                └── api/
                    ├── csp.ts                      # Base EVM state provider
                    └── multiProviderCSP.ts         # Multi-provider implementation
```

### Multi-Provider CSP Module Structure

```
bitcore/packages/bitcore-node/
└── src/
    ├── modules/
    │   └── multiProvider/
    │       ├── index.ts                           # Module entry point
    │       ├── api/
    │       │   └── csp.ts                         # MultiProviderEVMStateProvider
    │       └── types/
    │           └── namespaces/
    │               └── ChainStateProvider.ts      # Type definitions
    │
    └── types/
        └── Config.ts                              # Config interface with multi-provider support
```

---

## API Adapter Interface

### Why Adapters?

Each provider returns blockchain data in different formats (different field names, hex vs decimal, pagination styles). Without adapters, provider-specific logic spreads throughout the codebase creating tight coupling and making it difficult to add/remove providers. Adapters provide:

- **Single Responsibility:** Each adapter handles one provider's API quirks
- **Uniform Interface:** All adapters return the same internal format, so business logic never changes when switching providers
- **Testability:** Mock adapters for testing without calling real APIs

### Core Interface Definition

```typescript
// src/providers/chain-state/external/adapters/IIndexedAPIAdapter.ts

export interface IIndexedAPIAdapter {
  // Provider metadata
  name: string;
  supportedChains: string[];

  // Core query methods - all return internal format
  getTransaction(params: GetTransactionParams): Promise<IEVMTransactionInProcess>;

  streamAddressTransactions(params: StreamAddressParams): Promise<Readable>;

  getBlockByDate(params: GetBlockParams): Promise<number>;

  getTokenTransfers(params: TokenTransferParams): Promise<Readable>;

  // Health and status
  healthCheck(): Promise<boolean>;

  getRateLimitStatus(): Promise<RateLimitInfo>;
}

export interface GetTransactionParams {
  chain: string;
  network: string;
  chainId: number;
  txId: string;
}

export interface StreamAddressParams {
  chain: string;
  network: string;
  chainId: number;
  address: string;
  args: StreamWalletTransactionsArgs;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
}

// Internal transaction format (consistent across all providers)
export interface IEVMTransactionInProcess {
  txid: string;
  chain: string;
  network: string;
  blockHeight: number;
  blockHash: string;
  blockTime: Date;
  blockTimeNormalized: Date;
  from: string;
  to: string;
  value: number;
  gasLimit: number;
  gasPrice: number;
  nonce: number;
  data: string;
  // ... additional fields
}
```

---

## Provider Adapters

### Moralis Adapter

```typescript
// src/providers/chain-state/external/adapters/moralis.ts

export class MoralisAdapter implements IIndexedAPIAdapter {
  name = 'Moralis';
  supportedChains = ['ETH', 'MATIC', 'BASE', 'ARB', 'OP'];

  private apiKey: string;
  private baseURL = 'https://deep-index.moralis.io/api/v2.2';

  constructor(config: { apiKey: string }) { ... }

  async getTransaction(params: GetTransactionParams): Promise<IEVMTransactionInProcess> {
    // 1. Call Moralis API
    // 2. Transform to internal format
    // 3. Return standardized transaction
  }

  async streamAddressTransactions(params: StreamAddressParams): Promise<Readable> {
    // Build Moralis-specific URL and query params
    // Return ExternalApiStream with transform
  }

  async getBlockByDate(params: GetBlockParams): Promise<number> {
    // Query Moralis for block by date
  }

  async healthCheck(): Promise<boolean> {
    // Ping Moralis health endpoint
  }

  async getRateLimitStatus(): Promise<RateLimitInfo> {
    // Parse rate limit headers from last response
  }

  // Private transformation methods
  private _transformTransaction(moralisTx: any, params: any): IEVMTransactionInProcess {
    // Moralis format → Internal format
  }

  private _chainIdToMoralisChain(chainId: number): string {
    // Convert chainId to Moralis chain identifier
  }
}
```

### Chainstack Adapter

```typescript
// src/providers/chain-state/external/adapters/chainstack.ts

export class ChainstackAdapter implements IIndexedAPIAdapter {
  name = 'Chainstack';
  supportedChains = ['ETH', 'MATIC', 'BASE', 'ARB', 'OP', 'BSC'];

  private apiKey: string;
  private baseURL: string;

  constructor(config: { apiKey: string; network: string }) {
    // Chainstack uses per-network endpoints
    this.baseURL = `https://${config.network}.chainstacklabs.com/v1/${config.apiKey}`;
  }

  async getTransaction(params: GetTransactionParams): Promise<IEVMTransactionInProcess> {
    // Chainstack uses JSON-RPC format
    // Call eth_getTransactionByHash
    // Transform response to internal format
  }

  async streamAddressTransactions(params: StreamAddressParams): Promise<Readable> {
    // Use Chainstack's transaction history API
    // Handle pagination
  }

  async getBlockByDate(params: GetBlockParams): Promise<number> {
    // Binary search or Chainstack's block-by-timestamp API
  }

  async healthCheck(): Promise<boolean> {
    // eth_blockNumber call with timeout
  }

  async getRateLimitStatus(): Promise<RateLimitInfo> {
    // Parse from response headers
  }

  private _transformTransaction(chainstackTx: any, params: any): IEVMTransactionInProcess {
    // Chainstack format → Internal format
    // Handle hex to decimal conversions
  }
}
```


### Adapter Factory

```typescript
// src/providers/chain-state/external/adapters/factory.ts

export class AdapterFactory {
  static createAdapter(
    providerName: string,
    config: any
  ): IIndexedAPIAdapter {
    switch (providerName.toLowerCase()) {
      case 'moralis':
        return new MoralisAdapter(config);

      case 'chainstack':
        return new ChainstackAdapter(config);

      case 'tatum':
        return new TatumAdapter(config);

      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
  }

  static getSupportedProviders(): string[] {
    return ['moralis', 'chainstack', 'tatum'];
  }
}
```

---

## Multi-Provider Module

### Why Multi-Provider?

Depending on a single external provider creates a single point of failure - if that provider has an outage, rate limits, or pricing changes, our entire service is impacted. A multi-provider architecture ensures:

- **High Availability:** Automatic failover if primary provider fails
- **Vendor Independence:** Not locked into one provider's pricing or terms
- **Load Distribution:** Can route different query types to optimal providers
- **Redundancy:** Multiple sources increase overall system reliability

### MultiProviderEVMStateProvider

```typescript
// src/modules/multiProvider/api/csp.ts

export class MultiProviderEVMStateProvider extends BaseEVMStateProvider {
  private providers: ProviderWithHealth[] = [];

  constructor(chain: string = 'ETH') {
    super(chain);
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Load provider configs from Config
    // Create adapters with AdapterFactory
    // Initialize circuit breakers
    // Sort by priority
  }

  // Override: Sequential failover for single transactions
  async _getTransaction(params: StreamTransactionParams) {
    for (const provider of this.providers) {
      if (!provider.circuitBreaker.canAttempt()) {
        continue; // Skip unhealthy providers
      }

      try {
        const tx = await provider.adapter.getTransaction(params);
        provider.circuitBreaker.recordSuccess();
        return { found: tx };
      } catch (error) {
        provider.circuitBreaker.recordFailure(error);
        continue; // Try next provider
      }
    }

    return { found: null }; // All providers failed
  }

  // Override: Stream from first available provider
  async _buildAddressTransactionsStream(params) {
    for (const provider of this.providers) {
      if (!provider.circuitBreaker.canAttempt()) {
        continue;
      }

      try {
        const stream = await provider.adapter.streamAddressTransactions(params);

        // Track success/failure
        stream.on('error', (err) => provider.circuitBreaker.recordFailure(err));
        stream.on('end', () => provider.circuitBreaker.recordSuccess());

        return stream;
      } catch (error) {
        provider.circuitBreaker.recordFailure(error);
        continue;
      }
    }

    throw new Error('All providers failed');
  }

  // Health check endpoint
  async checkProviderHealth(): Promise<Record<string, ProviderHealth>> {
    // Return health status of all providers
  }
}

interface ProviderWithHealth {
  adapter: IIndexedAPIAdapter;
  circuitBreaker: CircuitBreaker;
  priority: number;
}
```

---

## Circuit Breaker

### Why Circuit Breaker?

Without circuit breakers, the system continues trying failing providers on every request, wasting time and degrading performance. Circuit breakers automatically detect and bypass unhealthy providers, then periodically test for recovery:

- **Fail Fast:** Skip known-bad providers immediately instead of waiting for timeout
- **Auto-Recovery:** Automatically retry bypassed providers after cooldown period
- **Prevents Cascading Failures:** Stop hammering a struggling provider, giving it time to recover
- **Better UX:** Faster response times by avoiding slow/failing providers

### Implementation

```typescript
// src/providers/chain-state/external/circuitBreaker.ts

export enum CircuitState {
  HEALTHY = 'HEALTHY',        // Normal operation - accepting requests
  DEGRADED = 'DEGRADED',      // Testing recovery - limited requests
  FAILING = 'FAILING'         // Provider down - rejecting requests
}

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Transition to FAILING after N failures
  failureRateThreshold: number;  // Or when failure rate > X%
  successThreshold: number;      // Return to HEALTHY after N successes in DEGRADED
  timeout: number;               // Wait time before entering DEGRADED (ms)
  monitoringWindow: number;      // Rolling window for metrics (ms)
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.HEALTHY;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private recentAttempts: Array<{ success: boolean; timestamp: number }> = [];

  constructor(
    private providerName: string,
    private config: CircuitBreakerConfig
  ) {}

  canAttempt(): boolean {
    // HEALTHY: Allow all requests
    // FAILING: Check if timeout expired → DEGRADED
    // DEGRADED: Allow test request
  }

  recordSuccess(): void {
    // Track success
    // DEGRADED → HEALTHY after threshold successes
    // HEALTHY: Reset failure count
  }

  recordFailure(error: Error): void {
    // Track failure
    // HEALTHY → FAILING if threshold exceeded
    // DEGRADED → FAILING on any failure
  }

  getState(): CircuitState { ... }

  getMetrics(): CircuitMetrics {
    // Return current state, failure rate, attempt count
  }

  private getFailureRate(): number {
    // Calculate failure rate in monitoring window
  }

  private cleanOldAttempts(): void {
    // Remove attempts outside monitoring window
  }
}

export interface CircuitMetrics {
  state: CircuitState;
  failureRate: number;
  recentAttempts: number;
  failures: number;
  successes: number;
  lastFailureTime?: Date;
}
```

### State Transitions

```
┌──────────────┐
│   HEALTHY    │  Normal operation
│ (All traffic)│  All requests go through
└──────┬───────┘
       │ Failure rate > threshold (e.g., 50%)
       ↓
┌──────────────┐
│   FAILING    │  Provider bypassed
│(No traffic)  │  No requests sent
└──────┬───────┘
       │ After timeout period (e.g., 60 seconds)
       ↓
┌──────────────┐
│  DEGRADED    │  Testing recovery
│(Test traffic)│  Limited requests to check health
└──────┬───────┘
       │
       ├─→ Success → HEALTHY (Recovered)
       └─→ Failure → FAILING (Still down)
```

---

## Stream Improvements

### Why Stream-Based Architecture?

Large result sets (like address transaction history) can't be loaded entirely into memory. Streams process data in chunks, providing memory efficiency and better performance. Moving to pure stream returns (instead of passing req/res objects) also decouples business logic from HTTP layer:

- **Memory Efficiency:** Handle millions of transactions without loading all into RAM
- **Backpressure Handling:** Automatically pause data fetching when consumer is slow
- **Layer Decoupling:** CSP doesn't know about HTTP, making it testable and reusable
- **Progressive Delivery:** Start sending results to client immediately, don't wait for all data

### Architectural Change: Stream-Based Data Flow

**Old Pattern (Coupled):**
```typescript
// BAD: Passing req/res through entire call chain
async getAddressTransactions(req: Request, res: Response) {
  await CSP.streamAddressTransactions(params, req, res);
}

// Deep in CSP, tightly coupled to Express
_buildStream(params, req, res) {
  const stream = createStream();
  stream.pipe(res); // Response handling deep in business logic
}
```

**New Pattern (Decoupled):**
```typescript
// GOOD: CSP returns stream, route handler manages response
async getAddressTransactions(req: Request, res: Response) {
  const stream = await CSP.streamAddressTransactions(params);
  stream.pipe(res); // Response handling stays at API layer
}

// CSP is response-agnostic
async streamAddressTransactions(params) {
  return createStream(); // Just return the stream
}
```

**Benefits:**
- **Decoupling:** Business logic doesn't know about HTTP
- **Testability:** Can test streams without mocking Express
- **Flexibility:** Same stream can be used for HTTP, WebSocket, gRPC, etc.
- **Memory Efficiency:** Streams handle backpressure automatically



### Stream Transform Utilities

```typescript
// src/providers/chain-state/external/streams/streamTransform.ts

export class StreamTransform {
  static createPaginationHandler(
    adapter: IIndexedAPIAdapter,
    params: StreamAddressParams
  ) {
    // Handle provider-specific pagination
    // Return unified stream interface
  }

  static createRateLimitHandler(
    stream: Readable,
    rateLimit: RateLimitInfo
  ) {
    // Throttle stream based on rate limits
    // Pause when approaching limit
  }

  static createErrorRetryHandler(
    stream: Readable,
    maxRetries: number
  ) {
    // Retry failed chunks
    // Exponential backoff
  }
}
```

---

## Metrics

### Why Metrics?

With multiple providers, you need visibility into which providers are performing well, which are failing, and where costs are accumulating. Metrics enable:

- **Performance Monitoring:** Track latency and success rates per provider
- **Cost Control:** Monitor API call volume to predict and control costs
- **Proactive Alerting:** Detect issues before they impact users
- **Data-Driven Decisions:** Choose optimal providers based on real performance data

### Provider Metrics Collection

```typescript
// src/providers/chain-state/external/metrics.ts

export class ProviderMetrics {
  // Track request latency
  static recordLatency(
    provider: string,
    chain: string,
    method: string,
    duration: number
  ): void {
    metrics.histogram('provider.latency_ms', duration, {
      provider,
      chain,
      method
    });
  }

  // Track circuit breaker state changes
  static recordCircuitStateChange(
    provider: string,
    fromState: CircuitState,
    toState: CircuitState
  ): void {
    metrics.increment('circuit_breaker.state_change', {
      provider,
      from_state: fromState,
      to_state: toState
    });
  }

  // Track failover events
  static recordFailover(
    fromProvider: string,
    toProvider: string,
    reason: string
  ): void {
    metrics.increment('provider.failover', {
      from_provider: fromProvider,
      to_provider: toProvider,
      reason
    });
  }

  // Track API calls (for cost monitoring)
  static recordAPICall(
    provider: string,
    chain: string,
    method: string,
    cached: boolean
  ): void {
    metrics.increment('provider.api_calls', {
      provider,
      chain,
      method,
      cached: cached ? 'true' : 'false'
    });
  }

  // Track errors by type
  static recordError(
    provider: string,
    errorType: string,
    chain: string
  ): void {
    metrics.increment('provider.errors', {
      provider,
      error_type: errorType,
      chain
    });
  }

  // Track success rate
  static recordSuccess(provider: string, chain: string): void {
    metrics.increment('provider.success', { provider, chain });
  }

  static recordFailure(provider: string, chain: string): void {
    metrics.increment('provider.failure', { provider, chain });
  }
}
```

### Metrics Integration in MultiProviderCSP

```typescript
async _getTransaction(params: StreamTransactionParams) {
  const startTime = Date.now();

  for (const provider of this.providers) {
    if (!provider.circuitBreaker.canAttempt()) {
      continue;
    }

    try {
      const tx = await provider.adapter.getTransaction(params);

      // Record metrics
      ProviderMetrics.recordLatency(
        provider.adapter.name,
        params.chain,
        'getTransaction',
        Date.now() - startTime
      );
      ProviderMetrics.recordSuccess(provider.adapter.name, params.chain);
      ProviderMetrics.recordAPICall(
        provider.adapter.name,
        params.chain,
        'getTransaction',
        false
      );

      provider.circuitBreaker.recordSuccess();
      return { found: tx };

    } catch (error) {
      ProviderMetrics.recordError(
        provider.adapter.name,
        error.constructor.name,
        params.chain
      );
      ProviderMetrics.recordFailure(provider.adapter.name, params.chain);

      provider.circuitBreaker.recordFailure(error);
      continue;
    }
  }

  return { found: null };
}
```

---

## Configuration

### Config Interface

```typescript
// src/types/Config.ts

export interface IEVMNetworkConfig {
  // Existing fields...
  chainSource?: 'p2p' | 'external';
  module?: string;

  // Multi-provider configuration
  externalProviders?: IProviderConfig[];
  enableLocalFallback?: boolean;

  // RPC providers (existing, unchanged)
  provider?: IRpcProvider;
  providers?: IRpcProvider[];
}

export interface IProviderConfig {
  name: string;                              // 'moralis' | 'chainstack' | 'tatum'
  priority: number;                          // Lower = higher priority
  config: {
    apiKey: string;
    network?: string;                        // Provider-specific network ID
    [key: string]: any;                      // Additional provider config
  };
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
}
```

### Example Configuration

```json
// bitcore.config.json

{
  "ETH": {
    "mainnet": {
      "chainSource": "external",
      "module": "./multiProvider",

      "externalProviders": [
        {
          "name": "moralis",
          "priority": 1,
          "config": {
            "apiKey": "${MORALIS_API_KEY}"
          },
          "circuitBreakerConfig": {
            "failureThreshold": 5,
            "timeout": 60000
          }
        },
        {
          "name": "chainstack",
          "priority": 2,
          "config": {
            "apiKey": "${CHAINSTACK_API_KEY}",
            "network": "ethereum-mainnet"
          }
        },
        {
          "name": "tatum",
          "priority": 3,
          "config": {
            "apiKey": "${TATUM_API_KEY}"
          }
        }
      ],

      "enableLocalFallback": false,

      "provider": {
        "host": "eth-mainnet.chainstacklabs.com",
        "protocol": "https",
        "port": 443
      }
    }
  },

  "BASE": {
    "mainnet": {
      "chainSource": "external",
      "module": "./multiProvider",

      "externalProviders": [
        {
          "name": "moralis",
          "priority": 1,
          "config": {
            "apiKey": "${MORALIS_API_KEY}"
          }
        },
        {
          "name": "chainstack",
          "priority": 2,
          "config": {
            "apiKey": "${CHAINSTACK_API_KEY}",
            "network": "base-mainnet"
          }
        }
      ]
    }
  }
}
```

---

## Implementation Checklist

### Core Components
- [ ] `IIndexedAPIAdapter` interface
- [ ] `AdapterFactory`
- [ ] `MoralisAdapter` implementation
- [ ] `ChainstackAdapter` implementation
- [ ] `TatumAdapter` implementation
- [ ] `CircuitBreaker` with improved state names
- [ ] `MultiProviderEVMStateProvider`
- [ ] `ExternalApiStream` enhancements
- [ ] `ProviderMetrics` collection
- [ ] Config interface updates

### Testing
- [ ] Unit tests for each adapter
- [ ] Circuit breaker state transition tests
- [ ] Multi-provider failover tests
- [ ] Stream pagination tests
- [ ] Integration tests on testnet

### Monitoring
- [ ] Provider health endpoint
- [ ] Metrics dashboard
- [ ] Alerting for provider failures
- [ ] Cost tracking dashboard

---

## Future Considerations

### After Testing & Validation

Once multi-provider architecture is validated on BASE and ETH testnets, consider:

1. **Local Node Retention Policy** (if keeping local nodes as fallback)
   - Implement time-based pruning (keep recent 30-90 days)
   - Retain wallet-specific data indefinitely
   - Scheduled pruning jobs

2. **Additional Providers**
   - QuickNode (already using for RPC)
   - Thirdweb (1000+ chain support)

3. **Advanced Features**
   - Cross-provider data validation
   - Intelligent routing based on query type
   - Provider cost optimization
   - Caching layer for expensive queries

---
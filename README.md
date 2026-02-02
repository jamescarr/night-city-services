<p align="center">
  <img src="dolphin-hacker.png" alt="Night City Chrome & Data Services" width="300">
</p>

# Night City Chrome & Data Services

> *"He was more than a dolphin, but from another dolphin's point of view he might have seemed like something less."* — William Gibson, "Johnny Mnemonic"

A cyberpunk-themed exploration of **[Temporal](https://temporal.io/)** for building durable, reliable workflows. This project demonstrates the Saga pattern with compensating transactions, along with Temporal's built-in reliability features like automatic retries, durable execution, and workflow visibility.

## The Domain

Welcome to Night City. Megacorporations rule, data is the ultimate currency, and getting chromed up at a ripperdoc is just another Tuesday. We use this setting to explore how Temporal handles complex, multi-step workflows that interact with multiple external systems—and what happens when things go wrong.

### 1. 🦾 Cyberware Installation Saga

**The Saga Pattern with Compensating Transactions**

Installing cyberware requires coordinating four independent systems, each with its own persistent state:

| System | Purpose | Compensation |
|--------|---------|--------------|
| **Fixer Inventory** | Reserve cyberware from the black market | Release reservation, pay restocking fee |
| **Ripperdoc Scheduling** | Book surgery appointment | Cancel appointment, forfeit deposit |
| **Credstick Ledger** | Process payment on Night City blockchain (Chain ID: 2077) | Issue refund on-chain (minus processing fee) |
| **Neural Registry** | Track cyberware integration | Emergency stabilization |

**The Problem:** If neural integration fails mid-surgery (and with experimental chrome, it often does), we need to:
1. Stabilize the runner (emergency medical!)
2. Refund the payment
3. Cancel the appointment
4. Release the cyberware reservation

Each compensation runs in **reverse order (LIFO)** to maintain consistency across all systems.

```
SUCCESS PATH:
Reserve → Schedule → Pay → Integrate → Confirm ✓

FAILURE PATH (Integration fails):
Reserve → Schedule → Pay → Integrate ✗
                                ↓
        Emergency Stabilization
                                ↓
        ← Refund ← Cancel ← Release
```

### 2. 📡 Data Broker Scatter-Gather

**Parallel Requests with Aggregation**

When you need to move data through the underground networks, you don't call one broker—you query them all and pick the best deal. This demonstrates Temporal's ability to run activities in parallel and aggregate results.

| Broker | Specialty | Reliability |
|--------|-----------|-------------|
| **Afterlife Connections** | Premium service, high success rate | 95% |
| **NetWatch Black Market** | Fast but risky (rogue agents) | 70% |
| **Arasaka External Services** | Corporate precision, slow | 90% |
| **Voodoo Boys Data Haven** | AI constructs, military encryption | 85% |
| **Militech Acquisitions** | Aggressive, military specialist | 82% |

**SCATTER:** Query all 5 brokers simultaneously  
**GATHER:** Analyze responses, find best by price/speed/reliability

### 3. 🎯 Heist Process Manager

**Long-Running Workflows with Signals and Queries**

Coordinating a shadowrun requires more than just a plan—it needs a state machine that can respond to real-time intel. This demonstrates Temporal's signals (external events that affect running workflows) and queries (inspect state without affecting execution).

**Phases:**
```
planning → team_assembly → gear_acquisition → infiltration → execution → extraction → completed
                                                                                      ↓
                            [abort signal] ─────────────────────────────────────→ aborted
```

**Signals:**
- `abortHeist(reason)` - Emergency abort at any phase
- `updateAlertLevel(delta, source)` - External intel about security
- `confirmTeamReady()` - Gate team assembly phase

**Queries:**
- `getHeistState()` - Inspect current operation status

## Running the Demos

### Prerequisites

1. Docker and Docker Compose
2. Node.js 18+
3. pnpm (or npm/yarn)

### Setup

```bash
# Start Temporal server + Night City blockchain
docker compose up -d

# Install dependencies
pnpm install

# Start the worker
pnpm run worker
```

The docker-compose starts:
- **Temporal Server** - Workflow orchestration
- **Temporal UI** - http://localhost:8080
- **PostgreSQL** - Temporal persistence
- **Ganache** - Night City blockchain (Chain ID: 2077) on port 8545

Credstick payments are recorded as actual Ethereum transactions on the local blockchain!

### Run Scenarios

Open **two terminals**:

**Terminal 1 - Worker** (keep running):
```bash
pnpm run worker
```

**Terminal 2 - Run demos**:
```bash
# Cyberware Installation Saga
pnpm run saga

# Data Broker Scatter-Gather  
pnpm run scatter

# Heist Process Manager
pnpm run heist

# Heist with Abort Signal
pnpm run heist:abort
```

### View in Temporal UI

Open http://localhost:8080 to see workflows in the Temporal Web UI. You can inspect:
- Workflow execution history
- Activity inputs/outputs
- Retry attempts
- Compensation steps (on failures)

---

## Demo Guide

### Demo 1: Cyberware Installation Saga

The saga demo uses **experimental military-grade cyberware** with a ~25% failure rate at neural integration. Run it multiple times to see both outcomes.

```bash
pnpm run saga
```

#### Happy Path (Success)

When neural integration succeeds, you'll see all four systems complete:

```
═══════════════════════════════════════════════════════════════════════
CYBERWARE INSTALLATION SAGA - Sandevistan Prototype
Runner: V | Grade: milspec
═══════════════════════════════════════════════════════════════════════

▶ STEP 1: Reserving cyberware from fixer...
[FIXER INVENTORY] ✓ Reserved from Wakako Okada. Reservation: RSV-1706531234

▶ STEP 2: Scheduling ripperdoc appointment...
[RIPPERDOC] ✓ Appointment with Viktor Vektor. Location: Watson, Little China

▶ STEP 3: Processing credstick payment...
[CREDSTICK LEDGER] Broadcasting to Night City blockchain (Chain ID: 2077)...
[CREDSTICK LEDGER] ⛓ Transaction mined in block 42
[CREDSTICK LEDGER] ✓ Payment processed. Amount: €$78,125.00
[CREDSTICK LEDGER]   Blockchain TX: 0x8f3a2b1c4d5e6f...

▶ STEP 4: Performing neural integration...
[NEURAL REGISTRY] Beginning neural integration for V
[NEURAL REGISTRY] ✓ Integration successful! Compatibility: 82%

═══════════════════════════════════════════════════════════════════════
✓ SAGA COMPLETED SUCCESSFULLY
  Total cost: €$78,125.00
  Neural capacity remaining: 50%
═══════════════════════════════════════════════════════════════════════
```

#### Rollback Path (Failure + Compensation)

When neural integration fails, the saga executes compensations in **reverse order (LIFO)**:

```
▶ STEP 4: Performing neural integration...
[NEURAL REGISTRY] ✗ INTEGRATION FAILED! Compatibility: 62% (needed 75%)

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
✗ SAGA FAILED - INITIATING COMPENSATION
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

⚠ EMERGENCY: Neural integration failure detected
[NEURAL REGISTRY] ✓ Stabilization successful. Neural damage: 5%

▶ Executing compensation chain (LIFO order)...

  [1/3] Refund credstick payment
  [CREDSTICK LEDGER] Broadcasting refund to Night City blockchain...
  [CREDSTICK LEDGER] ⛓ Refund TX mined in block 43
  [CREDSTICK LEDGER] ✓ Refund processed on-chain. €$74,218.75

  [2/3] Cancel ripperdoc appointment
  [RIPPERDOC] ✓ Appointment cancelled. Deposit forfeited.

  [3/3] Release inventory reservation
  [FIXER INVENTORY] ✓ Released. Restocking fee: €$11,718.75

═══════════════════════════════════════════════════════════════════════
SAGA COMPENSATION COMPLETE
  Total charged: €$78,125.00
  Total refunded: €$74,218.75
  Net cost to runner: €$3,906.25
═══════════════════════════════════════════════════════════════════════
```

Both the payment AND refund are recorded on the blockchain. Check http://localhost:8545 with any Ethereum tooling to verify!

### Demo 2: Data Broker Scatter-Gather

Queries 5 data brokers in parallel and aggregates results:

```bash
pnpm run scatter
```

```
▶ SCATTER: Querying data broker network...
[AFTERLIFE] Quote: €$8,240, 36h delivery, 95% success
[NETWATCH BLACK MARKET] Connection terminated unexpectedly.
[ARASAKA SERVICES] Quote: €$12,480, 72h delivery, 98% success
[VOODOO BOYS] Quote: €$3,920, 28h delivery, 88% success
[MILITECH ACQ] Quote: €$5,880, 16h delivery, 85% success

✓ SCATTER complete: 4 responded, 1 unavailable

▶ GATHER: Aggregating broker responses...

🏆 RECOMMENDATIONS:
  💰 Best Price: Voodoo Boys Data Haven (€$3,920)
  ⚡ Fastest: Militech Acquisitions (16h)
  🎯 Most Reliable: Arasaka External Services (98%)
```

### Demo 3: Heist Process Manager

Run a full heist through all phases:

```bash
pnpm run heist
```

Or run with an abort signal mid-operation:

```bash
pnpm run heist:abort
```

The abort demo sends a `confirmTeamReady` signal, waits for the heist to progress, then sends an `abortHeist` signal—demonstrating how Temporal workflows can respond to external events.

---

## The True Beauty of Sagas

The Saga pattern shines when things go wrong. Each step in the saga has a **compensating action** that can undo its effects. If a later step fails, compensations run in reverse order to restore system consistency.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    COMPENSATION STACK (LIFO)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Step 1: Reserve Cyberware    ──►  Compensation: Release + Fee     │
│  Step 2: Schedule Appointment ──►  Compensation: Cancel + Forfeit  │
│  Step 3: Process Payment      ──►  Compensation: Refund On-Chain   │
│  Step 4: Neural Integration   ──►  (No undo - but stabilize first) │
│                                                                     │
│  On failure at Step 4:                                              │
│    1. Emergency stabilization (save the runner!)                    │
│    2. Execute Compensation 3 (refund)                               │
│    3. Execute Compensation 2 (cancel appointment)                   │
│    4. Execute Compensation 1 (release inventory)                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key insight:** The ~25% failure rate isn't a bug—it's the point. Real distributed systems fail. The saga pattern ensures that when they do, you can recover gracefully instead of leaving data in an inconsistent state across multiple services.

## Why Temporal?

Temporal handles the hard parts of distributed systems:

- **Durability:** Workflow state survives crashes, restarts, even data center failures
- **Visibility:** Full execution history for debugging and auditing
- **Retries:** Automatic retry with exponential backoff—built in, not bolted on
- **Signals/Queries:** External interaction with running workflows
- **Compensations:** Clean rollback handling when things go sideways

You write what looks like normal code. Temporal makes it reliable.

## Project Structure

```
night-city-services/
├── src/
│   ├── activities/
│   │   ├── cyberware-activities.ts   # Four persistent systems
│   │   ├── data-broker-activities.ts # Five data brokers
│   │   ├── heist-activities.ts       # Heist phase management
│   │   └── index.ts
│   ├── services/
│   │   └── blockchain.ts             # Night City blockchain (Ganache)
│   ├── workflows/
│   │   ├── cyberware-saga.ts         # Saga pattern
│   │   ├── data-broker-scatter-gather.ts # Scatter-gather
│   │   ├── heist-process-manager.ts  # Process manager
│   │   └── index.ts
│   ├── shared/
│   │   └── types.ts                  # Domain models
│   ├── workers/
│   │   └── index.ts
│   └── client.ts                     # Demo runner
├── docker-compose.yml                # Temporal + Blockchain
├── package.json
└── README.md
```

## References

- [Temporal Documentation](https://docs.temporal.io/)
- [Saga Pattern - Microsoft](https://docs.microsoft.com/en-us/azure/architecture/reference-architectures/saga/saga)
- [Sagas (Original 1987 Paper)](https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf)

---

*"The street finds its own uses for things."* — William Gibson, Neuromancer

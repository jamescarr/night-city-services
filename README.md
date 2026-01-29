# Night City Chrome & Data Services

> *"In Night City, you can become anyone. Just need the right chrome, the right connections, and the balls to use them."* — Rogue Amendiares

A Temporal-based demonstration of **enterprise integration patterns** set in a cyberpunk world inspired by Cyberpunk 2077, Shadowrun, and Johnny Mnemonic.

## The Domain

Welcome to Night City, 2077. Megacorporations rule, data is the ultimate currency, and getting chromed up at a ripperdoc is just another Tuesday. This project demonstrates three critical enterprise integration patterns through the lens of Night City's underground economy:

### 1. 🦾 Cyberware Installation Saga

**Pattern: Saga with Compensating Transactions**

Installing cyberware isn't just plugging in new hardware—it's a distributed transaction across four independent systems:

| System | Purpose | Compensation |
|--------|---------|--------------|
| **Fixer Inventory** | Reserve cyberware from the black market | Release reservation, pay restocking fee |
| **Ripperdoc Scheduling** | Book surgery appointment | Cancel appointment, forfeit deposit |
| **Credstick Ledger** | Process payment (blockchain-backed) | Issue refund (minus processing fee) |
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

**Pattern: Scatter-Gather**

When you need to move data through Night City's underground networks, you don't call one broker—you query them all and pick the best deal.

| Broker | Specialty | Reputation |
|--------|-----------|------------|
| **Afterlife Connections** | Premium service, high success rate | 95% |
| **NetWatch Black Market** | Fast but risky (rogue agents) | 70% |
| **Arasaka External Services** | Corporate precision, slow | 90% |
| **Voodoo Boys Data Haven** | AI constructs, military encryption | 85% |
| **Militech Acquisitions** | Aggressive, military specialist | 82% |

**SCATTER:** Query all 5 brokers simultaneously
**GATHER:** Analyze responses, find best by price/speed/reliability

### 3. 🎯 Heist Process Manager

**Pattern: Process Manager (Saga Orchestrator)**

Coordinating a shadowrun against Arasaka Tower requires more than just a plan—it needs a state machine that can respond to real-time intel.

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
# Start Temporal server
docker compose up -d

# Install dependencies
pnpm install

# Start the worker
pnpm run worker
```

### Run Scenarios

```bash
# Cyberware Installation Saga (may trigger compensation!)
pnpm run client saga

# Data Broker Scatter-Gather
pnpm run client scatter

# Heist Process Manager
pnpm run client heist

# Heist with Abort Signal
pnpm run client heist-abort
```

### View in Temporal UI

Open http://localhost:8080 to see workflows in the Temporal Web UI.

## The True Beauty of Sagas

The Saga pattern shines when things go wrong. Consider this scenario:

**Scenario: Installing a Sandevistan Prototype**

V walks into Viktor's clinic for experimental time-dilation cyberware. The process:

1. ✅ **Fixer reserves the Sandevistan** - €$75,000 Militech prototype locked in
2. ✅ **Ripperdoc appointment scheduled** - Viktor blocks 6 hours, deposit paid
3. ✅ **Payment processed** - V's credstick debited, blockchain confirms
4. ❌ **Neural integration FAILS** - Compatibility score 62% (needed 75%)

**Without Sagas:** V is out €$75,000, has a seizure on the operating table, Viktor still has the appointment blocked, and the Sandevistan sits in limbo.

**With Sagas:** The compensation chain fires:

```
[NEURAL REGISTRY] ⚠ EMERGENCY STABILIZATION for runner RUN-001
[NEURAL REGISTRY] Flooding system with neural suppressants...
[NEURAL REGISTRY] Disconnecting failed cyberware interfaces...
[NEURAL REGISTRY] ✓ Stabilization successful. Neural damage: 5%

[COMPENSATION 1/3] Refund credstick payment
[CREDSTICK LEDGER] ✓ Refund processed. Refunded: €$74,125.00, Fee kept: €$3,901.32

[COMPENSATION 2/3] Cancel ripperdoc appointment  
[RIPPERDOC] ✓ Appointment cancelled. Deposit forfeited: €$400.00

[COMPENSATION 3/3] Release inventory reservation
[FIXER INVENTORY] ✓ Released reservation. Restocking fee: €$11,250.00

SAGA COMPENSATION COMPLETE
  Total charged: €$78,125.00
  Total refunded: €$74,125.00
  Net cost to runner: €$4,000.00
```

V survives with minor neural scarring, gets most of their money back (minus fees for everyone's trouble), and the Sandevistan goes back to the fixer for the next runner brave (or foolish) enough to try.

## Why Temporal?

Temporal makes implementing these patterns straightforward:

- **Durability:** Workflow state survives crashes, restarts, even data center failures
- **Visibility:** Full execution history for debugging and auditing
- **Retries:** Automatic retry with exponential backoff
- **Signals/Queries:** External interaction with running workflows
- **Compensations:** Clean rollback handling when things go sideways

## Project Structure

```
temporal-patterns/
├── src/
│   ├── activities/
│   │   ├── cyberware-activities.ts  # Four persistent systems
│   │   ├── data-broker-activities.ts # Five data brokers
│   │   ├── heist-activities.ts       # Heist phase management
│   │   └── index.ts
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
├── docker-compose.yml
├── package.json
└── README.md
```

## References

- [Temporal Documentation](https://docs.temporal.io/)
- [Enterprise Integration Patterns](https://www.enterpriseintegrationpatterns.com/)
- [Saga Pattern - Microsoft](https://docs.microsoft.com/en-us/azure/architecture/reference-architectures/saga/saga)

---

*"Never fade away."* — Johnny Silverhand

# Temporal Patterns - Task Runner

set dotenv-load := true

# Default recipe - show available commands
default:
    @just --list

# =============================================================================
# Development
# =============================================================================

# Install dependencies
install:
    pnpm install

# Build TypeScript
build:
    pnpm build

# Type check
typecheck:
    pnpm typecheck

# =============================================================================
# Infrastructure
# =============================================================================

# Start Temporal server and UI
infra:
    docker compose up -d
    @echo ""
    @echo "Temporal UI: http://localhost:8080"
    @echo "Waiting for Temporal to be healthy..."
    @sleep 5

# Stop all services
down:
    docker compose down

# Stop and remove volumes
down-clean:
    docker compose down -v

# View logs
logs:
    docker compose logs -f

# View Temporal server logs
logs-temporal:
    docker compose logs -f temporal

# =============================================================================
# Worker
# =============================================================================

# Start the worker (must be running to execute workflows)
worker:
    pnpm start:worker

# =============================================================================
# Run Workflows
# =============================================================================

# Run the Order Saga workflow (Saga pattern)
saga:
    pnpm start:client order-saga

# Run the Quote Request workflow (Scatter-Gather pattern)
scatter-gather:
    pnpm start:client scatter-gather

# Run the Order Fulfillment workflow (Process Manager pattern)
process-manager:
    pnpm start:client process-manager

# Cancel an order (Process Manager)
cancel-order workflow_id reason="Customer requested":
    pnpm start:client cancel-order {{ workflow_id }} "{{ reason }}"

# Confirm delivery (Process Manager)
confirm-delivery workflow_id:
    pnpm start:client confirm-delivery {{ workflow_id }}

# Query workflow state (Process Manager)
query-state workflow_id:
    pnpm start:client query-state {{ workflow_id }}

# =============================================================================
# Demo
# =============================================================================

# Run a quick demo of all patterns
demo: infra
    @echo ""
    @echo "Starting worker in background..."
    @pnpm start:worker &
    @sleep 3
    @echo ""
    @echo "=== Running Order Saga ==="
    pnpm start:client order-saga
    @echo ""
    @echo "=== Running Scatter-Gather ==="
    pnpm start:client scatter-gather
    @echo ""
    @echo "Demo complete! Check the Temporal UI at http://localhost:8080"

# =============================================================================
# Cleanup
# =============================================================================

# Clean build artifacts
clean:
    rm -rf dist node_modules

# Full reset
reset: down-clean clean
    @echo "Full reset complete"


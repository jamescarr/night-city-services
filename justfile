# Night City Chrome & Data Services - Task Runner

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

# Start Temporal server, UI, and Night City services
up:
    docker compose up -d
    @echo ""
    @echo "Services starting..."
    @echo "  Temporal UI:         http://localhost:8080"
    @echo "  Fixer API:           http://localhost:8000"
    @echo "  Ripperdoc API:       http://localhost:8001"
    @echo "  Blockchain:          http://localhost:8545"
    @echo "  Blockchain Explorer: http://localhost:8800"
    @echo ""
    @echo "Waiting for services to be healthy..."
    @sleep 8

# Stop all services
down:
    docker compose down

# Stop and remove volumes (full reset)
down-clean:
    docker compose down -v

# View all logs
logs:
    docker compose logs -f

# View Temporal server logs
logs-temporal:
    docker compose logs -f temporal

# View Fixer API logs
logs-fixer:
    docker compose logs -f fixer-api

# View Ripperdoc API logs
logs-ripperdoc:
    docker compose logs -f ripperdoc-api

# View blockchain logs
logs-blockchain:
    docker compose logs -f blockchain

# =============================================================================
# Worker
# =============================================================================

# Kill any running workers for this project
kill-workers:
    @pkill -f "night-city-services.*worker" 2>/dev/null || echo "No workers running"

# Start a single worker
worker:
    pnpm run worker

# Start multiple workers (default: 3)
workers count="3":
    #!/usr/bin/env bash
    set -e
    echo "Starting {{ count }} workers..."
    for i in $(seq 1 {{ count }}); do
        echo "  Starting worker $i..."
        pnpm run worker &
        sleep 1
    done
    echo ""
    echo "{{ count }} workers running. Press Ctrl+C to stop all."
    wait

# =============================================================================
# Run Workflows
# =============================================================================

# Run the Cyberware Installation Saga
saga:
    pnpm run saga

# Run the Data Broker Scatter-Gather
scatter:
    pnpm run scatter

# Run the Heist Process Manager
heist:
    pnpm run heist

# Run the Heist with abort signal
heist-abort:
    pnpm run heist:abort

# =============================================================================
# Demo
# =============================================================================

# Full demo: start infra, worker, and run saga
demo: up
    @echo ""
    @echo "Starting worker in background..."
    @pnpm run worker &
    @sleep 5
    @echo ""
    @echo "=== Running Cyberware Installation Saga ==="
    @echo "(Rate limiting demo: first 3 requests will get 429s)"
    @echo ""
    pnpm run saga
    @echo ""
    @echo "Demo complete! Check the Temporal UI at http://localhost:8080"

# Run all three patterns in sequence
demo-all: up
    @echo ""
    @echo "Starting worker in background..."
    @pnpm run worker &
    @sleep 5
    @echo ""
    @echo "=== 1/3: Cyberware Installation Saga ==="
    pnpm run saga
    @echo ""
    @echo "=== 2/3: Data Broker Scatter-Gather ==="
    pnpm run scatter
    @echo ""
    @echo "=== 3/3: Heist Process Manager ==="
    pnpm run heist
    @echo ""
    @echo "All demos complete! Check the Temporal UI at http://localhost:8080"

# =============================================================================
# Utilities
# =============================================================================

# Register custom search attributes (run once after starting Temporal)
setup-search-attributes:
    ./scripts/setup-search-attributes.sh

# Check service health
health:
    @echo "Checking services..."
    @curl -sf http://localhost:8000/health > /dev/null && echo "  Fixer API:     ✓" || echo "  Fixer API:     ✗"
    @curl -sf http://localhost:8001/health > /dev/null && echo "  Ripperdoc API: ✓" || echo "  Ripperdoc API: ✗"
    @curl -sf http://localhost:8545 -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' > /dev/null && echo "  Blockchain:    ✓" || echo "  Blockchain:    ✗"
    @curl -sf http://localhost:8080 > /dev/null && echo "  Temporal UI:   ✓" || echo "  Temporal UI:   ✗"

# =============================================================================
# Cleanup
# =============================================================================

# Clean build artifacts
clean:
    rm -rf dist node_modules

# Full reset (stop containers, remove volumes, clean build)
reset: down-clean clean
    @echo "Full reset complete"

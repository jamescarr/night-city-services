#!/bin/bash
# Register custom search attributes for semantic workflow events
# Run this once after starting Temporal

set -e

echo "Registering custom search attributes..."

# Wait for Temporal to be ready
echo "Waiting for Temporal server to be ready..."
sleep 5

# SagaStep: Tracks which step of the saga we're on
# This makes the "Reset to Event" dropdown much more readable
docker compose exec temporal temporal operator search-attribute create \
  --namespace default \
  --name SagaStep \
  --type Keyword \
  --address temporal:7233

echo ""
echo "✓ Search attributes registered"
echo ""
echo "You can now see SagaStep in the Temporal UI for:"
echo "  - Filtering workflows by step"
echo "  - More meaningful 'Reset to Event' options"
echo "  - Debugging where workflows failed"

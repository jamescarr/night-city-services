/**
 * Night City Services
 * 
 * Client interfaces for external services:
 * - Fixer API: Cyberware inventory and reservations (Python/FastAPI)
 * - Ripperdoc API: Street surgeon scheduling (Elixir)
 * - Blockchain: Night City credstick ledger (Ganache)
 */

export * from './fixer-api.js';
export * from './ripperdoc-api.js';
export * from './blockchain.js';

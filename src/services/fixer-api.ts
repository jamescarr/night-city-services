/**
 * Fixer's Inventory API Client
 * 
 * Interface to the Night City black market cyberware reservation system.
 * The API simulates a flaky service that rate-limits requests (429s) for
 * the first 3 attempts, demonstrating Temporal's automatic retry capabilities.
 * 
 * Usage:
 *   import { createReservation, releaseReservation } from '../services/fixer-api.js';
 *   
 *   const reservation = await createReservation({ ... });
 *   await releaseReservation(reservation.reservationId, 'cancelled');
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const FIXER_API_URL = process.env.FIXER_API_URL || 'http://localhost:8000';

// ============================================================================
// TYPES
// ============================================================================

export interface ReservationRequest {
  runnerId: string;
  runnerHandle: string;
  cyberwareId: string;
  cyberwareName: string;
  manufacturer: string;
  basePrice: number;
  runnerReputation?: number;
  requestId?: string;
}

export interface Reservation {
  reservationId: string;
  cyberwareId: string;
  fixerId: string;
  fixerName: string;
  runnerId: string;
  reservedAt: Date;
  expiresAt: Date;
  status: 'active' | 'fulfilled' | 'released' | 'expired';
  unitPrice: number;
  quantity: number;
}

export interface ReleaseResult {
  reservationId: string;
  releasedAt: Date;
  reason: string;
  restockFee: number;
}

export interface FixerInfo {
  id: string;
  name: string;
  specialty: string;
}

// Note: We use simple Error throws here. Temporal automatically retries any
// thrown Error based on the retry policy configured in proxyActivities().
// No special error classes needed for retry behavior.

// ============================================================================
// API CLIENT
// ============================================================================

/**
 * Create a cyberware reservation with a fixer.
 * 
 * Note: The API returns 429 for the first 3 attempts by default.
 * Temporal's retry mechanism will handle this automatically - just throw
 * any Error and Temporal retries based on your policy configuration.
 * 
 * @throws {Error} On any API error (Temporal will retry automatically)
 */
export async function createReservation(
  request: ReservationRequest
): Promise<Reservation> {
  console.log(`[FIXER API CLIENT] Creating reservation at ${FIXER_API_URL}`);
  
  const response = await fetch(`${FIXER_API_URL}/reservations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(request.requestId && { 'X-Request-ID': `${request.requestId}-reserve` })
    },
    body: JSON.stringify({
      runner_id: request.runnerId,
      runner_handle: request.runnerHandle,
      cyberware_id: request.cyberwareId,
      cyberware_name: request.cyberwareName,
      manufacturer: request.manufacturer,
      base_price: request.basePrice,
      runner_reputation: request.runnerReputation || 0
    })
  });
  
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || '10';
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody.detail?.message || 'Rate limited by fixer';
    console.log(`[FIXER API CLIENT] ⚠ Rate limited. Retry after ${retryAfter}s`);
    // Just throw a regular Error - Temporal retries it automatically
    throw new Error(`Rate limited: ${message}`);
  }
  
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody.detail?.message || response.statusText;
    throw new Error(`Fixer API error (${response.status}): ${message}`);
  }
  
  const data = await response.json();
  
  const reservation: Reservation = {
    reservationId: data.reservation_id,
    cyberwareId: data.cyberware_id,
    fixerId: data.fixer_id,
    fixerName: data.fixer_name,
    runnerId: data.runner_id,
    reservedAt: new Date(data.reserved_at),
    expiresAt: new Date(data.expires_at),
    status: data.status,
    unitPrice: data.unit_price,
    quantity: data.quantity
  };
  
  console.log(`[FIXER API CLIENT] ✓ Reservation created: ${reservation.reservationId}`);
  return reservation;
}

/**
 * Release a cyberware reservation back to the fixer's inventory.
 * 
 * Called as a compensation action when installation fails.
 * This endpoint skips rate limiting to ensure compensations succeed.
 * 
 * @throws {Error} On API error
 */
export async function releaseReservation(
  reservationId: string,
  reason: 'installation_failed' | 'cancelled' | 'expired'
): Promise<ReleaseResult> {
  console.log(`[FIXER API CLIENT] Releasing reservation ${reservationId}`);
  
  // Skip rate limiting for compensation calls - we need these to succeed
  const response = await fetch(
    `${FIXER_API_URL}/reservations/${reservationId}?skip_rate_limit=true`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    }
  );
  
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody.detail?.message || response.statusText;
    throw new Error(`Fixer API error (${response.status}): ${message}`);
  }
  
  const data = await response.json();
  
  const result: ReleaseResult = {
    reservationId: data.reservation_id,
    releasedAt: new Date(data.released_at),
    reason: data.reason,
    restockFee: data.restock_fee
  };
  
  console.log(`[FIXER API CLIENT] ✓ Released. Restocking fee: €$${result.restockFee.toFixed(2)}`);
  return result;
}

/**
 * Get details of a specific reservation.
 */
export async function getReservation(reservationId: string): Promise<Reservation> {
  const response = await fetch(`${FIXER_API_URL}/reservations/${reservationId}`);
  
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody.detail?.message || response.statusText;
    throw new Error(`Fixer API error (${response.status}): ${message}`);
  }
  
  const data = await response.json();
  
  return {
    reservationId: data.reservation_id,
    cyberwareId: data.cyberware_id,
    fixerId: data.fixer_id,
    fixerName: data.fixer_name,
    runnerId: data.runner_id,
    reservedAt: new Date(data.reserved_at),
    expiresAt: new Date(data.expires_at),
    status: data.status,
    unitPrice: data.unit_price,
    quantity: data.quantity
  };
}

/**
 * List all available fixers.
 */
export async function listFixers(): Promise<FixerInfo[]> {
  const response = await fetch(`${FIXER_API_URL}/fixers`);
  
  if (!response.ok) {
    throw new Error(`Fixer API error (${response.status}): ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.fixers;
}

/**
 * Check if the Fixer API is available.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${FIXER_API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

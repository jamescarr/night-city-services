/**
 * Cyberware Installation Activities
 * 
 * These activities represent interactions with FOUR separate persistent systems
 * in Night City's underground economy. Each system maintains its own state,
 * and failures require careful compensation to maintain consistency.
 * 
 * Systems:
 * 1. Fixer's Inventory - Tracks cyberware stock and reservations
 * 2. Credstick Ledger - Blockchain-backed payment processing
 * 3. Ripperdoc Scheduling - Appointment management for street surgeons
 * 4. Neural Registry - Tracks cyberware integration and runner health
 * 
 * The saga pattern ensures that if neural integration fails mid-surgery,
 * we properly: stabilize the runner, refund payments, release inventory,
 * and cancel any follow-up appointments.
 */

import { 
  CyberwareInstallationRequest,
  InventoryReservation,
  InventoryReleaseResult,
  CredstickTransaction,
  RefundResult,
  RipperdocAppointment,
  AppointmentCancellation,
  NeuralIntegrationResult,
  EmergencyStabilization,
  RunnerNotification,
  CyberwareSpec
} from '../shared/types';

import {
  initBlockchain,
  recordPayment,
  recordRefund,
  isBlockchainConnected,
  ACCOUNTS
} from '../services/blockchain.js';

import {
  createReservation,
  releaseReservation
} from '../services/fixer-api.js';

import {
  createAppointment,
  cancelAppointment as cancelRipperdocApiAppointment
} from '../services/ripperdoc-api.js';

// ============================================================================
// SIMULATED PERSISTENT STATE (For services without external APIs)
// ============================================================================

// Credstick ledger simulation (blockchain handles persistence)
const credstickLedger: Map<string, CredstickTransaction> = new Map();

// Ripperdoc appointment book simulation
const appointmentBook: Map<string, RipperdocAppointment> = new Map();

// Neural registry simulation
const neuralRegistry: Map<string, NeuralIntegrationResult[]> = new Map();

// Blockchain initialization flag
let blockchainInitialized = false;

/**
 * Initialize the blockchain connection (called lazily on first payment)
 */
async function ensureBlockchainConnection(): Promise<void> {
  if (!blockchainInitialized) {
    await initBlockchain();
    blockchainInitialized = true;
  }
}

// ============================================================================
// FIXER'S INVENTORY SYSTEM (External API)
// ============================================================================

/**
 * Reserve cyberware from a fixer's inventory.
 * 
 * This calls the Fixer's Inventory API to create a PERSISTENT reservation.
 * The API simulates a flaky service that rate-limits requests (429s) for the
 * first 3 attempts, demonstrating Temporal's automatic retry capabilities.
 * 
 * If the installation fails, we MUST call releaseCyberwareReservation to free it up.
 * 
 * Note: We let errors propagate naturally - Temporal's retry policy handles
 * transient failures. No need to catch and re-throw.
 */
export async function reserveCyberware(
  request: CyberwareInstallationRequest
): Promise<InventoryReservation> {
  console.log(`[FIXER INVENTORY] Runner ${request.runner.handle} requesting ${request.cyberware.name}`);
  
  // Call the Fixer API - let errors propagate for Temporal to retry
  const apiReservation = await createReservation({
    runnerId: request.runner.runnerId,
    runnerHandle: request.runner.handle,
    cyberwareId: request.cyberware.cyberwareId,
    cyberwareName: request.cyberware.name,
    manufacturer: request.cyberware.manufacturer,
    basePrice: request.cyberware.basePrice,
    runnerReputation: request.runner.reputation,
    requestId: request.requestId
  });
  
  // Map API response to our domain type
  const reservation: InventoryReservation = {
    reservationId: apiReservation.reservationId,
    cyberwareId: apiReservation.cyberwareId,
    fixerId: apiReservation.fixerId,
    fixerName: apiReservation.fixerName,
    runnerId: apiReservation.runnerId,
    reservedAt: apiReservation.reservedAt,
    expiresAt: apiReservation.expiresAt,
    status: apiReservation.status,
    unitPrice: apiReservation.unitPrice,
    quantity: apiReservation.quantity
  };
  
  console.log(
    `[FIXER INVENTORY] ✓ Reserved ${request.cyberware.name} from ${reservation.fixerName}. ` +
    `Reservation: ${reservation.reservationId}, Price: €$${reservation.unitPrice.toFixed(2)}`
  );
  
  return reservation;
}

/**
 * COMPENSATION: Release a cyberware reservation back to the fixer.
 * 
 * Called when installation fails. Calls the Fixer's Inventory API to
 * release the reservation. The fixer charges a restocking fee.
 */
export async function releaseCyberwareReservation(
  reservationId: string,
  reason: InventoryReleaseResult['reason']
): Promise<InventoryReleaseResult> {
  console.log(`[FIXER INVENTORY] Releasing reservation ${reservationId}. Reason: ${reason}`);
  
  const apiResult = await releaseReservation(reservationId, reason);
  
  const result: InventoryReleaseResult = {
    reservationId: apiResult.reservationId,
    releasedAt: apiResult.releasedAt,
    reason: apiResult.reason as InventoryReleaseResult['reason'],
    restockFee: apiResult.restockFee
  };
  
  console.log(
    `[FIXER INVENTORY] ✓ Released reservation. ` +
    `Restocking fee: €$${result.restockFee?.toFixed(2) || '0.00'}`
  );
  
  return result;
}

// ============================================================================
// CREDSTICK PAYMENT SYSTEM
// ============================================================================

/**
 * Process payment from runner's credstick.
 * 
 * This creates a PERSISTENT transaction on the Night City blockchain (chain ID 2077).
 * Once processed, the eurodollars are transferred to the fixer and ripperdoc escrow.
 * If installation fails, we MUST call refundPayment to reverse it.
 */
export async function processCredstickPayment(
  request: CyberwareInstallationRequest,
  reservation: InventoryReservation,
  appointment: RipperdocAppointment
): Promise<CredstickTransaction> {
  console.log(`[CREDSTICK LEDGER] Processing payment for ${request.runner.handle}`);
  
  // Initialize blockchain connection if needed
  await ensureBlockchainConnection();
  
  // Calculate total cost
  const cyberwareCost = reservation.unitPrice;
  const surgeryFee = calculateSurgeryFee(request.cyberware, appointment.installationType);
  const rushFee = request.urgency === 'rush' ? surgeryFee * 0.5 : 
                  request.urgency === 'emergency' ? surgeryFee * 1.0 : 0;
  const totalAmount = cyberwareCost + surgeryFee + rushFee + appointment.depositPaid;
  
  // 15% chance of payment failure (insufficient funds, blocked credstick, etc.)
  if (Math.random() < 0.15) {
    const failureReasons = [
      'Credstick flagged by Arasaka security. Payment blocked.',
      'Insufficient eurodollars. Maybe try a less fancy ripperdoc?',
      'Blockchain congestion. Transaction timed out.',
      'Credstick reported stolen. NCPD notified. Run.'
    ];
    throw new Error(`[CREDSTICK LEDGER] ${failureReasons[Math.floor(Math.random() * failureReasons.length)]}`);
  }
  
  // Record payment on the Night City blockchain
  const memo = `CYBERWARE:${request.cyberware.name}:${request.runner.handle}`;
  let blockchainResult: { txHash: string; blockNumber: number; gasUsed: string };
  
  try {
    console.log(`[CREDSTICK LEDGER] Broadcasting to Night City blockchain (Chain ID: 2077)...`);
    console.log(`[CREDSTICK LEDGER] Amount: €$${totalAmount.toFixed(2)} from Runner V to Fixer Escrow`);
    blockchainResult = await recordPayment(
      ACCOUNTS.RUNNER_V,      // From: Runner's wallet
      ACCOUNTS.FIXER_ESCROW,  // To: Fixer escrow
      totalAmount,
      memo
    );
    console.log(`[CREDSTICK LEDGER] ⛓ Transaction mined in block ${blockchainResult.blockNumber}`);
    console.log(`[CREDSTICK LEDGER] ⛓ Gas used: ${blockchainResult.gasUsed}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`[CREDSTICK LEDGER] ⚠ Blockchain error: ${errorMessage}`);
    // Re-throw with the actual error for better debugging
    throw new Error(`[CREDSTICK LEDGER] Blockchain transaction failed: ${errorMessage}`);
  }
  
  const transaction: CredstickTransaction = {
    transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    credstickId: request.runner.credstickId,
    runnerId: request.runner.runnerId,
    amount: totalAmount,
    currency: request.paymentMethod === 'crypto' ? 'crypto_yuan' : 'eurodollars',
    recipient: `${reservation.fixerName} / ${appointment.ripperdocName}`,
    purpose: `Cyberware installation: ${request.cyberware.name}`,
    timestamp: new Date(),
    status: 'completed',
    blockchainRef: blockchainResult.txHash
  };
  
  // Persist to local ledger for quick lookups
  credstickLedger.set(transaction.transactionId, transaction);
  
  console.log(
    `[CREDSTICK LEDGER] ✓ Payment processed. ` +
    `Amount: €$${totalAmount.toFixed(2)}`
  );
  console.log(
    `[CREDSTICK LEDGER]   Breakdown: Cyberware €$${cyberwareCost.toFixed(2)} + ` +
    `Surgery €$${surgeryFee.toFixed(2)} + Rush €$${rushFee.toFixed(2)}`
  );
  console.log(
    `[CREDSTICK LEDGER]   Blockchain TX: ${blockchainResult.txHash.slice(0, 18)}...`
  );
  
  return transaction;
}

/**
 * COMPENSATION: Refund a credstick payment.
 * 
 * Called when installation fails after payment. Night City takes its cut
 * on refunds too - nothing's free in this town. The refund is also
 * recorded on the blockchain for full transparency.
 */
export async function refundCredstickPayment(
  transactionId: string,
  reason: string
): Promise<RefundResult> {
  console.log(`[CREDSTICK LEDGER] Processing refund for ${transactionId}. Reason: ${reason}`);
  
  // Ensure blockchain is connected
  await ensureBlockchainConnection();
  
  const originalTransaction = credstickLedger.get(transactionId);
  if (!originalTransaction) {
    throw new Error(`[CREDSTICK LEDGER] Transaction ${transactionId} not found. Check your records, choom.`);
  }
  
  // Night City processing fee (5% of transaction)
  const processingFee = originalTransaction.amount * 0.05;
  const refundedAmount = originalTransaction.amount - processingFee;
  
  // Record refund on the blockchain
  let refundTxHash: string;
  try {
    console.log(`[CREDSTICK LEDGER] Broadcasting refund to Night City blockchain...`);
    const refundResult = await recordRefund(
      ACCOUNTS.FIXER_ESCROW,  // From: Escrow
      ACCOUNTS.RUNNER_V,      // To: Runner
      refundedAmount,
      originalTransaction.blockchainRef || 'N/A',
      reason
    );
    refundTxHash = refundResult.txHash;
    console.log(`[CREDSTICK LEDGER] ⛓ Refund TX mined in block ${refundResult.blockNumber}`);
  } catch (error) {
    console.log(`[CREDSTICK LEDGER] ⚠ Blockchain refund recorded off-chain: ${error}`);
    refundTxHash = `OFFCHAIN-${Date.now()}`;
  }
  
  originalTransaction.status = 'refunded';
  
  const refundResultData: RefundResult = {
    originalTransactionId: transactionId,
    refundTransactionId: refundTxHash.slice(0, 20),
    refundedAmount,
    refundFee: processingFee,
    refundedAt: new Date(),
    status: processingFee > 0 ? 'partial' : 'full'
  };
  
  console.log(
    `[CREDSTICK LEDGER] ✓ Refund processed on-chain. ` +
    `Refunded: €$${refundedAmount.toFixed(2)}, Fee kept: €$${processingFee.toFixed(2)}`
  );
  console.log(
    `[CREDSTICK LEDGER]   Refund TX: ${refundTxHash.slice(0, 18)}...`
  );
  
  return refundResultData;
}

// ============================================================================
// RIPPERDOC SCHEDULING SYSTEM (External Elixir API)
// ============================================================================

/**
 * Schedule an appointment with a ripperdoc.
 * 
 * This calls the Ripperdoc Scheduling API (Elixir) to create a PERSISTENT
 * appointment. The doc blocks off time and prepares for the surgery.
 * If installation is cancelled, we MUST call cancelRipperdocAppointment.
 */
export async function scheduleRipperdocAppointment(
  request: CyberwareInstallationRequest,
  reservation: InventoryReservation
): Promise<RipperdocAppointment> {
  console.log(`[RIPPERDOC] Scheduling appointment for ${request.runner.handle}`);
  
  // Call the Elixir Ripperdoc API
  const apiAppointment = await createAppointment({
    runnerId: request.runner.runnerId,
    runnerHandle: request.runner.handle,
    cyberwareName: request.cyberware.name,
    cyberwareGrade: request.cyberware.grade,
    preferredRipperdoc: request.preferredRipperdoc,
  });
  
  // Estimate duration based on difficulty
  const baseDuration = request.cyberware.installDifficulty === 'routine' ? 60 :
                       request.cyberware.installDifficulty === 'complex' ? 180 : 360;
  
  // Map API response to our domain type
  const appointment: RipperdocAppointment = {
    appointmentId: apiAppointment.appointmentId,
    ripperdocId: apiAppointment.ripperdocId,
    ripperdocName: apiAppointment.ripperdocName,
    clinicLocation: apiAppointment.location,
    runnerId: apiAppointment.runnerId,
    cyberwareId: request.cyberware.cyberwareId,
    scheduledTime: apiAppointment.scheduledTime,
    estimatedDuration: baseDuration,
    status: 'scheduled',
    depositPaid: apiAppointment.depositPaid,
    installationType: apiAppointment.installationType as 'standard' | 'precision' | 'quick' | 'back_alley'
  };
  
  // Cache locally for quick lookups
  appointmentBook.set(appointment.appointmentId, appointment);
  
  console.log(
    `[RIPPERDOC] ✓ Appointment scheduled with ${appointment.ripperdocName}. ` +
    `Location: ${appointment.clinicLocation}`
  );
  console.log(
    `[RIPPERDOC]   Time: ${appointment.scheduledTime.toISOString()}, ` +
    `Duration: ${baseDuration}min, Deposit: €$${appointment.depositPaid.toFixed(2)}`
  );
  
  return appointment;
}

/**
 * COMPENSATION: Cancel a ripperdoc appointment.
 * 
 * Called when installation is aborted. Calls the Elixir API to cancel.
 */
export async function cancelRipperdocAppointment(
  appointmentId: string,
  reason: string
): Promise<AppointmentCancellation> {
  console.log(`[RIPPERDOC] Cancelling appointment ${appointmentId}. Reason: ${reason}`);
  
  // Get cached appointment for local data
  const localAppointment = appointmentBook.get(appointmentId);
  
  // Call the Elixir Ripperdoc API to cancel
  const apiResult = await cancelRipperdocApiAppointment(appointmentId, reason);
  
  // Update local cache
  if (localAppointment) {
    localAppointment.status = 'cancelled';
  }
  
  // 5% chance of pissing off the doc (local logic for demo)
  const blacklisted = Math.random() < 0.05;
  
  const cancellation: AppointmentCancellation = {
    appointmentId: apiResult.appointmentId,
    cancelledAt: apiResult.cancelledAt,
    reason: apiResult.reason,
    depositRefunded: apiResult.depositRefunded,
    cancellationFee: apiResult.depositRefunded ? 0 : (localAppointment?.depositPaid || 0),
    ripperdocBlacklisted: blacklisted
  };
  
  console.log(
    `[RIPPERDOC] ✓ Appointment cancelled via API. ` +
    `Deposit ${cancellation.depositRefunded ? 'refunded' : 'forfeited'}`
  );
  if (blacklisted) {
    console.log(`[RIPPERDOC] ⚠ You've been blacklisted. Find another doc.`);
  }
  
  return cancellation;
}

// ============================================================================
// NEURAL INTEGRATION SYSTEM
// ============================================================================

/**
 * Perform neural integration of the cyberware.
 * 
 * This is the actual surgery. The ripperdoc connects the cyberware to the
 * runner's nervous system. This is where things can go VERY wrong.
 * 
 * If integration fails, we MUST call emergencyStabilization to save the runner,
 * then roll back all other systems.
 */
export async function performNeuralIntegration(
  request: CyberwareInstallationRequest,
  appointment: RipperdocAppointment
): Promise<NeuralIntegrationResult> {
  console.log(`[NEURAL REGISTRY] Beginning neural integration for ${request.runner.handle}`);
  console.log(`[NEURAL REGISTRY] Cyberware: ${request.cyberware.name}, Slot: ${request.cyberware.slot}`);
  
  // Simulate surgery time (this is the dangerous part)
  const surgeryStages = [
    'Administering anesthetics...',
    'Mapping neural pathways...',
    'Installing cyberware housing...',
    'Connecting neural interfaces...',
    'Calibrating sensory inputs...',
    'Finalizing integration...'
  ];
  
  for (const stage of surgeryStages) {
    console.log(`[NEURAL REGISTRY] ${stage}`);
    await sleep(randomBetween(100, 200));
  }
  
  // Calculate compatibility
  const baseCompatibility = 85; // Most runners are compatible
  const gradeModifier = request.cyberware.grade === 'milspec' ? -10 :
                        request.cyberware.grade === 'corporate' ? -5 :
                        request.cyberware.grade === 'street' ? 5 : 0;
  const loadModifier = request.runner.neuralCapacity < request.cyberware.neuralLoad ? -30 : 0;
  const difficultyModifier = request.cyberware.installDifficulty === 'experimental' ? -20 :
                             request.cyberware.installDifficulty === 'complex' ? -10 : 0;
  
  const compatibilityScore = Math.max(0, Math.min(100, 
    baseCompatibility + gradeModifier + loadModifier + difficultyModifier + randomBetween(-10, 10)
  ));
  
  // Determine success (25% failure rate for drama - this is where sagas shine!)
  const successThreshold = 75;
  const success = compatibilityScore >= successThreshold;
  
  // Determine side effects
  const sideEffects: NeuralIntegrationResult['sideEffects'] = [];
  if (compatibilityScore < 90) {
    if (Math.random() < 0.3) {
      sideEffects.push({
        type: 'phantom_pain',
        severity: compatibilityScore < 60 ? 'severe' : 'mild',
        temporary: compatibilityScore > 50
      });
    }
    if (Math.random() < 0.2) {
      sideEffects.push({
        type: 'sensory_glitch',
        severity: 'moderate',
        temporary: true
      });
    }
    if (compatibilityScore < 50 && Math.random() < 0.4) {
      sideEffects.push({
        type: 'cyberpsychosis_risk',
        severity: 'severe',
        temporary: false
      });
    }
  }
  
  const result: NeuralIntegrationResult = {
    integrationId: `INT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    runnerId: request.runner.runnerId,
    cyberwareId: request.cyberware.cyberwareId,
    success,
    newNeuralCapacity: success 
      ? request.runner.neuralCapacity - request.cyberware.neuralLoad
      : request.runner.neuralCapacity - Math.floor(request.cyberware.neuralLoad * 0.1), // Partial damage on failure
    sideEffects,
    integrationTime: new Date(),
    stabilizationRequired: !success,
    compatibilityScore
  };
  
  // Persist to neural registry
  if (!neuralRegistry.has(request.runner.runnerId)) {
    neuralRegistry.set(request.runner.runnerId, []);
  }
  neuralRegistry.get(request.runner.runnerId)!.push(result);
  
  if (success) {
    console.log(
      `[NEURAL REGISTRY] ✓ Integration successful! ` +
      `Compatibility: ${compatibilityScore}%, New capacity: ${result.newNeuralCapacity}`
    );
    if (sideEffects.length > 0) {
      console.log(`[NEURAL REGISTRY] ⚠ Side effects detected: ${sideEffects.map(s => s.type).join(', ')}`);
    }
  } else {
    console.log(
      `[NEURAL REGISTRY] ✗ INTEGRATION FAILED! ` +
      `Compatibility: ${compatibilityScore}% (needed ${successThreshold}%)`
    );
    console.log(`[NEURAL REGISTRY] ⚠ Runner requires emergency stabilization!`);
    throw new Error(
      `Neural integration failed. Compatibility score ${compatibilityScore}% below threshold. ` +
      `Runner ${request.runner.handle} needs immediate medical attention!`
    );
  }
  
  return result;
}

/**
 * COMPENSATION: Emergency neural stabilization.
 * 
 * Called when integration fails. The ripperdoc has to safely disconnect
 * the cyberware and stabilize the runner's neural pathways.
 * This costs extra and might cause permanent neural damage.
 */
export async function emergencyNeuralStabilization(
  runnerId: string,
  cyberwareId: string,
  ripperdocName: string
): Promise<EmergencyStabilization> {
  console.log(`[NEURAL REGISTRY] ⚠ EMERGENCY STABILIZATION for runner ${runnerId}`);
  
  // This is urgent - simulate frantic medical work
  const stabilizationSteps = [
    'Flooding system with neural suppressants...',
    'Disconnecting failed cyberware interfaces...',
    'Rerouting damaged neural pathways...',
    'Stabilizing vital signs...',
    'Administering recovery stims...'
  ];
  
  for (const step of stabilizationSteps) {
    console.log(`[NEURAL REGISTRY] ${step}`);
    await sleep(randomBetween(100, 200));
  }
  
  // 95% success rate for stabilization (ripperdocs are good at this)
  const success = Math.random() < 0.95;
  
  // Calculate neural damage (some is permanent)
  const neuralDamage = success ? randomBetween(2, 8) : randomBetween(10, 25);
  
  // Emergency work isn't cheap
  const emergencyCost = randomBetween(500, 2000);
  
  const stabilization: EmergencyStabilization = {
    stabilizationId: `STAB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    runnerId,
    cyberwareId,
    performedAt: new Date(),
    success,
    neuralDamage,
    emergencyCost,
    ripperdocNotes: success
      ? `Runner stabilized. Some neural scarring expected. Recommend 48-hour rest period.`
      : `Complications during stabilization. Runner transferred to trauma center. Prognosis uncertain.`
  };
  
  console.log(
    `[NEURAL REGISTRY] ${success ? '✓' : '✗'} Stabilization ${success ? 'successful' : 'FAILED'}. ` +
    `Neural damage: ${neuralDamage}%, Emergency cost: €$${emergencyCost}`
  );
  
  return stabilization;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * Send installation confirmation to runner.
 */
export async function sendInstallationConfirmation(
  request: CyberwareInstallationRequest,
  result: NeuralIntegrationResult
): Promise<RunnerNotification> {
  console.log(`[COMMS] Sending confirmation to ${request.runner.handle}`);
  
  await sleep(50);
  
  const notification: RunnerNotification = {
    notificationId: `NOTIF-${Date.now()}`,
    runnerId: request.runner.runnerId,
    channel: 'neural_link',
    message: 
      `Chrome installation complete, ${request.runner.handle}. ` +
      `Your new ${request.cyberware.name} is online. ` +
      `Neural capacity: ${result.newNeuralCapacity}%. ` +
      `${result.sideEffects.length > 0 ? 'Watch for side effects.' : 'No complications detected.'} ` +
      `Welcome to the future.`,
    priority: 'info',
    sentAt: new Date(),
    acknowledged: false
  };
  
  console.log(`[COMMS] ✓ Confirmation sent via neural link`);
  return notification;
}

/**
 * Send failure notification to runner.
 */
export async function sendInstallationFailureNotification(
  request: CyberwareInstallationRequest,
  reason: string,
  compensations: string[]
): Promise<RunnerNotification> {
  console.log(`[COMMS] Sending failure notification to ${request.runner.handle}`);
  
  await sleep(50);
  
  const notification: RunnerNotification = {
    notificationId: `NOTIF-${Date.now()}`,
    runnerId: request.runner.runnerId,
    channel: 'neural_link',
    message: 
      `Bad news, ${request.runner.handle}. Installation failed: ${reason}. ` +
      `Compensations executed: ${compensations.join(', ')}. ` +
      `Refunds processing. Contact your fixer for next steps.`,
    priority: 'critical',
    sentAt: new Date(),
    acknowledged: false
  };
  
  console.log(`[COMMS] ✓ Failure notification sent`);
  return notification;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

interface Fixer {
  id: string;
  name: string;
  specialty: string;
}

function selectFixer(manufacturer: string): Fixer {
  const fixers: Record<string, Fixer> = {
    'Arasaka': { id: 'FIX-001', name: 'Wakako Okada', specialty: 'Corporate imports' },
    'Militech': { id: 'FIX-002', name: 'Rogue Amendiares', specialty: 'Military hardware' },
    'Zetatech': { id: 'FIX-003', name: 'Padre', specialty: 'Budget chrome' },
    'Kang Tao': { id: 'FIX-004', name: 'Mr. Hands', specialty: 'Eastern tech' },
    'default': { id: 'FIX-005', name: 'Dexter DeShawn', specialty: 'General fixer' }
  };
  
  return fixers[manufacturer] || fixers['default'];
}

interface Ripperdoc {
  id: string;
  name: string;
  location: string;
  specialty: string;
}

function selectRipperdoc(difficulty: CyberwareSpec['installDifficulty'], preferred?: string): Ripperdoc {
  const ripperdocs: Ripperdoc[] = [
    { id: 'DOC-001', name: 'Viktor Vektor', location: 'Watson, Little China', specialty: 'Complex installations' },
    { id: 'DOC-002', name: 'Cassius Ryder', location: 'Northside, Watson', specialty: 'Experimental tech' },
    { id: 'DOC-003', name: 'Charles Bucks', location: 'Kabuki', specialty: 'Budget installs' },
    { id: 'DOC-004', name: 'Finn Gerstatt', location: 'Wellsprings', specialty: 'Routine work' },
    { id: 'DOC-005', name: 'Doc Fingers', location: 'Jig-Jig Street', specialty: 'Back-alley specials' }
  ];
  
  if (preferred) {
    const found = ripperdocs.find(d => d.name.toLowerCase().includes(preferred.toLowerCase()));
    if (found) return found;
  }
  
  // Match ripperdoc to difficulty
  if (difficulty === 'experimental') return ripperdocs[1]; // Cassius
  if (difficulty === 'complex') return ripperdocs[0]; // Viktor
  return ripperdocs[3]; // Finn for routine
}

function calculateSurgeryFee(cyberware: CyberwareSpec, installType: string): number {
  const baseFee = cyberware.installDifficulty === 'routine' ? 200 :
                  cyberware.installDifficulty === 'complex' ? 750 : 2000;
  
  const typeMultiplier = installType === 'back_alley' ? 0.5 :
                         installType === 'rush' ? 1.5 : 1.0;
  
  return baseFee * typeMultiplier;
}

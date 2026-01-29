/**
 * Night City Chrome & Data Services
 * 
 * Domain types for our cyberpunk-themed saga demonstrations.
 * Set in a world where megacorps rule, data is currency, and
 * getting chromed up at a ripperdoc is just another Tuesday.
 */

// ============================================================================
// RUNNER IDENTITY
// ============================================================================

export interface Runner {
  runnerId: string;
  handle: string; // Street name
  realName?: string; // Only fixers know this
  credstickId: string;
  currentChrome: InstalledCyberware[];
  neuralCapacity: number; // How much more chrome they can handle (0-100)
  reputation: number; // Street cred (affects pricing)
}

export interface InstalledCyberware {
  cyberwareId: string;
  name: string;
  slot: CyberwareSlot;
  installedAt: Date;
  ripperdocId: string;
  condition: 'pristine' | 'good' | 'degraded' | 'failing';
}

// ============================================================================
// CYBERWARE CATALOG
// ============================================================================

export type CyberwareSlot = 
  | 'neural' 
  | 'optics' 
  | 'arms' 
  | 'legs' 
  | 'torso' 
  | 'hands' 
  | 'skeleton' 
  | 'immune_system';

export type CyberwareGrade = 
  | 'street' // Cheap, unreliable
  | 'standard' // Normal quality
  | 'corporate' // High quality, expensive
  | 'milspec'; // Military spec, very rare

export interface CyberwareSpec {
  cyberwareId: string;
  name: string;
  manufacturer: string; // Arasaka, Militech, Zetatech, etc.
  slot: CyberwareSlot;
  grade: CyberwareGrade;
  neuralLoad: number; // How much neural capacity it uses
  basePrice: number; // In eurodollars
  installDifficulty: 'routine' | 'complex' | 'experimental';
  description: string;
}

// ============================================================================
// CYBERWARE INSTALLATION REQUEST
// ============================================================================

export interface CyberwareInstallationRequest {
  requestId: string;
  runner: Runner;
  cyberware: CyberwareSpec;
  preferredRipperdoc?: string;
  urgency: 'standard' | 'rush' | 'emergency';
  paymentMethod: 'credstick' | 'crypto' | 'barter';
}

// ============================================================================
// FIXER'S INVENTORY SYSTEM (Persistent System #1)
// ============================================================================

export interface InventoryReservation {
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

export interface InventoryReleaseResult {
  reservationId: string;
  releasedAt: Date;
  reason: 'cancelled' | 'installation_failed' | 'expired' | 'refunded';
  restockFee?: number; // Some fixers charge for returns
}

// ============================================================================
// CREDSTICK PAYMENT SYSTEM (Persistent System #2)
// ============================================================================

export interface CredstickTransaction {
  transactionId: string;
  credstickId: string;
  runnerId: string;
  amount: number;
  currency: 'eurodollars' | 'crypto_yuan' | 'netwatch_credits';
  recipient: string;
  purpose: string;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  blockchainRef?: string; // For crypto transactions
}

export interface RefundResult {
  originalTransactionId: string;
  refundTransactionId: string;
  refundedAmount: number;
  refundFee: number; // Night City takes its cut
  refundedAt: Date;
  status: 'full' | 'partial'; // Partial if restocking fees apply
}

// ============================================================================
// RIPPERDOC SCHEDULING SYSTEM (Persistent System #3)
// ============================================================================

export interface RipperdocAppointment {
  appointmentId: string;
  ripperdocId: string;
  ripperdocName: string;
  clinicLocation: string;
  runnerId: string;
  cyberwareId: string;
  scheduledTime: Date;
  estimatedDuration: number; // Minutes
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  depositPaid: number;
  installationType: 'standard' | 'rush' | 'back_alley';
}

export interface AppointmentCancellation {
  appointmentId: string;
  cancelledAt: Date;
  reason: string;
  depositRefunded: boolean;
  cancellationFee: number;
  ripperdocBlacklisted: boolean; // Too many cancellations = problems
}

// ============================================================================
// NEURAL INTEGRATION SYSTEM (Persistent System #4)
// ============================================================================

export interface NeuralIntegrationResult {
  integrationId: string;
  runnerId: string;
  cyberwareId: string;
  success: boolean;
  newNeuralCapacity: number;
  sideEffects: NeuralSideEffect[];
  integrationTime: Date;
  stabilizationRequired: boolean;
  compatibilityScore: number; // 0-100
}

export interface NeuralSideEffect {
  type: 'cyberpsychosis_risk' | 'phantom_pain' | 'sensory_glitch' | 'memory_fragment' | 'none';
  severity: 'mild' | 'moderate' | 'severe';
  temporary: boolean;
}

export interface EmergencyStabilization {
  stabilizationId: string;
  runnerId: string;
  cyberwareId: string;
  performedAt: Date;
  success: boolean;
  neuralDamage: number; // Permanent capacity loss
  emergencyCost: number;
  ripperdocNotes: string;
}

// ============================================================================
// CYBERWARE INSTALLATION SAGA RESULT
// ============================================================================

export interface CyberwareInstallationResult {
  requestId: string;
  success: boolean;
  
  // Steps completed
  inventoryReserved?: InventoryReservation;
  paymentProcessed?: CredstickTransaction;
  appointmentScheduled?: RipperdocAppointment;
  neuralIntegration?: NeuralIntegrationResult;
  
  // Compensations executed (if failed)
  compensationsExecuted: string[];
  
  // Error info
  failureReason?: string;
  failedAtStep?: string;
  
  // Final state
  totalCost: number;
  totalRefunded: number;
  runnerNotified: boolean;
}

// ============================================================================
// DATA COURIER DOMAIN (Johnny Mnemonic Style)
// ============================================================================

export interface DataPackage {
  packageId: string;
  sizeGigabytes: number;
  encryptionLevel: 'standard' | 'corporate' | 'military' | 'ai_grade';
  dataType: 'corporate_secrets' | 'research_data' | 'blackmail' | 'ai_construct' | 'unknown';
  sourceContact: string;
  destinationContact: string;
  expiresAt?: Date; // Some data has a shelf life
  hazardLevel: 'safe' | 'hot' | 'lethal'; // How bad if intercepted
}

export interface DataBrokerQuote {
  brokerId: string;
  brokerName: string;
  brokerReputation: number;
  packageId: string;
  price: number;
  deliveryTimeHours: number;
  successProbability: number; // Based on broker's track record
  escrowRequired: boolean;
  notes: string;
}

export interface DataCourierRequest {
  requestId: string;
  dataPackage: DataPackage;
  maxBudget: number;
  maxDeliveryHours: number;
  requiresEscrow: boolean;
}

export interface DataBrokerAggregation {
  requestId: string;
  packageId: string;
  quotesReceived: DataBrokerQuote[];
  bestPrice?: DataBrokerQuote;
  fastestDelivery?: DataBrokerQuote;
  highestSuccess?: DataBrokerQuote;
  recommendation?: DataBrokerQuote;
  analysisNotes: string;
}

// ============================================================================
// SHADOWRUN / HEIST DOMAIN
// ============================================================================

export type HeistPhase = 
  | 'planning'
  | 'team_assembly'
  | 'gear_acquisition'
  | 'infiltration'
  | 'execution'
  | 'extraction'
  | 'completed'
  | 'aborted'
  | 'compromised';

export interface HeistMember {
  runnerId: string;
  handle: string;
  role: 'netrunner' | 'solo' | 'tech' | 'fixer' | 'face' | 'wheelman';
  cutPercentage: number;
  status: 'recruited' | 'ready' | 'in_position' | 'compromised' | 'extracted' | 'mia';
}

export interface HeistTarget {
  targetId: string;
  corporationName: string;
  facilityName: string;
  securityLevel: 'minimal' | 'standard' | 'high' | 'black_site';
  objective: string;
  estimatedPayout: number;
  intelQuality: 'rumors' | 'partial' | 'detailed' | 'insider';
}

export interface HeistProcess {
  heistId: string;
  codename: string;
  target: HeistTarget;
  team: HeistMember[];
  currentPhase: HeistPhase;
  phaseHistory: PhaseTransition[];
  budget: number;
  spent: number;
  alertLevel: number; // 0-100, 100 = blown
  startedAt: Date;
  completedAt?: Date;
}

export interface PhaseTransition {
  from: HeistPhase;
  to: HeistPhase;
  timestamp: Date;
  reason: string;
  triggeredBy: 'workflow' | 'signal' | 'failure';
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export interface RunnerNotification {
  notificationId: string;
  runnerId: string;
  channel: 'neural_link' | 'burner_phone' | 'dead_drop' | 'fixer_relay';
  message: string;
  priority: 'info' | 'warning' | 'critical' | 'emergency';
  sentAt: Date;
  acknowledged: boolean;
}

/**
 * Night City Chrome & Data Services - CLI Client
 * 
 * Run different scenarios to demonstrate Temporal workflows.
 * 
 * Usage:
 *   pnpm run saga          # Cyberware installation saga (~25% chance of rollback!)
 *   pnpm run scatter       # Data broker scatter-gather (parallel queries)
 *   pnpm run heist         # Heist process manager (full run)
 *   pnpm run heist:abort   # Heist with abort signal mid-operation
 * 
 * Or directly:
 *   pnpm run client saga
 *   pnpm run client scatter
 *   pnpm run client heist
 *   pnpm run client heist-abort
 */

import { Connection, Client } from '@temporalio/client';
import { 
  cyberwareInstallationSaga, 
  dataBrokerScatterGather,
  heistProcessManager,
  abortHeistSignal,
  confirmTeamReadySignal,
  getHeistStateQuery
} from './workflows';
import type { 
  CyberwareInstallationRequest,
  DataCourierRequest,
  Runner,
  CyberwareSpec,
  DataPackage,
  HeistTarget,
  HeistMember
} from './shared/types';
import type { HeistConfig } from './workflows/heist-process-manager';

const TASK_QUEUE = 'night-city-services';

// ============================================================================
// SAMPLE DATA
// ============================================================================

const sampleRunner: Runner = {
  runnerId: 'RUN-001',
  handle: 'V',
  realName: 'Vincent',
  credstickId: 'CRED-NC-2077-001',
  currentChrome: [],
  neuralCapacity: 85,
  reputation: 35
};

const sampleCyberware: CyberwareSpec = {
  cyberwareId: 'CYB-KIROSHI-MK3',
  name: 'Kiroshi Optics Mk.3',
  manufacturer: 'Arasaka',
  slot: 'optics',
  grade: 'corporate',
  neuralLoad: 12,
  basePrice: 15000,
  installDifficulty: 'complex',
  description: 'High-end optical implants with threat detection, zoom, and tactical overlay.'
};

const experimentalCyberware: CyberwareSpec = {
  cyberwareId: 'CYB-SANDEVISTAN-PROTO',
  name: 'Sandevistan Prototype',
  manufacturer: 'Militech',
  slot: 'neural',
  grade: 'milspec',
  neuralLoad: 35,
  basePrice: 75000,
  installDifficulty: 'experimental',
  description: 'Experimental time-dilation cyberware. High risk of neural rejection.'
};

const sampleDataPackage: DataPackage = {
  packageId: 'PKG-JOHNNY-2023',
  sizeGigabytes: 80,
  encryptionLevel: 'military',
  dataType: 'corporate_secrets',
  sourceContact: 'Alt Cunningham',
  destinationContact: 'Spider Murphy',
  hazardLevel: 'hot'
};

const sampleHeistTarget: HeistTarget = {
  targetId: 'TGT-ARASAKA-001',
  corporationName: 'Arasaka',
  facilityName: 'Arasaka Tower - Server Room 47',
  securityLevel: 'high',
  objective: 'Extract Relic prototype data',
  estimatedPayout: 500000,
  intelQuality: 'detailed'
};

const sampleTeam: HeistMember[] = [
  { runnerId: 'RUN-002', handle: 'Jackie Welles', role: 'solo', cutPercentage: 20, status: 'recruited' },
  { runnerId: 'RUN-003', handle: 'T-Bug', role: 'netrunner', cutPercentage: 15, status: 'recruited' },
  { runnerId: 'RUN-004', handle: 'Delamain', role: 'wheelman', cutPercentage: 10, status: 'recruited' }
];

const sampleGear = [
  { name: 'Stealth Suits', cost: 5000 },
  { name: 'Quickhack Deck', cost: 15000 },
  { name: 'EMP Grenades', cost: 3000 },
  { name: 'Armored Vehicle Rental', cost: 8000 }
];

// ============================================================================
// SCENARIOS
// ============================================================================

async function runCyberwareSaga(client: Client) {
  console.log('\n' + '█'.repeat(70));
  console.log('CYBERWARE INSTALLATION SAGA DEMO');
  console.log('█'.repeat(70));
  console.log('\nThis demo shows the Saga pattern with compensating transactions.');
  console.log('The installation has a ~25% chance of neural rejection, triggering');
  console.log('a full compensation chain across all four persistent systems.\n');
  console.log('Systems involved:');
  console.log('  1. Fixer Inventory - Cyberware reservation');
  console.log('  2. Ripperdoc Scheduling - Appointment booking');
  console.log('  3. Credstick Ledger - Payment processing');
  console.log('  4. Neural Registry - Integration tracking\n');
  
  // Use experimental cyberware for higher failure chance
  const request: CyberwareInstallationRequest = {
    requestId: `REQ-${Date.now()}`,
    runner: sampleRunner,
    cyberware: experimentalCyberware, // High risk = more likely to see compensation!
    urgency: 'rush',
    paymentMethod: 'credstick'
  };
  
  console.log(`Runner: ${request.runner.handle}`);
  console.log(`Cyberware: ${request.cyberware.name} (${request.cyberware.grade})`);
  console.log(`Difficulty: ${request.cyberware.installDifficulty}`);
  console.log(`Neural Load: ${request.cyberware.neuralLoad} (capacity: ${request.runner.neuralCapacity})`);
  console.log('\n' + '─'.repeat(70) + '\n');
  
  const handle = await client.workflow.start(cyberwareInstallationSaga, {
    taskQueue: TASK_QUEUE,
    workflowId: `cyberware-saga-${Date.now()}`,
    args: [request]
  });
  
  console.log(`Workflow started: ${handle.workflowId}`);
  console.log('Waiting for completion...\n');
  
  const result = await handle.result();
  
  console.log('\n' + '─'.repeat(70));
  console.log('FINAL RESULT:');
  console.log('─'.repeat(70));
  console.log(`Success: ${result.success}`);
  console.log(`Total Cost: €$${result.totalCost.toFixed(2)}`);
  console.log(`Total Refunded: €$${result.totalRefunded.toFixed(2)}`);
  console.log(`Net Cost: €$${(result.totalCost - result.totalRefunded).toFixed(2)}`);
  if (!result.success) {
    console.log(`Failed At: ${result.failedAtStep}`);
    console.log(`Reason: ${result.failureReason}`);
    console.log(`Compensations: ${result.compensationsExecuted.join(', ')}`);
  }
}

async function runScatterGather(client: Client) {
  console.log('\n' + '█'.repeat(70));
  console.log('DATA BROKER SCATTER-GATHER DEMO');
  console.log('█'.repeat(70));
  console.log('\nThis demo shows the Scatter-Gather pattern.');
  console.log('We query 5 data brokers simultaneously and aggregate results.\n');
  console.log('Brokers:');
  console.log('  - Afterlife Connections (premium, reliable)');
  console.log('  - NetWatch Black Market (risky, fast)');
  console.log('  - Arasaka External Services (corporate, slow)');
  console.log('  - Voodoo Boys Data Haven (unpredictable, cheap for hard targets)');
  console.log('  - Militech Acquisitions (aggressive, military specialist)\n');
  
  const request: DataCourierRequest = {
    requestId: `DCR-${Date.now()}`,
    dataPackage: sampleDataPackage,
    maxBudget: 20000,
    maxDeliveryHours: 48,
    requiresEscrow: false
  };
  
  console.log(`Package: ${request.dataPackage.packageId}`);
  console.log(`Size: ${request.dataPackage.sizeGigabytes}GB`);
  console.log(`Encryption: ${request.dataPackage.encryptionLevel}`);
  console.log(`Hazard Level: ${request.dataPackage.hazardLevel}`);
  console.log(`Budget: €$${request.maxBudget} | Max Time: ${request.maxDeliveryHours}h`);
  console.log('\n' + '─'.repeat(70) + '\n');
  
  const handle = await client.workflow.start(dataBrokerScatterGather, {
    taskQueue: TASK_QUEUE,
    workflowId: `scatter-gather-${Date.now()}`,
    args: [request]
  });
  
  console.log(`Workflow started: ${handle.workflowId}`);
  console.log('Waiting for completion...\n');
  
  const result = await handle.result();
  
  console.log('\n' + '─'.repeat(70));
  console.log('AGGREGATION COMPLETE');
  console.log('─'.repeat(70));
  console.log(`Quotes Received: ${result.quotesReceived.length}/5`);
  if (result.recommendation) {
    console.log(`\nRecommended: ${result.recommendation.brokerName}`);
    console.log(`  Price: €$${result.recommendation.price}`);
    console.log(`  Delivery: ${result.recommendation.deliveryTimeHours}h`);
    console.log(`  Success Rate: ${Math.round(result.recommendation.successProbability * 100)}%`);
  }
}

async function runHeistProcessManager(client: Client, withAbort: boolean = false) {
  console.log('\n' + '█'.repeat(70));
  console.log(`HEIST PROCESS MANAGER DEMO${withAbort ? ' (WITH ABORT)' : ''}`);
  console.log('█'.repeat(70));
  console.log('\nDemonstrates Process Manager with Temporal CancellationScope.');
  console.log('Abort signal cancels the current scope, triggering emergency extraction.\n');
  console.log('Phases: planning → team_assembly → gear_acquisition → infiltration → execution → extraction → completed');
  console.log('\nSignals:');
  console.log('  - abortHeist(reason): Cancels workflow scope, triggers cleanup');
  console.log('  - updateAlertLevel(delta, source): Adjust alert (100 = auto-abort)');
  console.log('  - confirmTeamReady(): Advance past team assembly gate\n');
  
  const config: HeistConfig = {
    heistId: `HEIST-${Date.now()}`,
    codename: 'The Heist',
    target: sampleHeistTarget,
    budget: 50000,
    team: sampleTeam,
    gear: sampleGear
  };
  
  console.log(`Codename: ${config.codename}`);
  console.log(`Target: ${config.target.corporationName} - ${config.target.facilityName}`);
  console.log(`Security: ${config.target.securityLevel}`);
  console.log(`Estimated Payout: €$${config.target.estimatedPayout}`);
  console.log(`Budget: €$${config.budget}`);
  console.log(`Team: ${config.team.map(m => m.handle).join(', ')}`);
  console.log('\n' + '─'.repeat(70) + '\n');
  
  const handle = await client.workflow.start(heistProcessManager, {
    taskQueue: TASK_QUEUE,
    workflowId: `heist-${Date.now()}`,
    args: [config]
  });
  
  console.log(`Workflow started: ${handle.workflowId}`);
  
  if (withAbort) {
    // Demo: Send signals during execution
    console.log('\n📡 Sending confirmTeamReady signal...');
    await handle.signal(confirmTeamReadySignal);
    
    // Wait for workflow to progress into infiltration phase
    await new Promise(resolve => setTimeout(resolve, 25000));
    
    const state = await handle.query(getHeistStateQuery);
    console.log(`\n📊 Current state: ${state?.currentPhase || 'unknown'}`);
    console.log(`   Alert Level: ${state?.alertLevel || 0}`);
    
    // Send abort during infiltration or execution phase
    console.log('\n⚠ Sending ABORT signal (simulating compromised intel)...');
    await handle.signal(abortHeistSignal, 'Security sweep detected - compromised intel');
  } else {
    // Normal run - just confirm team
    console.log('\n📡 Sending confirmTeamReady signal...');
    await handle.signal(confirmTeamReadySignal);
  }
  
  console.log('\nWaiting for completion...\n');
  
  const result = await handle.result();
  
  console.log('\n' + '─'.repeat(70));
  console.log('HEIST COMPLETE');
  console.log('─'.repeat(70));
  console.log(`Final Phase: ${result.currentPhase}`);
  console.log(`Alert Level: ${result.alertLevel}`);
  console.log(`Budget Used: €$${result.spent}/${result.budget}`);
  console.log(`Phase History: ${result.phaseHistory.map(p => p.to).join(' → ')}`);
  
  const survivors = result.team.filter(m => m.status === 'extracted');
  const mia = result.team.filter(m => m.status === 'mia');
  console.log(`Team Extracted: ${survivors.length}/${result.team.length}`);
  if (mia.length > 0) {
    console.log(`MIA: ${mia.map(m => m.handle).join(', ')}`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const scenario = process.argv[2] || 'saga';
  
  const connection = await Connection.connect();
  const client = new Client({ connection });
  
  try {
    switch (scenario) {
      case 'saga':
        await runCyberwareSaga(client);
        break;
      case 'scatter':
        await runScatterGather(client);
        break;
      case 'heist':
        await runHeistProcessManager(client, false);
        break;
      case 'heist-abort':
        await runHeistProcessManager(client, true);
        break;
      default:
        console.log('Unknown scenario. Use: saga, scatter, heist, or heist-abort');
        process.exit(1);
    }
  } finally {
    await connection.close();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

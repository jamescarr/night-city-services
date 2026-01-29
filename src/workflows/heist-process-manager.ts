/**
 * Heist Process Manager - Shadowrun Coordination
 * 
 * This workflow demonstrates the PROCESS MANAGER pattern for orchestrating
 * long-running operations that can be influenced by external signals.
 * 
 * THE PATTERN: Process Manager (Saga Orchestrator)
 * 
 * Unlike the simple saga which runs to completion or compensation,
 * the Process Manager maintains explicit state and responds to
 * external signals throughout its lifetime.
 * 
 * KEY FEATURES:
 * - State Machine: Explicit phases with defined transitions
 * - Signals: External actors can influence the workflow (abort, pause, etc.)
 * - Queries: External actors can inspect current state
 * - Long-running: Can wait indefinitely for signals
 * - Compensations: Phase-aware rollback when aborted
 * 
 * HEIST PHASES:
 * planning → team_assembly → gear_acquisition → infiltration → execution → extraction → completed
 *                                                                                      ↓
 *                                     [abort signal] ─────────────────────────────→ aborted
 * 
 * SIGNALS:
 * - abortHeistSignal: Emergency abort at any phase
 * - updateAlertLevelSignal: External intel about security status
 * 
 * QUERIES:
 * - getHeistStateQuery: Get current heist state
 */

import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  sleep
} from '@temporalio/workflow';
import type * as activities from '../activities/heist-activities';
import type { HeistProcess, HeistTarget, HeistMember } from '../shared/types';

// Configure activities
const {
  initializeHeist,
  recruitTeamMember,
  transitionToTeamAssembly,
  acquireGear,
  transitionToGearAcquisition,
  beginInfiltration,
  executeObjective,
  extractTeam,
  completeHeist,
  abortHeist,
  getHeistState
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '60 seconds',
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumAttempts: 3
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SIGNALS - External events that influence the workflow
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Signal to abort the heist at any phase.
 * Triggers appropriate compensation based on current phase.
 */
export const abortHeistSignal = defineSignal<[string]>('abortHeist');

/**
 * Signal to update alert level (external intel).
 * Can trigger automatic abort if level is critical.
 */
export const updateAlertLevelSignal = defineSignal<[number, string]>('updateAlertLevel');

/**
 * Signal to confirm team is ready to proceed.
 * Used to gate the transition from team_assembly to gear_acquisition.
 */
export const confirmTeamReadySignal = defineSignal('confirmTeamReady');

// ═══════════════════════════════════════════════════════════════════════════
// QUERIES - External inspection of workflow state
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Query to get current heist state.
 */
export const getHeistStateQuery = defineQuery<HeistProcess | null>('getHeistState');

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════

export interface HeistConfig {
  heistId: string;
  codename: string;
  target: HeistTarget;
  budget: number;
  team: HeistMember[];
  gear: Array<{ name: string; cost: number }>;
}

export async function heistProcessManager(config: HeistConfig): Promise<HeistProcess> {
  console.log('═'.repeat(70));
  console.log(`HEIST PROCESS MANAGER - Operation "${config.codename}"`);
  console.log('═'.repeat(70));
  
  // ═══════════════════════════════════════════════════════════════════════
  // WORKFLOW STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  let heist: HeistProcess | null = null;
  let abortRequested = false;
  let abortReason = '';
  let teamConfirmed = false;
  let externalAlertUpdate = 0;
  
  // ═══════════════════════════════════════════════════════════════════════
  // SIGNAL HANDLERS
  // ═══════════════════════════════════════════════════════════════════════
  
  setHandler(abortHeistSignal, (reason: string) => {
    console.log(`\n⚠ ABORT SIGNAL RECEIVED: ${reason}`);
    abortRequested = true;
    abortReason = reason;
  });
  
  setHandler(updateAlertLevelSignal, (alertDelta: number, source: string) => {
    console.log(`\n📡 EXTERNAL INTEL: Alert level ${alertDelta > 0 ? '+' : ''}${alertDelta} from ${source}`);
    externalAlertUpdate += alertDelta;
    
    if (heist && heist.alertLevel + externalAlertUpdate >= 100) {
      console.log('⚠ CRITICAL ALERT - Auto-abort triggered');
      abortRequested = true;
      abortReason = `Critical alert level from ${source}`;
    }
  });
  
  setHandler(confirmTeamReadySignal, () => {
    console.log('\n✓ Team ready signal received');
    teamConfirmed = true;
  });
  
  setHandler(getHeistStateQuery, () => heist);
  
  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 1: PLANNING
  // ═══════════════════════════════════════════════════════════════════════
  
  console.log('\n▶ PHASE 1: PLANNING');
  
  heist = await initializeHeist(
    config.heistId,
    config.codename,
    config.target,
    config.budget
  );
  
  // Check for abort after each phase
  if (abortRequested) {
    return await abortHeist(config.heistId, abortReason);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2: TEAM ASSEMBLY
  // ═══════════════════════════════════════════════════════════════════════
  
  console.log('\n▶ PHASE 2: TEAM ASSEMBLY');
  
  heist = await transitionToTeamAssembly(config.heistId);
  
  // Recruit team members
  for (const member of config.team) {
    if (abortRequested) break;
    heist = await recruitTeamMember(config.heistId, member);
  }
  
  if (abortRequested) {
    return await abortHeist(config.heistId, abortReason);
  }
  
  // Wait for team confirmation signal (with timeout)
  console.log('\n⏳ Waiting for team confirmation signal...');
  console.log('   (Send confirmTeamReady signal to proceed, or abortHeist to cancel)');
  
  const teamConfirmTimeout = await condition(
    () => teamConfirmed || abortRequested,
    '5 minutes' // Max wait time
  );
  
  if (!teamConfirmTimeout) {
    console.log('⚠ Team confirmation timeout - proceeding anyway');
  }
  
  if (abortRequested) {
    return await abortHeist(config.heistId, abortReason);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 3: GEAR ACQUISITION
  // ═══════════════════════════════════════════════════════════════════════
  
  console.log('\n▶ PHASE 3: GEAR ACQUISITION');
  
  heist = await transitionToGearAcquisition(config.heistId);
  
  // Acquire gear
  for (const gear of config.gear) {
    if (abortRequested) break;
    heist = await acquireGear(config.heistId, gear.name, gear.cost);
  }
  
  if (abortRequested) {
    return await abortHeist(config.heistId, abortReason);
  }
  
  // Apply any external alert updates
  if (externalAlertUpdate !== 0) {
    heist.alertLevel += externalAlertUpdate;
    console.log(`\n[HEIST] Applied external intel: Alert level now ${heist.alertLevel}`);
    externalAlertUpdate = 0;
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 4: INFILTRATION
  // ═══════════════════════════════════════════════════════════════════════
  
  console.log('\n▶ PHASE 4: INFILTRATION');
  
  try {
    heist = await beginInfiltration(config.heistId);
  } catch (error) {
    console.log(`\n⚠ Infiltration failed: ${error}`);
    return await abortHeist(config.heistId, `Infiltration failure: ${error}`);
  }
  
  if (abortRequested) {
    return await abortHeist(config.heistId, abortReason);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 5: EXECUTION
  // ═══════════════════════════════════════════════════════════════════════
  
  console.log('\n▶ PHASE 5: EXECUTION');
  
  try {
    heist = await executeObjective(config.heistId);
  } catch (error) {
    console.log(`\n⚠ Execution failed: ${error}`);
    return await abortHeist(config.heistId, `Execution failure: ${error}`);
  }
  
  if (abortRequested) {
    return await abortHeist(config.heistId, abortReason);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 6: EXTRACTION
  // ═══════════════════════════════════════════════════════════════════════
  
  console.log('\n▶ PHASE 6: EXTRACTION');
  
  heist = await extractTeam(config.heistId);
  
  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 7: COMPLETION
  // ═══════════════════════════════════════════════════════════════════════
  
  console.log('\n▶ PHASE 7: COMPLETION');
  
  heist = await completeHeist(config.heistId);
  
  console.log('\n' + '═'.repeat(70));
  console.log('HEIST PROCESS MANAGER COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Final Phase: ${heist.currentPhase}`);
  console.log(`Phase History: ${heist.phaseHistory.map(p => p.to).join(' → ')}`);
  console.log(`Alert Level: ${heist.alertLevel}`);
  console.log(`Budget Used: €$${heist.spent}/${heist.budget}`);
  console.log('═'.repeat(70));
  
  return heist;
}

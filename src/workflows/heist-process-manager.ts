/**
 * Heist Process Manager - Shadowrun Coordination
 *
 * Demonstrates the PROCESS MANAGER pattern using Temporal's native
 * CancellationScope for graceful abort handling.
 *
 * ARCHITECTURE:
 * - Main workflow runs in a cancellable scope
 * - Abort signal cancels the scope, interrupting activities
 * - Emergency extraction runs in nonCancellable scope (cleanup)
 * - Activities heartbeat so they can be cancelled mid-execution
 *
 * HEIST PHASES:
 * planning → team_assembly → gear_acquisition → infiltration → execution → extraction → completed
 *                                                                                      ↓
 *                                     [abort signal] ─────────────────────────────→ aborted
 */

import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  CancellationScope,
  isCancellation,
} from '@temporalio/workflow';
import type * as activities from '../activities/heist-activities';
import type { HeistProcess, HeistTarget, HeistMember } from '../shared/types';
type Member = HeistMember;

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVITY CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

// Standard activities with heartbeat support for cancellation
const act = proxyActivities<typeof activities>({
  startToCloseTimeout: '60 seconds',
  heartbeatTimeout: '10 seconds', // Activities must heartbeat; enables mid-execution cancellation
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// SIGNALS
// ═══════════════════════════════════════════════════════════════════════════

/** Abort the heist. Cancels current activity and triggers emergency extraction. */
export const abortHeistSignal = defineSignal<[string]>('abortHeist');

/** Update alert level from external intel. */
export const updateAlertLevelSignal = defineSignal<[number, string]>('updateAlertLevel');

/** Confirm team is assembled and ready to proceed. */
export const confirmTeamReadySignal = defineSignal('confirmTeamReady');

// ═══════════════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════════════

/** Get current heist state. */
export const getHeistStateQuery = defineQuery<HeistProcess | null>('getHeistState');

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW CONFIG
// ═══════════════════════════════════════════════════════════════════════════

export interface HeistConfig {
  heistId: string;
  codename: string;
  target: HeistTarget;
  budget: number;
  team: HeistMember[];
  gear: Array<{ name: string; cost: number }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════

export async function heistProcessManager(config: HeistConfig): Promise<HeistProcess> {
  console.log('═'.repeat(70));
  console.log(`HEIST PROCESS MANAGER - Operation "${config.codename}"`);
  console.log('═'.repeat(70));

  // Workflow state
  let heist: HeistProcess | null = null;
  let teamConfirmed = false;
  let abortReason = '';

  // Create a scope we can cancel when abort signal arrives
  const heistScope = new CancellationScope();

  // ─────────────────────────────────────────────────────────────────────────
  // SIGNAL HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  setHandler(abortHeistSignal, (reason: string) => {
    console.log(`\n⚠ ABORT SIGNAL: ${reason}`);
    abortReason = reason;
    heistScope.cancel(); // Cancel the main workflow scope
  });

  setHandler(updateAlertLevelSignal, (delta: number, source: string) => {
    console.log(`\n📡 INTEL: Alert ${delta > 0 ? '+' : ''}${delta} (${source})`);
    if (heist) {
      heist.alertLevel = Math.max(0, Math.min(100, heist.alertLevel + delta));
      if (heist.alertLevel >= 100) {
        console.log('⚠ CRITICAL ALERT - triggering abort');
        abortReason = `Critical alert from ${source}`;
        heistScope.cancel();
      }
    }
  });

  setHandler(confirmTeamReadySignal, () => {
    console.log('\n✓ Team ready confirmed');
    teamConfirmed = true;
  });

  setHandler(getHeistStateQuery, () => heist);

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN EXECUTION (cancellable)
  // ─────────────────────────────────────────────────────────────────────────

  try {
    heist = await heistScope.run(async () => {
      // PHASE 1: PLANNING
      console.log('\n▶ PHASE 1: PLANNING');
      let h = await act.initializeHeist(
        config.heistId,
        config.codename,
        config.target,
        config.budget
      );

      // PHASE 2: TEAM ASSEMBLY
      console.log('\n▶ PHASE 2: TEAM ASSEMBLY');
      h = await act.transitionToTeamAssembly(config.heistId);

      for (const member of config.team) {
        h = await act.recruitTeamMember(config.heistId, member);
      }

      // Wait for team confirmation (or timeout after 5 minutes)
      console.log('\n⏳ Waiting for team confirmation...');
      await condition(() => teamConfirmed, '5 minutes');

      // PHASE 3: GEAR ACQUISITION
      console.log('\n▶ PHASE 3: GEAR ACQUISITION');
      h = await act.transitionToGearAcquisition(config.heistId);

      for (const gear of config.gear) {
        h = await act.acquireGear(config.heistId, gear.name, gear.cost);
      }

      // PHASE 4: INFILTRATION
      console.log('\n▶ PHASE 4: INFILTRATION');
      h = await act.beginInfiltration(config.heistId);

      // PHASE 5: EXECUTION
      console.log('\n▶ PHASE 5: EXECUTION');
      h = await act.executeObjective(config.heistId);

      // PHASE 6: EXTRACTION
      console.log('\n▶ PHASE 6: EXTRACTION');
      h = await act.extractTeam(config.heistId);

      // PHASE 7: COMPLETION
      console.log('\n▶ PHASE 7: COMPLETION');
      h = await act.completeHeist(config.heistId);

      return h;
    });

    // Success path
    console.log('\n' + '═'.repeat(70));
    console.log('HEIST COMPLETE');
    console.log('═'.repeat(70));
    printResult(heist);

    return heist;

  } catch (err) {
    if (isCancellation(err)) {
      // ───────────────────────────────────────────────────────────────────
      // ABORT PATH: Emergency extraction (nonCancellable)
      // ───────────────────────────────────────────────────────────────────
      console.log('\n' + '─'.repeat(70));
      console.log('INITIATING EMERGENCY EXTRACTION');
      console.log('─'.repeat(70));

      // Cleanup must run to completion, even if another cancel comes in
      heist = await CancellationScope.nonCancellable(async () => {
        return await act.abortHeist(config.heistId, abortReason);
      });

      console.log('\n' + '═'.repeat(70));
      console.log('HEIST ABORTED');
      console.log('═'.repeat(70));
      printResult(heist);

      return heist;
    }

    // Unexpected error - propagate
    throw err;
  }
}

function printResult(heist: HeistProcess): void {
  console.log(`Final Phase: ${heist.currentPhase}`);
  console.log(`Alert Level: ${heist.alertLevel}`);
  console.log(`Budget Used: €$${heist.spent}/${heist.budget}`);

  const extracted = heist.team.filter((m: Member) => m.status === 'extracted');
  const mia = heist.team.filter((m: Member) => m.status === 'mia');
  console.log(`Team: ${extracted.length}/${heist.team.length} extracted`);
  if (mia.length > 0) {
    console.log(`MIA: ${mia.map((m: Member) => m.handle).join(', ')}`);
  }
  console.log('═'.repeat(70));
}

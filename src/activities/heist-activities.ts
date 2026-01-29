/**
 * Heist Activities - Shadowrun Operations
 * 
 * Activities for coordinating shadowruns against megacorp targets.
 * Each phase of the heist has its own persistent state and can
 * be aborted if things go sideways.
 */

import type {
  HeistProcess,
  HeistPhase,
  HeistMember,
  HeistTarget,
  PhaseTransition
} from '../shared/types';

// Simulated state store for heists
const heistRegistry: Map<string, HeistProcess> = new Map();

// ============================================================================
// PLANNING PHASE
// ============================================================================

export async function initializeHeist(
  heistId: string,
  codename: string,
  target: HeistTarget,
  budget: number
): Promise<HeistProcess> {
  console.log(`[HEIST] Initializing operation "${codename}"`);
  console.log(`[HEIST] Target: ${target.corporationName} - ${target.facilityName}`);
  console.log(`[HEIST] Security: ${target.securityLevel.toUpperCase()} | Intel: ${target.intelQuality}`);
  
  await sleep(100);
  
  const heist: HeistProcess = {
    heistId,
    codename,
    target,
    team: [],
    currentPhase: 'planning',
    phaseHistory: [],
    budget,
    spent: 0,
    alertLevel: 0,
    startedAt: new Date()
  };
  
  heistRegistry.set(heistId, heist);
  
  console.log(`[HEIST] ✓ Operation "${codename}" initialized. Budget: €$${budget}`);
  return heist;
}

// ============================================================================
// TEAM ASSEMBLY
// ============================================================================

export async function recruitTeamMember(
  heistId: string,
  member: HeistMember
): Promise<HeistProcess> {
  console.log(`[HEIST] Recruiting ${member.handle} as ${member.role}...`);
  
  await sleep(randomBetween(100, 300));
  
  const heist = heistRegistry.get(heistId);
  if (!heist) throw new Error(`Heist ${heistId} not found`);
  
  // 10% chance the recruit has heat on them
  if (Math.random() < 0.10) {
    heist.alertLevel += 5;
    console.log(`[HEIST] ⚠ ${member.handle} brought attention. Alert +5`);
  }
  
  member.status = 'recruited';
  heist.team.push(member);
  
  // Calculate team cut total
  const totalCut = heist.team.reduce((sum, m) => sum + m.cutPercentage, 0);
  
  console.log(`[HEIST] ✓ ${member.handle} recruited. Cut: ${member.cutPercentage}% | Team cut total: ${totalCut}%`);
  return heist;
}

export async function transitionToTeamAssembly(heistId: string): Promise<HeistProcess> {
  return transitionPhase(heistId, 'planning', 'team_assembly', 'Planning complete, assembling team', 'workflow');
}

// ============================================================================
// GEAR ACQUISITION
// ============================================================================

export async function acquireGear(
  heistId: string,
  gearType: string,
  cost: number
): Promise<HeistProcess> {
  console.log(`[HEIST] Acquiring ${gearType}...`);
  
  await sleep(randomBetween(100, 200));
  
  const heist = heistRegistry.get(heistId);
  if (!heist) throw new Error(`Heist ${heistId} not found`);
  
  if (heist.spent + cost > heist.budget) {
    throw new Error(`Insufficient budget. Need €$${cost}, have €$${heist.budget - heist.spent}`);
  }
  
  heist.spent += cost;
  
  // Certain gear attracts attention
  const hotGear = ['military weapons', 'explosives', 'EMP device', 'blackwall breach kit'];
  if (hotGear.some(g => gearType.toLowerCase().includes(g))) {
    heist.alertLevel += 10;
    console.log(`[HEIST] ⚠ Hot merchandise. Alert +10`);
  }
  
  console.log(`[HEIST] ✓ Acquired ${gearType}. Spent: €$${heist.spent}/${heist.budget}`);
  return heist;
}

export async function transitionToGearAcquisition(heistId: string): Promise<HeistProcess> {
  return transitionPhase(heistId, 'team_assembly', 'gear_acquisition', 'Team assembled, acquiring gear', 'workflow');
}

// ============================================================================
// INFILTRATION
// ============================================================================

export async function beginInfiltration(heistId: string): Promise<HeistProcess> {
  console.log(`[HEIST] Beginning infiltration...`);
  
  await sleep(randomBetween(200, 400));
  
  const heist = heistRegistry.get(heistId);
  if (!heist) throw new Error(`Heist ${heistId} not found`);
  
  // Check if team is ready
  for (const member of heist.team) {
    member.status = 'in_position';
  }
  
  // Infiltration success depends on security level and intel quality
  const baseChance = heist.target.securityLevel === 'minimal' ? 0.95 :
                     heist.target.securityLevel === 'standard' ? 0.85 :
                     heist.target.securityLevel === 'high' ? 0.70 : 0.50;
  
  const intelBonus = heist.target.intelQuality === 'insider' ? 0.15 :
                     heist.target.intelQuality === 'detailed' ? 0.10 :
                     heist.target.intelQuality === 'partial' ? 0.05 : 0;
  
  const alertPenalty = heist.alertLevel * 0.005;
  const successChance = Math.min(0.95, baseChance + intelBonus - alertPenalty);
  
  // 15% chance of detection during infiltration
  if (Math.random() > successChance) {
    heist.alertLevel += 25;
    console.log(`[HEIST] ⚠ PARTIAL DETECTION during infiltration! Alert: ${heist.alertLevel}`);
    
    if (heist.alertLevel >= 75) {
      throw new Error('Infiltration failed - security alerted. Abort recommended.');
    }
  }
  
  console.log(`[HEIST] ✓ Team in position. Alert level: ${heist.alertLevel}`);
  return transitionPhase(heistId, 'gear_acquisition', 'infiltration', 'Gear secured, infiltrating', 'workflow');
}

// ============================================================================
// EXECUTION
// ============================================================================

export async function executeObjective(heistId: string): Promise<HeistProcess> {
  console.log(`[HEIST] Executing primary objective...`);
  
  const heist = heistRegistry.get(heistId);
  if (!heist) throw new Error(`Heist ${heistId} not found`);
  
  console.log(`[HEIST] Target: ${heist.target.objective}`);
  
  // Simulate objective stages
  const stages = [
    'Bypassing security protocols...',
    'Accessing target systems...',
    'Extracting objective...',
    'Covering tracks...'
  ];
  
  for (const stage of stages) {
    console.log(`[HEIST] ${stage}`);
    await sleep(randomBetween(150, 300));
    
    // Each stage has a chance to raise alert
    if (Math.random() < 0.15) {
      heist.alertLevel += 10;
      console.log(`[HEIST] ⚠ Alert triggered! Level: ${heist.alertLevel}`);
      
      if (heist.alertLevel >= 100) {
        await transitionPhase(heistId, heist.currentPhase, 'compromised', 'Alert level critical - operation blown', 'failure');
        throw new Error('OPERATION COMPROMISED - Security response incoming!');
      }
    }
  }
  
  console.log(`[HEIST] ✓ Objective secured!`);
  return transitionPhase(heistId, 'infiltration', 'execution', 'Objective complete', 'workflow');
}

// ============================================================================
// EXTRACTION
// ============================================================================

export async function extractTeam(heistId: string): Promise<HeistProcess> {
  console.log(`[HEIST] Beginning extraction...`);
  
  const heist = heistRegistry.get(heistId);
  if (!heist) throw new Error(`Heist ${heistId} not found`);
  
  await sleep(randomBetween(200, 400));
  
  // Extraction difficulty based on alert level
  let miaCount = 0;
  for (const member of heist.team) {
    const extractionChance = 1 - (heist.alertLevel / 200);
    if (Math.random() < extractionChance) {
      member.status = 'extracted';
      console.log(`[HEIST] ✓ ${member.handle} extracted successfully`);
    } else {
      member.status = 'mia';
      miaCount++;
      console.log(`[HEIST] ⚠ ${member.handle} is MIA`);
    }
  }
  
  if (miaCount > 0) {
    console.log(`[HEIST] ⚠ ${miaCount} team member(s) didn't make it out`);
  }
  
  return transitionPhase(heistId, 'execution', 'extraction', 'Team extraction complete', 'workflow');
}

// ============================================================================
// COMPLETION
// ============================================================================

export async function completeHeist(heistId: string): Promise<HeistProcess> {
  console.log(`[HEIST] Finalizing operation...`);
  
  const heist = heistRegistry.get(heistId);
  if (!heist) throw new Error(`Heist ${heistId} not found`);
  
  await sleep(100);
  
  heist.completedAt = new Date();
  
  // Calculate payout
  const basePayout = heist.target.estimatedPayout;
  const alertPenalty = heist.alertLevel > 50 ? basePayout * (heist.alertLevel - 50) / 200 : 0;
  const finalPayout = basePayout - alertPenalty;
  
  // Distribute among surviving team
  const survivingTeam = heist.team.filter(m => m.status === 'extracted');
  const totalCut = survivingTeam.reduce((sum, m) => sum + m.cutPercentage, 0);
  
  console.log(`[HEIST] ═══════════════════════════════════════`);
  console.log(`[HEIST] OPERATION "${heist.codename}" COMPLETE`);
  console.log(`[HEIST] ═══════════════════════════════════════`);
  console.log(`[HEIST] Base payout: €$${basePayout}`);
  console.log(`[HEIST] Alert penalty: €$${alertPenalty.toFixed(2)}`);
  console.log(`[HEIST] Final payout: €$${finalPayout.toFixed(2)}`);
  console.log(`[HEIST] Team cut (${survivingTeam.length} survivors): ${totalCut}%`);
  console.log(`[HEIST] Your take: €$${(finalPayout * (100 - totalCut) / 100).toFixed(2)}`);
  console.log(`[HEIST] ═══════════════════════════════════════`);
  
  return transitionPhase(heistId, 'extraction', 'completed', 'Operation successful', 'workflow');
}

// ============================================================================
// ABORT / COMPENSATION
// ============================================================================

export async function abortHeist(heistId: string, reason: string): Promise<HeistProcess> {
  console.log(`[HEIST] ⚠ ABORT SIGNAL RECEIVED`);
  console.log(`[HEIST] Reason: ${reason}`);
  
  const heist = heistRegistry.get(heistId);
  if (!heist) throw new Error(`Heist ${heistId} not found`);
  
  await sleep(100);
  
  // Abort compensation depends on current phase
  const phase = heist.currentPhase;
  
  if (phase === 'planning' || phase === 'team_assembly') {
    console.log(`[HEIST] Early abort - minimal exposure`);
    // Just release the team
    heist.team.forEach(m => m.status = 'extracted');
  } else if (phase === 'gear_acquisition') {
    console.log(`[HEIST] Gear acquired - attempting to resell...`);
    const resaleValue = heist.spent * 0.6; // 60% resale value
    console.log(`[HEIST] Recovered: €$${resaleValue.toFixed(2)} from gear sales`);
  } else if (phase === 'infiltration' || phase === 'execution') {
    console.log(`[HEIST] ⚠ EMERGENCY EXTRACTION REQUIRED`);
    // Emergency extraction - higher MIA chance
    for (const member of heist.team) {
      if (Math.random() < 0.7) {
        member.status = 'extracted';
        console.log(`[HEIST] ${member.handle} extracted`);
      } else {
        member.status = 'mia';
        console.log(`[HEIST] ⚠ ${member.handle} is MIA`);
      }
    }
  }
  
  heist.completedAt = new Date();
  
  return transitionPhase(heistId, phase, 'aborted', `Aborted: ${reason}`, 'signal');
}

export async function getHeistState(heistId: string): Promise<HeistProcess | null> {
  return heistRegistry.get(heistId) || null;
}

// ============================================================================
// HELPERS
// ============================================================================

async function transitionPhase(
  heistId: string,
  from: HeistPhase,
  to: HeistPhase,
  reason: string,
  triggeredBy: 'workflow' | 'signal' | 'failure'
): Promise<HeistProcess> {
  const heist = heistRegistry.get(heistId);
  if (!heist) throw new Error(`Heist ${heistId} not found`);
  
  const transition: PhaseTransition = {
    from,
    to,
    timestamp: new Date(),
    reason,
    triggeredBy
  };
  
  heist.phaseHistory.push(transition);
  heist.currentPhase = to;
  
  console.log(`[HEIST] Phase transition: ${from} → ${to}`);
  
  return heist;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

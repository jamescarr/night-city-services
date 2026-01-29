/**
 * Cyberware Installation Saga
 * 
 * This workflow demonstrates the SAGA pattern with compensating transactions.
 * 
 * THE PROBLEM:
 * Installing cyberware requires coordinating FOUR independent systems:
 * 1. Fixer's Inventory - Reserve the chrome
 * 2. Credstick Payment - Transfer the eddies
 * 3. Ripperdoc Scheduling - Book the surgery
 * 4. Neural Integration - Actually install the hardware
 * 
 * Each system maintains its own persistent state. If any step fails,
 * we need to undo all previous steps to maintain consistency.
 * 
 * THE SOLUTION:
 * The Saga pattern treats the distributed transaction as a series of
 * local transactions. Each step records a compensation action that
 * can undo its effects. If a later step fails, we execute compensations
 * in REVERSE ORDER (LIFO) to restore consistency.
 * 
 * FAILURE SCENARIO DEMONSTRATED:
 * 1. ✓ Reserve cyberware from fixer
 * 2. ✓ Schedule ripperdoc appointment  
 * 3. ✓ Process credstick payment
 * 4. ✗ Neural integration FAILS (incompatible cyberware!)
 * 
 * COMPENSATION CHAIN:
 * 4. Emergency stabilization (save the runner!)
 * 3. Refund credstick payment
 * 2. Cancel ripperdoc appointment
 * 1. Release inventory reservation
 * 
 * This ensures no orphaned reservations, no lost payments, and
 * most importantly - the runner survives to chrome another day.
 */

import { proxyActivities, ApplicationFailure } from '@temporalio/workflow';
import type * as activities from '../activities/cyberware-activities';
import type {
  CyberwareInstallationRequest,
  CyberwareInstallationResult,
  InventoryReservation,
  RipperdocAppointment,
  CredstickTransaction
} from '../shared/types';

// Configure activities with retry policies
const {
  reserveCyberware,
  releaseCyberwareReservation,
  scheduleRipperdocAppointment,
  cancelRipperdocAppointment,
  processCredstickPayment,
  refundCredstickPayment,
  performNeuralIntegration,
  emergencyNeuralStabilization,
  sendInstallationConfirmation,
  sendInstallationFailureNotification
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumAttempts: 3,
    maximumInterval: '30 seconds',
    // Don't retry on business logic failures
    nonRetryableErrorTypes: [
      'InsufficientFunds',
      'StockUnavailable', 
      'NeuralIncompatibility'
    ]
  }
});

/**
 * The main Cyberware Installation Saga workflow.
 * 
 * This workflow coordinates four persistent systems to install cyberware.
 * It maintains a compensation stack and executes rollback on any failure.
 */
export async function cyberwareInstallationSaga(
  request: CyberwareInstallationRequest
): Promise<CyberwareInstallationResult> {
  console.log('═'.repeat(70));
  console.log(`CYBERWARE INSTALLATION SAGA - ${request.cyberware.name}`);
  console.log(`Runner: ${request.runner.handle} | Grade: ${request.cyberware.grade}`);
  console.log('═'.repeat(70));
  
  // Initialize result tracking
  const result: CyberwareInstallationResult = {
    requestId: request.requestId,
    success: false,
    compensationsExecuted: [],
    totalCost: 0,
    totalRefunded: 0,
    runnerNotified: false
  };
  
  // The compensation stack - functions to undo each completed step
  // Compensations are executed in REVERSE ORDER (LIFO) on failure
  const compensations: Array<{
    name: string;
    execute: () => Promise<void>;
  }> = [];
  
  try {
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: Reserve cyberware from fixer's inventory
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n▶ STEP 1: Reserving cyberware from fixer...');
    
    const reservation = await reserveCyberware(request);
    result.inventoryReserved = reservation;
    result.totalCost += reservation.unitPrice;
    
    // Register compensation: Release the reservation
    compensations.push({
      name: 'Release inventory reservation',
      execute: async () => {
        console.log('  ↩ Compensation: Releasing inventory reservation...');
        const release = await releaseCyberwareReservation(
          reservation.reservationId,
          'installation_failed'
        );
        if (release.restockFee) {
          result.totalRefunded -= release.restockFee;
          console.log(`  ↩ Restocking fee applied: €$${release.restockFee}`);
        }
      }
    });
    
    console.log(`✓ Step 1 complete. Reservation: ${reservation.reservationId}`);
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: Schedule ripperdoc appointment
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n▶ STEP 2: Scheduling ripperdoc appointment...');
    
    const appointment = await scheduleRipperdocAppointment(request, reservation);
    result.appointmentScheduled = appointment;
    result.totalCost += appointment.depositPaid;
    
    // Register compensation: Cancel the appointment
    compensations.push({
      name: 'Cancel ripperdoc appointment',
      execute: async () => {
        console.log('  ↩ Compensation: Cancelling ripperdoc appointment...');
        const cancellation = await cancelRipperdocAppointment(
          appointment.appointmentId,
          'Installation failed - neural integration unsuccessful'
        );
        if (cancellation.depositRefunded) {
          result.totalRefunded += appointment.depositPaid;
          console.log(`  ↩ Deposit refunded: €$${appointment.depositPaid}`);
        } else {
          console.log(`  ↩ Deposit forfeited: €$${appointment.depositPaid}`);
        }
      }
    });
    
    console.log(`✓ Step 2 complete. Appointment: ${appointment.appointmentId}`);
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: Process payment
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n▶ STEP 3: Processing credstick payment...');
    
    const payment = await processCredstickPayment(request, reservation, appointment);
    result.paymentProcessed = payment;
    result.totalCost = payment.amount; // This is the total
    
    // Register compensation: Refund the payment
    compensations.push({
      name: 'Refund credstick payment',
      execute: async () => {
        console.log('  ↩ Compensation: Processing refund...');
        const refund = await refundCredstickPayment(
          payment.transactionId,
          'Installation failed - neural integration unsuccessful'
        );
        result.totalRefunded += refund.refundedAmount;
        console.log(`  ↩ Refund processed: €$${refund.refundedAmount} (fee: €$${refund.refundFee})`);
      }
    });
    
    console.log(`✓ Step 3 complete. Transaction: ${payment.transactionId}`);
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4: Perform neural integration (THE DANGEROUS PART)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n▶ STEP 4: Performing neural integration...');
    console.log('  ⚠ This is where things can go wrong...');
    
    // This step has a ~25% failure rate - demonstrating saga compensations
    const integration = await performNeuralIntegration(request, appointment);
    result.neuralIntegration = integration;
    
    // No compensation needed for successful integration
    // (you can't un-install cyberware easily - it's in there now!)
    
    console.log(`✓ Step 4 complete. Integration: ${integration.integrationId}`);
    
    // ═══════════════════════════════════════════════════════════════════════
    // SUCCESS: Send confirmation
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n▶ Sending confirmation to runner...');
    
    await sendInstallationConfirmation(request, integration);
    result.runnerNotified = true;
    result.success = true;
    
    console.log('\n' + '═'.repeat(70));
    console.log('✓ SAGA COMPLETED SUCCESSFULLY');
    console.log(`  Runner: ${request.runner.handle}`);
    console.log(`  Cyberware: ${request.cyberware.name}`);
    console.log(`  Total cost: €$${result.totalCost.toFixed(2)}`);
    console.log(`  Neural capacity remaining: ${integration.newNeuralCapacity}%`);
    console.log('═'.repeat(70));
    
    return result;
    
  } catch (error) {
    // ═══════════════════════════════════════════════════════════════════════
    // FAILURE: Execute compensations in reverse order
    // ═══════════════════════════════════════════════════════════════════════
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.failureReason = errorMessage;
    result.failedAtStep = `Step ${compensations.length + 1}`;
    
    console.log('\n' + '!'.repeat(70));
    console.log('✗ SAGA FAILED - INITIATING COMPENSATION');
    console.log(`  Error: ${errorMessage}`);
    console.log(`  Failed at: ${result.failedAtStep}`);
    console.log(`  Compensations to execute: ${compensations.length}`);
    console.log('!'.repeat(70));
    
    // If we failed during neural integration, we need emergency stabilization first
    if (result.appointmentScheduled && compensations.length >= 3) {
      console.log('\n⚠ EMERGENCY: Neural integration failure detected');
      console.log('  Initiating emergency stabilization protocol...');
      
      try {
        const stabilization = await emergencyNeuralStabilization(
          request.runner.runnerId,
          request.cyberware.cyberwareId,
          result.appointmentScheduled.ripperdocName
        );
        
        result.totalCost += stabilization.emergencyCost;
        console.log(`  Emergency stabilization complete. Cost: €$${stabilization.emergencyCost}`);
        
        if (stabilization.neuralDamage > 0) {
          console.log(`  ⚠ Permanent neural damage: ${stabilization.neuralDamage}%`);
        }
      } catch (stabError) {
        console.log(`  ⚠ Emergency stabilization had complications: ${stabError}`);
      }
    }
    
    // Execute compensations in REVERSE ORDER (LIFO)
    // This is the key to the Saga pattern!
    console.log('\n▶ Executing compensation chain (LIFO order)...');
    
    for (let i = compensations.length - 1; i >= 0; i--) {
      const compensation = compensations[i];
      console.log(`\n  [${compensations.length - i}/${compensations.length}] ${compensation.name}`);
      
      try {
        await compensation.execute();
        result.compensationsExecuted.push(compensation.name);
        console.log(`  ✓ Compensation successful`);
      } catch (compError) {
        // Compensation failures are logged but don't stop the chain
        // In production, these would need manual intervention
        console.log(`  ✗ Compensation failed: ${compError}`);
        result.compensationsExecuted.push(`${compensation.name} (FAILED)`);
      }
    }
    
    // Notify runner of failure
    console.log('\n▶ Notifying runner of failure...');
    try {
      await sendInstallationFailureNotification(
        request,
        errorMessage,
        result.compensationsExecuted
      );
      result.runnerNotified = true;
    } catch (notifyError) {
      console.log(`  ⚠ Notification failed: ${notifyError}`);
    }
    
    console.log('\n' + '═'.repeat(70));
    console.log('SAGA COMPENSATION COMPLETE');
    console.log(`  Total charged: €$${result.totalCost.toFixed(2)}`);
    console.log(`  Total refunded: €$${result.totalRefunded.toFixed(2)}`);
    console.log(`  Net cost to runner: €$${(result.totalCost - result.totalRefunded).toFixed(2)}`);
    console.log(`  Compensations executed: ${result.compensationsExecuted.length}`);
    console.log('═'.repeat(70));
    
    return result;
  }
}

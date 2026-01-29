/**
 * Data Broker Scatter-Gather Workflow
 * 
 * When you need to move data through Night City's underground networks,
 * you don't just call one broker - you query them all and pick the best deal.
 * 
 * THE PATTERN: Scatter-Gather
 * 
 * SCATTER: Send requests to multiple data brokers simultaneously
 * - Each broker operates independently
 * - Some may be offline, some may refuse the job
 * - All requests happen in PARALLEL for speed
 * 
 * GATHER: Collect and analyze all responses
 * - Filter out null responses (brokers who didn't bite)
 * - Find the best option by different criteria:
 *   - Lowest price (for the budget runner)
 *   - Fastest delivery (when time is chrome)
 *   - Highest success rate (when failure isn't an option)
 *   - Best overall (balanced recommendation)
 * 
 * This pattern is perfect for:
 * - Price comparison across vendors
 * - Redundant service queries
 * - Best-effort data collection
 * - Timeout-tolerant operations
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/data-broker-activities';
import type { DataCourierRequest, DataBrokerAggregation } from '../shared/types';

// Configure activities with short timeouts - brokers who don't respond fast
// aren't worth waiting for in Night City
const {
  getAfterlifeQuote,
  getNetWatchBlackMarketQuote,
  getArasakaServicesQuote,
  getVoodooBoysQuote,
  getMilitechQuote,
  aggregateDataBrokerQuotes
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '15 seconds',
  retry: {
    initialInterval: '500ms',
    backoffCoefficient: 2,
    maximumAttempts: 2, // Quick retry, then move on
    maximumInterval: '5 seconds'
  }
});

/**
 * Scatter-Gather workflow for querying data brokers.
 * 
 * Queries all known data brokers in parallel and aggregates results
 * to find the best deal for the runner's data courier needs.
 */
export async function dataBrokerScatterGather(
  request: DataCourierRequest
): Promise<DataBrokerAggregation> {
  console.log('═'.repeat(70));
  console.log('DATA BROKER SCATTER-GATHER');
  console.log(`Package: ${request.dataPackage.packageId}`);
  console.log(`Size: ${request.dataPackage.sizeGigabytes}GB | Encryption: ${request.dataPackage.encryptionLevel}`);
  console.log(`Type: ${request.dataPackage.dataType} | Hazard: ${request.dataPackage.hazardLevel}`);
  console.log(`Budget: €$${request.maxBudget} | Max delivery: ${request.maxDeliveryHours}h`);
  console.log('═'.repeat(70));
  
  // ═══════════════════════════════════════════════════════════════════════
  // SCATTER PHASE: Query all brokers in parallel
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n▶ SCATTER: Querying data broker network...');
  console.log('  Contacting 5 brokers simultaneously...\n');
  
  // All broker queries execute in parallel using Promise.allSettled
  // We use allSettled (not all) because we want results even if some fail
  const brokerPromises = [
    safeQuote('Afterlife', () => getAfterlifeQuote(request)),
    safeQuote('NetWatch Black Market', () => getNetWatchBlackMarketQuote(request)),
    safeQuote('Arasaka Services', () => getArasakaServicesQuote(request)),
    safeQuote('Voodoo Boys', () => getVoodooBoysQuote(request)),
    safeQuote('Militech Acquisitions', () => getMilitechQuote(request)),
  ];
  
  // Execute all queries simultaneously
  const quotes = await Promise.all(brokerPromises);
  
  // Count responses
  const responded = quotes.filter(q => q !== null).length;
  const failed = quotes.filter(q => q === null).length;
  
  console.log(`\n✓ SCATTER complete: ${responded} responded, ${failed} unavailable`);
  
  // ═══════════════════════════════════════════════════════════════════════
  // GATHER PHASE: Aggregate and analyze quotes
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n▶ GATHER: Aggregating broker responses...');
  
  const aggregation = await aggregateDataBrokerQuotes(request, quotes);
  
  // ═══════════════════════════════════════════════════════════════════════
  // RESULTS SUMMARY
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('SCATTER-GATHER COMPLETE');
  console.log('═'.repeat(70));
  
  if (aggregation.quotesReceived.length === 0) {
    console.log('\n⚠ No brokers available for this job.');
    console.log('  Try again later or adjust your requirements.');
  } else {
    console.log('\n📊 QUOTE COMPARISON:\n');
    console.log('┌─────────────────────────────┬──────────┬──────────┬─────────┬─────────┐');
    console.log('│ Broker                      │ Price    │ Delivery │ Success │ Escrow  │');
    console.log('├─────────────────────────────┼──────────┼──────────┼─────────┼─────────┤');
    
    for (const quote of aggregation.quotesReceived) {
      const name = quote.brokerName.padEnd(27);
      const price = `€$${quote.price}`.padEnd(8);
      const delivery = `${quote.deliveryTimeHours}h`.padEnd(8);
      const success = `${Math.round(quote.successProbability * 100)}%`.padEnd(7);
      const escrow = (quote.escrowRequired ? 'Yes' : 'No').padEnd(7);
      console.log(`│ ${name} │ ${price} │ ${delivery} │ ${success} │ ${escrow} │`);
    }
    
    console.log('└─────────────────────────────┴──────────┴──────────┴─────────┴─────────┘');
    
    console.log('\n🏆 RECOMMENDATIONS:');
    if (aggregation.bestPrice) {
      console.log(`  💰 Best Price: ${aggregation.bestPrice.brokerName} (€$${aggregation.bestPrice.price})`);
    }
    if (aggregation.fastestDelivery) {
      console.log(`  ⚡ Fastest: ${aggregation.fastestDelivery.brokerName} (${aggregation.fastestDelivery.deliveryTimeHours}h)`);
    }
    if (aggregation.highestSuccess) {
      console.log(`  🎯 Most Reliable: ${aggregation.highestSuccess.brokerName} (${Math.round(aggregation.highestSuccess.successProbability * 100)}%)`);
    }
    if (aggregation.recommendation) {
      console.log(`  ⭐ Overall Best: ${aggregation.recommendation.brokerName}`);
    }
  }
  
  console.log('\n' + '═'.repeat(70));
  
  return aggregation;
}

/**
 * Wrapper to safely execute a quote request.
 * Returns null if the broker doesn't respond or errors.
 */
async function safeQuote<T>(
  brokerName: string,
  quoteFn: () => Promise<T | null>
): Promise<T | null> {
  try {
    return await quoteFn();
  } catch (error) {
    console.log(`[${brokerName.toUpperCase()}] Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

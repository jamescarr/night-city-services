/**
 * Data Broker Activities - Johnny Mnemonic Style
 * 
 * In 2077, data is the most valuable commodity. Megacorps kill for it,
 * netrunners die extracting it, and data couriers risk their minds
 * smuggling it through the Net.
 * 
 * This module implements the Scatter-Gather pattern:
 * - SCATTER: Query multiple data brokers simultaneously
 * - GATHER: Aggregate quotes to find the best deal
 * 
 * Each broker operates independently with their own pricing, delivery
 * times, and success rates. Some specialize in corporate secrets,
 * others in military intel, and some don't ask questions at all.
 */

import {
  DataCourierRequest,
  DataBrokerQuote,
  DataBrokerAggregation
} from '../shared/types';

// ============================================================================
// DATA BROKER NETWORK
// ============================================================================

/**
 * Afterlife Connections
 * 
 * The legendary bar where fixers meet runners. Their data broker network
 * is extensive but expensive. They specialize in corporate extraction jobs.
 * High success rate because they only take jobs they can deliver.
 */
export async function getAfterlifeQuote(
  request: DataCourierRequest
): Promise<DataBrokerQuote | null> {
  console.log(`[AFTERLIFE] Querying for package ${request.dataPackage.packageId}...`);
  
  await simulateNetworkDelay('Afterlife', 200, 600);
  
  // Afterlife is selective - they won't touch certain jobs
  if (request.dataPackage.hazardLevel === 'lethal' && Math.random() < 0.3) {
    console.log(`[AFTERLIFE] "This one's too hot. Try the black market."`);
    return null;
  }
  
  // Afterlife has the best success rate but highest prices
  const basePrice = 5000;
  const sizeMultiplier = 1 + (request.dataPackage.sizeGigabytes / 100);
  const encryptionMultiplier = getEncryptionMultiplier(request.dataPackage.encryptionLevel);
  const hazardMultiplier = request.dataPackage.hazardLevel === 'lethal' ? 3.0 :
                           request.dataPackage.hazardLevel === 'hot' ? 1.8 : 1.0;
  
  const price = basePrice * sizeMultiplier * encryptionMultiplier * hazardMultiplier;
  
  const quote: DataBrokerQuote = {
    brokerId: 'BRK-AFTERLIFE',
    brokerName: 'Afterlife Connections',
    brokerReputation: 95,
    packageId: request.dataPackage.packageId,
    price: Math.round(price),
    deliveryTimeHours: 24 + Math.floor(Math.random() * 24), // 24-48 hours
    successProbability: 0.95, // They're the best
    escrowRequired: true,
    notes: 'Premium service. Discretion guaranteed. Payment through verified escrow only.'
  };
  
  console.log(`[AFTERLIFE] Quote: €$${quote.price}, ${quote.deliveryTimeHours}h delivery, ${Math.round(quote.successProbability * 100)}% success`);
  return quote;
}

/**
 * NetWatch Black Market
 * 
 * Ironic that the organization hunting netrunners has its own data market.
 * Actually run by rogue agents who sell confiscated data. Fast delivery
 * but they might be tracking you.
 */
export async function getNetWatchBlackMarketQuote(
  request: DataCourierRequest
): Promise<DataBrokerQuote | null> {
  console.log(`[NETWATCH BLACK MARKET] Querying for package ${request.dataPackage.packageId}...`);
  
  await simulateNetworkDelay('NetWatch', 100, 400);
  
  // 15% chance they're running a sting operation
  if (Math.random() < 0.15) {
    console.log(`[NETWATCH BLACK MARKET] Connection terminated unexpectedly. Trace detected.`);
    return null;
  }
  
  // Cheaper than Afterlife but riskier
  const basePrice = 3000;
  const sizeMultiplier = 1 + (request.dataPackage.sizeGigabytes / 150);
  const encryptionMultiplier = getEncryptionMultiplier(request.dataPackage.encryptionLevel) * 0.8;
  
  const price = basePrice * sizeMultiplier * encryptionMultiplier;
  
  // They're fast because they already have access to most networks
  const deliveryHours = 6 + Math.floor(Math.random() * 12);
  
  const quote: DataBrokerQuote = {
    brokerId: 'BRK-NETWATCH',
    brokerName: 'NetWatch Black Market',
    brokerReputation: 70,
    packageId: request.dataPackage.packageId,
    price: Math.round(price),
    deliveryTimeHours: deliveryHours,
    successProbability: 0.80, // Good but not guaranteed
    escrowRequired: false,
    notes: 'Fast delivery. No questions. Payment in crypto only. Do not contact us again after delivery.'
  };
  
  console.log(`[NETWATCH BLACK MARKET] Quote: €$${quote.price}, ${quote.deliveryTimeHours}h delivery, ${Math.round(quote.successProbability * 100)}% success`);
  return quote;
}

/**
 * Arasaka External Services
 * 
 * The megacorp's semi-legitimate data brokerage. Expensive and they
 * keep records of everything, but their success rate is unmatched
 * for corporate-level encryption. They won't touch Arasaka data though.
 */
export async function getArasakaServicesQuote(
  request: DataCourierRequest
): Promise<DataBrokerQuote | null> {
  console.log(`[ARASAKA SERVICES] Querying for package ${request.dataPackage.packageId}...`);
  
  await simulateNetworkDelay('Arasaka', 300, 800);
  
  // Won't handle blackmail or anything that could embarrass Arasaka
  if (request.dataPackage.dataType === 'blackmail') {
    console.log(`[ARASAKA SERVICES] "This request violates our terms of service. Goodbye."`);
    return null;
  }
  
  // Corporate bureaucracy means sometimes they just don't respond
  if (Math.random() < 0.1) {
    console.log(`[ARASAKA SERVICES] Request pending review. No quote available at this time.`);
    return null;
  }
  
  // Premium corporate pricing
  const basePrice = 8000;
  const sizeMultiplier = 1 + (request.dataPackage.sizeGigabytes / 50);
  const encryptionMultiplier = getEncryptionMultiplier(request.dataPackage.encryptionLevel);
  
  // Discount for lower encryption (they find it easier)
  const difficultyDiscount = request.dataPackage.encryptionLevel === 'standard' ? 0.7 :
                              request.dataPackage.encryptionLevel === 'corporate' ? 0.85 : 1.0;
  
  const price = basePrice * sizeMultiplier * encryptionMultiplier * difficultyDiscount;
  
  const quote: DataBrokerQuote = {
    brokerId: 'BRK-ARASAKA',
    brokerName: 'Arasaka External Services',
    brokerReputation: 90,
    packageId: request.dataPackage.packageId,
    price: Math.round(price),
    deliveryTimeHours: 48 + Math.floor(Math.random() * 48), // Slow but thorough
    successProbability: 0.98, // Corporate precision
    escrowRequired: true,
    notes: 'Full documentation required. Subject to Arasaka compliance review. Success guaranteed or partial refund.'
  };
  
  console.log(`[ARASAKA SERVICES] Quote: €$${quote.price}, ${quote.deliveryTimeHours}h delivery, ${Math.round(quote.successProbability * 100)}% success`);
  return quote;
}

/**
 * Voodoo Boys Data Haven
 * 
 * Haitian netrunner collective from Pacifica. They're the best at
 * handling AI constructs and military-grade encryption. Secretive
 * and unpredictable, but when they deliver, they over-deliver.
 */
export async function getVoodooBoysQuote(
  request: DataCourierRequest
): Promise<DataBrokerQuote | null> {
  console.log(`[VOODOO BOYS] Querying for package ${request.dataPackage.packageId}...`);
  
  await simulateNetworkDelay('Voodoo Boys', 400, 1000);
  
  // They only care about interesting data - AI constructs, military secrets
  if (request.dataPackage.dataType === 'corporate_secrets' && 
      request.dataPackage.encryptionLevel !== 'ai_grade') {
    console.log(`[VOODOO BOYS] "Corporate data? Not interesting. Call someone else, tourist."`);
    return null;
  }
  
  // Unpredictable availability (20% chance of being "offline")
  if (Math.random() < 0.2) {
    console.log(`[VOODOO BOYS] No response. They're deep in the Net somewhere.`);
    return null;
  }
  
  // Their pricing is... unconventional
  const basePrice = request.dataPackage.dataType === 'ai_construct' ? 2000 : 4500;
  const sizeMultiplier = 1 + (request.dataPackage.sizeGigabytes / 200); // Size matters less to them
  
  // They're actually cheaper for the hard stuff
  const encryptionMultiplier = request.dataPackage.encryptionLevel === 'ai_grade' ? 0.5 :
                                request.dataPackage.encryptionLevel === 'military' ? 0.7 :
                                getEncryptionMultiplier(request.dataPackage.encryptionLevel);
  
  const price = basePrice * sizeMultiplier * encryptionMultiplier;
  
  // Variable delivery based on their current operations
  const deliveryHours = 12 + Math.floor(Math.random() * 60);
  
  const quote: DataBrokerQuote = {
    brokerId: 'BRK-VOODOO',
    brokerName: 'Voodoo Boys Data Haven',
    brokerReputation: 85,
    packageId: request.dataPackage.packageId,
    price: Math.round(price),
    deliveryTimeHours: deliveryHours,
    successProbability: 0.88, // Good for hard targets, average otherwise
    escrowRequired: false, // They trust in their own way
    notes: 'We see through the blackwall. Your data will arrive when Papa Legba wills it. Do not contact us - we will contact you.'
  };
  
  console.log(`[VOODOO BOYS] Quote: €$${quote.price}, ${quote.deliveryTimeHours}h delivery, ${Math.round(quote.successProbability * 100)}% success`);
  return quote;
}

/**
 * Militech Acquisitions (Underground)
 * 
 * Militech's unofficial data acquisition arm. They're aggressive,
 * expensive, and don't care about collateral damage. Best for
 * time-sensitive military or weapons data.
 */
export async function getMilitechQuote(
  request: DataCourierRequest
): Promise<DataBrokerQuote | null> {
  console.log(`[MILITECH ACQ] Querying for package ${request.dataPackage.packageId}...`);
  
  await simulateNetworkDelay('Militech', 150, 500);
  
  // They're only interested in certain data types
  if (request.dataPackage.dataType === 'blackmail' || 
      request.dataPackage.dataType === 'unknown') {
    console.log(`[MILITECH ACQ] "Not our department. We deal in actionable intelligence only."`);
    return null;
  }
  
  // Premium military pricing
  const basePrice = 6000;
  const sizeMultiplier = 1 + (request.dataPackage.sizeGigabytes / 80);
  const encryptionMultiplier = getEncryptionMultiplier(request.dataPackage.encryptionLevel);
  
  // Discount for military data (that's their specialty)
  const typeMultiplier = request.dataPackage.encryptionLevel === 'military' ? 0.6 : 1.0;
  
  const price = basePrice * sizeMultiplier * encryptionMultiplier * typeMultiplier;
  
  // They're fast and aggressive
  const deliveryHours = 4 + Math.floor(Math.random() * 20);
  
  const quote: DataBrokerQuote = {
    brokerId: 'BRK-MILITECH',
    brokerName: 'Militech Acquisitions',
    brokerReputation: 82,
    packageId: request.dataPackage.packageId,
    price: Math.round(price),
    deliveryTimeHours: deliveryHours,
    successProbability: 0.85,
    escrowRequired: true,
    notes: 'Rapid acquisition guaranteed. Collateral considerations not included. Payment non-negotiable.'
  };
  
  console.log(`[MILITECH ACQ] Quote: €$${quote.price}, ${quote.deliveryTimeHours}h delivery, ${Math.round(quote.successProbability * 100)}% success`);
  return quote;
}

// ============================================================================
// AGGREGATION
// ============================================================================

/**
 * Aggregate quotes from all data brokers.
 * 
 * This is the GATHER phase of Scatter-Gather. We analyze all received
 * quotes and determine the best options based on different criteria:
 * - Best price (for budget-conscious runners)
 * - Fastest delivery (when time is critical)
 * - Highest success rate (when failure isn't an option)
 * - Overall recommendation (balanced score)
 */
export async function aggregateDataBrokerQuotes(
  request: DataCourierRequest,
  quotes: (DataBrokerQuote | null)[]
): Promise<DataBrokerAggregation> {
  console.log(`\n[AGGREGATOR] Analyzing ${quotes.length} broker responses...`);
  
  await simulateNetworkDelay('Aggregator', 50, 150);
  
  // Filter out null quotes (brokers who didn't respond)
  const validQuotes = quotes.filter((q): q is DataBrokerQuote => q !== null);
  
  console.log(`[AGGREGATOR] Received ${validQuotes.length} valid quotes`);
  
  if (validQuotes.length === 0) {
    return {
      requestId: request.requestId,
      packageId: request.dataPackage.packageId,
      quotesReceived: [],
      analysisNotes: 'No brokers available for this job. Try again later or find a local fixer.'
    };
  }
  
  // Find best in each category
  const bestPrice = validQuotes.reduce((best, current) => 
    current.price < best.price ? current : best
  );
  
  const fastestDelivery = validQuotes.reduce((best, current) =>
    current.deliveryTimeHours < best.deliveryTimeHours ? current : best
  );
  
  const highestSuccess = validQuotes.reduce((best, current) =>
    current.successProbability > best.successProbability ? current : best
  );
  
  // Calculate recommendation score for each quote
  // Score = (1/price_normalized + success_probability + 1/delivery_normalized) / 3
  const maxPrice = Math.max(...validQuotes.map(q => q.price));
  const maxDelivery = Math.max(...validQuotes.map(q => q.deliveryTimeHours));
  
  const scoredQuotes = validQuotes.map(q => ({
    quote: q,
    score: (
      (1 - q.price / maxPrice) * 0.3 +
      q.successProbability * 0.4 +
      (1 - q.deliveryTimeHours / maxDelivery) * 0.3
    )
  }));
  
  const recommendation = scoredQuotes.reduce((best, current) =>
    current.score > best.score ? current : best
  ).quote;
  
  // Check against user constraints
  const withinBudget = validQuotes.filter(q => q.price <= request.maxBudget);
  const withinTimeframe = validQuotes.filter(q => q.deliveryTimeHours <= request.maxDeliveryHours);
  const validOptions = validQuotes.filter(q => 
    q.price <= request.maxBudget && q.deliveryTimeHours <= request.maxDeliveryHours
  );
  
  let analysisNotes = `Analysis complete. ${validQuotes.length} quotes received.\n`;
  analysisNotes += `- Best price: ${bestPrice.brokerName} at €$${bestPrice.price}\n`;
  analysisNotes += `- Fastest: ${fastestDelivery.brokerName} at ${fastestDelivery.deliveryTimeHours}h\n`;
  analysisNotes += `- Most reliable: ${highestSuccess.brokerName} at ${Math.round(highestSuccess.successProbability * 100)}%\n`;
  analysisNotes += `- Recommendation: ${recommendation.brokerName}\n`;
  
  if (withinBudget.length === 0) {
    analysisNotes += `⚠ WARNING: No quotes within your €$${request.maxBudget} budget.\n`;
  }
  if (withinTimeframe.length === 0) {
    analysisNotes += `⚠ WARNING: No quotes can deliver within ${request.maxDeliveryHours}h.\n`;
  }
  if (validOptions.length > 0) {
    analysisNotes += `✓ ${validOptions.length} option(s) meet all your requirements.`;
  }
  
  console.log(`[AGGREGATOR] Best price: ${bestPrice.brokerName} (€$${bestPrice.price})`);
  console.log(`[AGGREGATOR] Fastest: ${fastestDelivery.brokerName} (${fastestDelivery.deliveryTimeHours}h)`);
  console.log(`[AGGREGATOR] Most reliable: ${highestSuccess.brokerName} (${Math.round(highestSuccess.successProbability * 100)}%)`);
  console.log(`[AGGREGATOR] Recommendation: ${recommendation.brokerName}`);
  
  return {
    requestId: request.requestId,
    packageId: request.dataPackage.packageId,
    quotesReceived: validQuotes,
    bestPrice,
    fastestDelivery,
    highestSuccess,
    recommendation,
    analysisNotes
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function simulateNetworkDelay(source: string, minMs: number, maxMs: number): Promise<void> {
  const delay = minMs + Math.floor(Math.random() * (maxMs - minMs));
  return new Promise(resolve => setTimeout(resolve, delay));
}

function getEncryptionMultiplier(level: string): number {
  switch (level) {
    case 'standard': return 1.0;
    case 'corporate': return 1.5;
    case 'military': return 2.5;
    case 'ai_grade': return 4.0;
    default: return 1.0;
  }
}

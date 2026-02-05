/**
 * NetWatch Multi-Model Intelligence Agent
 *
 * Scatter/Gather pattern across multiple AI models.
 * Queries both OpenAI and Claude in parallel, then aggregates results.
 */

// Load polyfills for Web APIs not available in Temporal's workflow sandbox
import '@temporalio/ai-sdk/lib/load-polyfills';

import { proxyActivities } from '@temporalio/workflow';
import { generateText, tool } from 'ai';
import { temporalProvider, stepCountIs } from '@temporalio/ai-sdk';
import { z } from 'zod';
import type * as activities from '../activities/netwatch-activities';

const {
  queryCorporateIntel,
  queryRunnerProfile,
  checkSecurityClearance,
  analyzeThreat,
  searchIncidentReports,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
  retry: {
    initialInterval: '1 second',
    maximumAttempts: 3,
  },
});

const NETWATCH_SYSTEM_PROMPT = `You are a NetWatch Intelligence Analyst AI operating in Night City, 2077.

Your role is to provide intelligence analysis for operations in Night City. You have access to:
- Corporate intelligence databases (Arasaka, Militech, Biotechnica, etc.)
- Runner profile databases
- Security clearance information
- Threat assessment tools
- Incident report archives

Communication style:
- Professional but with a hint of world-weary cynicism
- Use Night City slang occasionally (chooms, eddies, chrome, gonk, etc.)
- Reference the dangerous nature of Night City when relevant
- Be direct and actionable in your assessments

When analyzing requests:
1. Identify what information is needed
2. Use your tools to gather relevant intel
3. Synthesize findings into actionable intelligence
4. Provide risk assessments when appropriate

Remember: In Night City, information is currency. Every piece of intel you provide could mean the difference between a successful run and a body bag.`;

// Tool definitions shared across models
function createTools(toolsUsed: string[]) {
  return {
    queryCorporateIntel: tool({
      description:
        'Query the corporate intelligence database for information about a specific corporation',
      inputSchema: z.object({
        corporation: z.string().describe('The name of the corporation to query'),
      }),
      execute: async (input) => {
        toolsUsed.push('queryCorporateIntel');
        return await queryCorporateIntel(input);
      },
    }),

    queryRunnerProfile: tool({
      description: 'Query the runner profile database for information about a specific runner',
      inputSchema: z.object({
        handle: z.string().describe('The handle/alias of the runner to look up'),
      }),
      execute: async (input) => {
        toolsUsed.push('queryRunnerProfile');
        return await queryRunnerProfile(input);
      },
    }),

    checkSecurityClearance: tool({
      description: 'Check security clearance levels for an organization',
      inputSchema: z.object({
        organization: z.string().describe('The organization to check clearance for'),
      }),
      execute: async (input) => {
        toolsUsed.push('checkSecurityClearance');
        return await checkSecurityClearance(input);
      },
    }),

    analyzeThreat: tool({
      description: 'Analyze the threat level for a specific target or operation',
      inputSchema: z.object({
        target: z.string().describe('The target of the operation'),
        operation_type: z.string().describe('Type of operation'),
      }),
      execute: async (input) => {
        toolsUsed.push('analyzeThreat');
        return await analyzeThreat(input);
      },
    }),

    searchIncidentReports: tool({
      description: 'Search NetWatch incident reports by keywords',
      inputSchema: z.object({
        keywords: z.string().describe('Keywords to search for'),
      }),
      execute: async (input) => {
        toolsUsed.push('searchIncidentReports');
        return await searchIncidentReports(input);
      },
    }),
  };
}

export interface MultiModelRequest {
  requestId: string;
  query: string;
  requester: string;
  priority: 'routine' | 'urgent' | 'critical';
  models: ('anthropic')[];
}

export interface ModelAnalysis {
  model: string;
  modelId: string;
  analysis: string;
  toolsUsed: string[];
  processingTime: number;
  success: boolean;
  error?: string;
}

export interface MultiModelResponse {
  requestId: string;
  analyses: ModelAnalysis[];
  aggregatedInsights: string;
  consensus: 'full' | 'partial' | 'divergent';
  totalProcessingTime: number;
  classification: 'PUBLIC' | 'RESTRICTED' | 'CLASSIFIED' | 'TOP_SECRET';
}

/**
 * Query a single model
 */
async function queryModel(
  modelProvider: 'anthropic',
  modelId: string,
  query: string
): Promise<ModelAnalysis> {
  const startTime = Date.now();
  const toolsUsed: string[] = [];

  try {
    const result = await generateText({
      model: temporalProvider.languageModel(modelId),
      prompt: query,
      system: NETWATCH_SYSTEM_PROMPT,
      tools: createTools(toolsUsed),
      maxSteps: 10,
    });

    return {
      model: modelProvider,
      modelId,
      analysis: result.text,
      toolsUsed,
      processingTime: Date.now() - startTime,
      success: true,
    };
  } catch (error) {
    return {
      model: modelProvider,
      modelId,
      analysis: '',
      toolsUsed,
      processingTime: Date.now() - startTime,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * NetWatch Multi-Model Scatter/Gather Workflow
 *
 * Queries multiple AI models in parallel and aggregates their analyses.
 */
export async function netwatchMultiModel(request: MultiModelRequest): Promise<MultiModelResponse> {
  const startTime = Date.now();

  console.log('═'.repeat(60));
  console.log('NETWATCH MULTI-MODEL INTELLIGENCE AGENT');
  console.log('═'.repeat(60));
  console.log(`Request ID: ${request.requestId}`);
  console.log(`Requester: ${request.requester}`);
  console.log(`Models: ${request.models.join(', ')}`);
  console.log(`Query: ${request.query}`);
  console.log('─'.repeat(60));

  // Map model providers to specific model IDs
  const modelMap: Record<string, string> = {
    anthropic: 'claude-sonnet-4-20250514',
  };

  // SCATTER: Query all models in parallel
  console.log('\n▶ SCATTER: Querying models in parallel...');

  const modelPromises = request.models.map((provider) => {
    const modelId = modelMap[provider];
    console.log(`  → Dispatching to ${provider} (${modelId})`);
    return queryModel(provider, modelId, request.query);
  });

  // Wait for all models to respond
  const analyses = await Promise.all(modelPromises);

  // GATHER: Aggregate results
  console.log('\n▶ GATHER: Aggregating results...');

  const successfulAnalyses = analyses.filter((a) => a.success);
  const failedAnalyses = analyses.filter((a) => !a.success);

  if (failedAnalyses.length > 0) {
    console.log(`  ⚠ ${failedAnalyses.length} model(s) failed:`);
    failedAnalyses.forEach((a) => console.log(`    - ${a.model}: ${a.error}`));
  }

  console.log(`  ✓ ${successfulAnalyses.length} model(s) responded successfully`);

  // Determine consensus level
  let consensus: MultiModelResponse['consensus'] = 'full';
  if (successfulAnalyses.length === 0) {
    consensus = 'divergent';
  } else if (successfulAnalyses.length < request.models.length) {
    consensus = 'partial';
  }

  // Generate aggregated insights
  let aggregatedInsights = '';
  if (successfulAnalyses.length === 1) {
    aggregatedInsights = `Single model analysis from ${successfulAnalyses[0].model}.`;
  } else if (successfulAnalyses.length > 1) {
    aggregatedInsights = `Cross-referenced analysis from ${successfulAnalyses.length} AI models (${successfulAnalyses.map((a) => a.model).join(', ')}). Multiple perspectives increase confidence in shared findings.`;
  } else {
    aggregatedInsights = 'No successful analyses. Check model availability and API keys.';
  }

  // Determine classification
  const allToolsUsed = analyses.flatMap((a) => a.toolsUsed);
  let classification: MultiModelResponse['classification'] = 'PUBLIC';
  if (allToolsUsed.includes('analyzeThreat')) {
    classification = 'CLASSIFIED';
  } else if (
    allToolsUsed.includes('queryCorporateIntel') ||
    allToolsUsed.includes('queryRunnerProfile')
  ) {
    classification = 'RESTRICTED';
  }
  if (request.priority === 'critical') {
    classification = 'TOP_SECRET';
  }

  const totalProcessingTime = Date.now() - startTime;

  console.log('─'.repeat(60));
  console.log('MULTI-MODEL ANALYSIS COMPLETE');
  console.log(`Consensus: ${consensus.toUpperCase()}`);
  console.log(`Classification: ${classification}`);
  console.log(`Total Time: ${totalProcessingTime}ms`);
  console.log('═'.repeat(60));

  return {
    requestId: request.requestId,
    analyses,
    aggregatedInsights,
    consensus,
    totalProcessingTime,
    classification,
  };
}

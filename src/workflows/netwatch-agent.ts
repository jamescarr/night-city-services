/**
 * NetWatch Intelligence Agent - Multi-Model Scatter/Gather
 *
 * Queries multiple Claude models in parallel (Haiku, Sonnet, Opus) and
 * aggregates their analyses. Demonstrates the scatter/gather pattern
 * with AI models of varying capability and cost.
 */

// Load polyfills for Web APIs not available in Temporal's workflow sandbox
import '@temporalio/ai-sdk/lib/load-polyfills';

import { proxyActivities } from '@temporalio/workflow';
import { generateText, tool, stepCountIs } from 'ai';
import { temporalProvider } from '@temporalio/ai-sdk';
import { z } from 'zod';
import type * as activities from '../activities/netwatch-activities';

const {
  queryCorporateIntel,
  queryRunnerProfile,
  checkSecurityClearance,
  analyzeThreat,
  searchIncidentReports,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '60 seconds',
  retry: {
    initialInterval: '1 second',
    maximumAttempts: 3,
  },
});

// Claude 4.5 model family - see https://docs.anthropic.com/en/docs/about-claude/models
const CLAUDE_MODELS = {
  haiku: {
    id: 'claude-haiku-4-5-20251001',
    name: 'Haiku 4.5',
    tier: 'Fastest',
    color: '#10b981', // green
  },
  sonnet: {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Sonnet 4.5',
    tier: 'Balanced',
    color: '#3b82f6', // blue
  },
  opus: {
    id: 'claude-opus-4-5-20251101',
    name: 'Opus 4.5',
    tier: 'Most Capable',
    color: '#8b5cf6', // purple
  },
} as const;

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

// Types
export interface IntelRequest {
  requestId: string;
  query: string;
  requester: string;
  priority: 'routine' | 'urgent' | 'critical';
}

export interface ModelAnalysis {
  model: keyof typeof CLAUDE_MODELS;
  modelName: string;
  modelTier: string;
  modelColor: string;
  analysis: string;
  toolsUsed: string[];
  processingTime: number;
  success: boolean;
  error?: string;
}

export interface IntelResponse {
  requestId: string;
  analyses: ModelAnalysis[];
  totalProcessingTime: number;
  classification: 'PUBLIC' | 'RESTRICTED' | 'CLASSIFIED' | 'TOP_SECRET';
}

/**
 * Create tools for AI model - each model gets its own toolsUsed array
 */
function createTools(toolsUsed: string[]) {
  return {
    queryCorporateIntel: tool({
      description: 'Query the corporate intelligence database for information about a specific corporation',
      inputSchema: z.object({
        corporation: z.string().describe('The name of the corporation to query'),
      }),
      execute: async (input) => {
        toolsUsed.push('queryCorporateIntel');
        return await queryCorporateIntel(input);
      },
    }),
    queryRunnerProfile: tool({
      description: 'Query the runner profile database for information about a specific runner/mercenary',
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

/**
 * Query a single Claude model
 */
async function queryModel(
  modelKey: keyof typeof CLAUDE_MODELS,
  query: string
): Promise<ModelAnalysis> {
  const modelConfig = CLAUDE_MODELS[modelKey];
  const startTime = Date.now();
  const toolsUsed: string[] = [];

  console.log(`  → Querying ${modelConfig.name} (${modelConfig.tier})...`);

  try {
    const result = await generateText({
      model: temporalProvider.languageModel(modelConfig.id),
      prompt: query,
      system: NETWATCH_SYSTEM_PROMPT,
      tools: createTools(toolsUsed),
      stopWhen: stepCountIs(10),
    });

    const processingTime = Date.now() - startTime;
    console.log(`  ✓ ${modelConfig.name} complete (${processingTime}ms)`);

    return {
      model: modelKey,
      modelName: modelConfig.name,
      modelTier: modelConfig.tier,
      modelColor: modelConfig.color,
      analysis: result.text,
      toolsUsed,
      processingTime,
      success: true,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.log(`  ✗ ${modelConfig.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

    return {
      model: modelKey,
      modelName: modelConfig.name,
      modelTier: modelConfig.tier,
      modelColor: modelConfig.color,
      analysis: '',
      toolsUsed,
      processingTime,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * NetWatch Intelligence Agent - Multi-Model Scatter/Gather
 *
 * Queries Haiku, Sonnet, and Opus in parallel and returns all analyses.
 */
export async function netwatchIntelAgent(request: IntelRequest): Promise<IntelResponse> {
  const startTime = Date.now();

  console.log('═'.repeat(60));
  console.log('NETWATCH MULTI-MODEL INTELLIGENCE AGENT');
  console.log('Scatter/Gather across Claude Model Family');
  console.log('═'.repeat(60));
  console.log(`Request ID: ${request.requestId}`);
  console.log(`Requester: ${request.requester}`);
  console.log(`Priority: ${request.priority.toUpperCase()}`);
  console.log(`Query: ${request.query}`);
  console.log('─'.repeat(60));

  // SCATTER: Query all three models in parallel
  console.log('\n▶ SCATTER: Dispatching to all models...');
  
  const modelPromises = [
    queryModel('haiku', request.query),
    queryModel('sonnet', request.query),
    queryModel('opus', request.query),
  ];

  // Wait for all models (don't fail if one fails)
  const analyses = await Promise.all(modelPromises);

  // GATHER: Aggregate results
  console.log('\n▶ GATHER: Aggregating results...');

  const successCount = analyses.filter((a) => a.success).length;
  const failCount = analyses.filter((a) => !a.success).length;

  console.log(`  ${successCount} succeeded, ${failCount} failed`);

  // Determine classification based on tools used across all models
  const allToolsUsed = analyses.flatMap((a) => a.toolsUsed);
  let classification: IntelResponse['classification'] = 'PUBLIC';
  if (allToolsUsed.includes('analyzeThreat')) {
    classification = 'CLASSIFIED';
  } else if (allToolsUsed.includes('queryCorporateIntel') || allToolsUsed.includes('queryRunnerProfile')) {
    classification = 'RESTRICTED';
  }
  if (request.priority === 'critical') {
    classification = 'TOP_SECRET';
  }

  const totalProcessingTime = Date.now() - startTime;

  console.log('─'.repeat(60));
  console.log('MULTI-MODEL ANALYSIS COMPLETE');
  console.log(`Classification: ${classification}`);
  console.log(`Total Time: ${totalProcessingTime}ms`);
  console.log('═'.repeat(60));

  return {
    requestId: request.requestId,
    analyses,
    totalProcessingTime,
    classification,
  };
}

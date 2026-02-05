/**
 * NetWatch Intelligence Agent
 *
 * A durable AI agent that analyzes intelligence for Night City operations.
 * Uses Temporal's AI SDK integration for reliable LLM interactions.
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

export interface IntelRequest {
  requestId: string;
  query: string;
  requester: string;
  priority: 'routine' | 'urgent' | 'critical';
}

export interface IntelResponse {
  requestId: string;
  analysis: string;
  toolsUsed: string[];
  processingTime: number;
  classification: 'PUBLIC' | 'RESTRICTED' | 'CLASSIFIED' | 'TOP_SECRET';
}

/**
 * NetWatch Intelligence Agent Workflow
 *
 * Processes intelligence requests using AI with durable execution.
 * The agent has access to various tools for gathering and analyzing intel.
 */
export async function netwatchIntelAgent(request: IntelRequest): Promise<IntelResponse> {
  const startTime = Date.now();
  const toolsUsed: string[] = [];

  console.log('═'.repeat(60));
  console.log('NETWATCH INTELLIGENCE AGENT');
  console.log('═'.repeat(60));
  console.log(`Request ID: ${request.requestId}`);
  console.log(`Requester: ${request.requester}`);
  console.log(`Priority: ${request.priority.toUpperCase()}`);
  console.log(`Query: ${request.query}`);
  console.log('─'.repeat(60));

  const result = await generateText({
    model: temporalProvider.languageModel('claude-sonnet-4-20250514'),
    prompt: request.query,
    system: NETWATCH_SYSTEM_PROMPT,
    tools: {
      queryCorporateIntel: tool({
        description:
          'Query the corporate intelligence database for information about a specific corporation (Arasaka, Militech, Biotechnica, etc.)',
        inputSchema: z.object({
          corporation: z.string().describe('The name of the corporation to query'),
        }),
        execute: async (input) => {
          toolsUsed.push('queryCorporateIntel');
          return await queryCorporateIntel(input);
        },
      }),

      queryRunnerProfile: tool({
        description:
          'Query the runner profile database for information about a specific runner/mercenary',
        inputSchema: z.object({
          handle: z.string().describe('The handle/alias of the runner to look up'),
        }),
        execute: async (input) => {
          toolsUsed.push('queryRunnerProfile');
          return await queryRunnerProfile(input);
        },
      }),

      checkSecurityClearance: tool({
        description: 'Check security clearance levels for an organization (NetWatch, NCPD, Corporate)',
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
          operation_type: z
            .string()
            .describe('Type of operation (e.g., extraction, infiltration, data theft)'),
        }),
        execute: async (input) => {
          toolsUsed.push('analyzeThreat');
          return await analyzeThreat(input);
        },
      }),

      searchIncidentReports: tool({
        description: 'Search NetWatch incident reports by keywords',
        inputSchema: z.object({
          keywords: z.string().describe('Keywords to search for in incident reports'),
        }),
        execute: async (input) => {
          toolsUsed.push('searchIncidentReports');
          return await searchIncidentReports(input);
        },
      }),
    },
    stopWhen: stepCountIs(10),
  });

  const processingTime = Date.now() - startTime;

  // Determine classification based on content and tools used
  let classification: IntelResponse['classification'] = 'PUBLIC';
  if (toolsUsed.includes('analyzeThreat')) {
    classification = 'CLASSIFIED';
  } else if (toolsUsed.includes('queryCorporateIntel') || toolsUsed.includes('queryRunnerProfile')) {
    classification = 'RESTRICTED';
  }
  if (request.priority === 'critical') {
    classification = 'TOP_SECRET';
  }

  console.log('─'.repeat(60));
  console.log('ANALYSIS COMPLETE');
  console.log(`Tools Used: ${toolsUsed.join(', ') || 'None'}`);
  console.log(`Processing Time: ${processingTime}ms`);
  console.log(`Classification: ${classification}`);
  console.log(`Steps: ${result.steps?.length || 0}`);
  console.log(`Text length: ${result.text?.length || 0}`);
  console.log('═'.repeat(60));

  // Get the full response - combine all text from steps if needed
  let fullAnalysis = result.text;
  
  // If result.text is short and we have steps, the model may have stopped after tool use
  // Log for debugging
  if (result.steps && result.steps.length > 0) {
    console.log('Step details:');
    result.steps.forEach((step: { text?: string; toolCalls?: unknown[] }, i: number) => {
      console.log(`  Step ${i + 1}: text=${step.text?.length || 0} chars, toolCalls=${step.toolCalls?.length || 0}`);
    });
  }

  return {
    requestId: request.requestId,
    analysis: fullAnalysis,
    toolsUsed,
    processingTime,
    classification,
  };
}

/**
 * NetWatch AI Agent Worker
 *
 * A Temporal worker configured with the AI SDK plugin for durable AI execution.
 * Supports multiple model providers (OpenAI, Anthropic).
 * API credentials are only needed here - clients don't need access.
 */

import { Worker, NativeConnection, bundleWorkflowCode } from '@temporalio/worker';
import { AiSdkPlugin } from '@temporalio/ai-sdk';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import * as netwatchActivities from '../activities/netwatch-activities';
import { fileURLToPath } from 'url';
import path from 'path';
import type { ProviderV3 } from '@ai-sdk/provider';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TASK_QUEUE = 'netwatch-intel';

/**
 * Multi-provider that implements ProviderV3 interface.
 * Routes model IDs to the appropriate underlying provider.
 */
function createMultiProvider(): ProviderV3 {
  return {
    languageModel(modelId: string) {
      // Route based on model ID
      if (modelId.startsWith('claude')) {
        return anthropic.languageModel(modelId);
      }
      // Default to OpenAI for gpt models
      return openai.languageModel(modelId);
    },
    textEmbeddingModel(modelId: string) {
      // Route embedding models too
      if (modelId.includes('anthropic')) {
        // Anthropic doesn't have embeddings, fall back to OpenAI
        return openai.textEmbeddingModel('text-embedding-3-small');
      }
      return openai.textEmbeddingModel(modelId);
    },
  };
}

async function run() {
  console.log('═'.repeat(50));
  console.log('NETWATCH INTELLIGENCE SERVICE');
  console.log('Multi-Model AI Agent Worker');
  console.log('═'.repeat(50));
  console.log();

  // Check for API keys
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

  if (!hasOpenAI && !hasAnthropic) {
    console.error('ERROR: At least one API key is required');
    console.error('');
    console.error('Set one or both in your environment or .env file:');
    console.error('  export OPENAI_API_KEY=sk-...');
    console.error('  export ANTHROPIC_API_KEY=sk-ant-...');
    console.error('');
    console.error('API keys are only needed by the worker, not the client.');
    process.exit(1);
  }

  console.log('Model Providers:');
  console.log(`  OpenAI (GPT):  ${hasOpenAI ? '✓ Available' : '✗ Not configured'}`);
  console.log(`  Anthropic (Claude): ${hasAnthropic ? '✓ Available' : '✗ Not configured'}`);
  console.log();
  console.log(`Task Queue: ${TASK_QUEUE}`);
  console.log();

  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  console.log('Bundling workflows...');
  const workflowBundle = await bundleWorkflowCode({
    workflowsPath: path.resolve(__dirname, '../workflows/index.ts'),
  });
  console.log('Workflows bundled.\n');

  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: TASK_QUEUE,
    workflowBundle,
    activities: netwatchActivities,
    plugins: [
      new AiSdkPlugin({
        modelProvider: createMultiProvider(),
      }),
    ],
  });

  console.log('─'.repeat(50));
  console.log('Worker ready. Waiting for intelligence requests...');
  console.log('');
  console.log('Supported workflows:');
  console.log('  • netwatchIntelAgent - Single model analysis');
  console.log('  • netwatchMultiModel - Scatter/gather across models');
  console.log('─'.repeat(50));
  console.log();

  await worker.run();
}

run().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});

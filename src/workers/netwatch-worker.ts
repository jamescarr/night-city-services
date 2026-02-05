/**
 * NetWatch AI Agent Worker
 *
 * A Temporal worker configured with the AI SDK plugin for durable AI execution.
 * Uses Anthropic Claude for intelligence analysis.
 * API credentials are only needed here - clients don't need access.
 */

import { Worker, NativeConnection, bundleWorkflowCode } from '@temporalio/worker';
import { AiSdkPlugin } from '@temporalio/ai-sdk';
import { anthropic } from '@ai-sdk/anthropic';
import * as netwatchActivities from '../activities/netwatch-activities';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TASK_QUEUE = 'netwatch-intel';

async function run() {
  console.log('═'.repeat(50));
  console.log('NETWATCH INTELLIGENCE SERVICE');
  console.log('Claude AI Agent Worker');
  console.log('═'.repeat(50));
  console.log();

  // Check for Anthropic API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY is required');
    console.error('');
    console.error('Set it in your environment or .env file:');
    console.error('  export ANTHROPIC_API_KEY=sk-ant-...');
    console.error('');
    console.error('API keys are only needed by the worker, not the client.');
    process.exit(1);
  }

  console.log('Model Provider: Anthropic (Claude)');
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
        modelProvider: anthropic,
      }),
    ],
  });

  console.log('─'.repeat(50));
  console.log('Worker ready. Waiting for intelligence requests...');
  console.log('─'.repeat(50));
  console.log();

  await worker.run();
}

run().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});

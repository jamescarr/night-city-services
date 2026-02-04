/**
 * NetWatch AI Agent Worker
 *
 * A Temporal worker configured with the AI SDK plugin for durable AI execution.
 * API credentials are only needed here - clients don't need access.
 */

import { Worker, NativeConnection } from '@temporalio/worker';
import { AiSDKPlugin } from '@temporalio/ai-sdk';
import { openai } from '@ai-sdk/openai';
import * as netwatchActivities from '../activities/netwatch-activities';

const TASK_QUEUE = 'netwatch-intel';

async function run() {
  console.log('═'.repeat(50));
  console.log('NETWATCH INTELLIGENCE SERVICE');
  console.log('AI Agent Worker Online');
  console.log('═'.repeat(50));
  console.log();

  // Verify OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY environment variable is required');
    console.error('');
    console.error('Set it in your environment or .env file:');
    console.error('  export OPENAI_API_KEY=sk-...');
    console.error('');
    console.error('The API key is only needed by the worker, not the client.');
    process.exit(1);
  }

  console.log('OpenAI API key detected');
  console.log(`Task Queue: ${TASK_QUEUE}`);
  console.log();

  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: TASK_QUEUE,
    workflowsPath: require.resolve('../workflows/netwatch-agent'),
    activities: netwatchActivities,
    plugins: [
      new AiSDKPlugin({
        modelProvider: openai,
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

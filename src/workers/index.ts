/**
 * Night City Chrome & Data Services - Worker
 * 
 * This worker processes activities for all three workflow patterns.
 */

import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from '../activities';

const TASK_QUEUE = 'night-city-services';

async function run() {
  console.log('═'.repeat(50));
  console.log('NIGHT CITY CHROME & DATA SERVICES');
  console.log('Worker Online');
  console.log('═'.repeat(50));
  console.log(`\nTask Queue: ${TASK_QUEUE}`);
  console.log('\nWorkflows available:');
  console.log('  • cyberwareInstallationSaga - Saga pattern with compensations');
  console.log('  • dataBrokerScatterGather - Scatter-gather pattern');
  console.log('  • heistProcessManager - Process manager with signals\n');

  const connection = await NativeConnection.connect();
  
  const worker = await Worker.create({
    connection,
    workflowsPath: require.resolve('../workflows'),
    activities,
    taskQueue: TASK_QUEUE,
  });

  console.log('Worker ready. Waiting for tasks...\n');
  console.log('─'.repeat(50) + '\n');
  
  await worker.run();
}

run().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});

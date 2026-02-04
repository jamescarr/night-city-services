/**
 * NetWatch Intelligence Client
 *
 * CLI client for submitting intelligence requests to the NetWatch AI Agent.
 */

import { Client, Connection } from '@temporalio/client';
import { netwatchIntelAgent } from './workflows/netwatch-agent';

const TASK_QUEUE = 'netwatch-intel';

interface IntelRequest {
  requestId: string;
  query: string;
  requester: string;
  priority: 'routine' | 'urgent' | 'critical';
}

async function submitIntelRequest(client: Client, request: IntelRequest) {
  console.log('\n' + '█'.repeat(60));
  console.log('NETWATCH INTELLIGENCE REQUEST');
  console.log('█'.repeat(60));
  console.log(`Request ID: ${request.requestId}`);
  console.log(`Requester: ${request.requester}`);
  console.log(`Priority: ${request.priority.toUpperCase()}`);
  console.log(`Query: ${request.query}`);
  console.log('─'.repeat(60));
  console.log('Submitting to NetWatch AI Agent...\n');

  const handle = await client.workflow.start(netwatchIntelAgent, {
    taskQueue: TASK_QUEUE,
    workflowId: `netwatch-${request.requestId}`,
    args: [request],
  });

  console.log(`Workflow started: ${handle.workflowId}`);
  console.log('Waiting for analysis...\n');

  const result = await handle.result();

  console.log('─'.repeat(60));
  console.log('INTELLIGENCE REPORT');
  console.log('─'.repeat(60));
  console.log(`Classification: ${result.classification}`);
  console.log(`Tools Used: ${result.toolsUsed.join(', ') || 'None'}`);
  console.log(`Processing Time: ${result.processingTime}ms`);
  console.log('─'.repeat(60));
  console.log('\nANALYSIS:\n');
  console.log(result.analysis);
  console.log('\n' + '█'.repeat(60));

  return result;
}

// Sample queries for testing
const sampleQueries = [
  {
    query: 'What do we know about Arasaka? I need intel for a potential job.',
    requester: 'V',
    priority: 'urgent' as const,
  },
  {
    query: 'I need a threat assessment for an extraction operation at Biotechnica Flats.',
    requester: 'Rogue',
    priority: 'critical' as const,
  },
  {
    query: 'Search for any incidents related to the Blackwall in the past year.',
    requester: 'NetRunner-7',
    priority: 'routine' as const,
  },
  {
    query: 'Give me everything you have on the runner known as V. I need to know if they can be trusted.',
    requester: 'Anonymous Fixer',
    priority: 'urgent' as const,
  },
];

async function main() {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const client = new Client({ connection });

  // Get query from command line or use interactive mode
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Interactive mode - show sample queries
    console.log('\n' + '═'.repeat(60));
    console.log('NETWATCH INTELLIGENCE TERMINAL');
    console.log('═'.repeat(60));
    console.log('\nNo query provided. Running sample query...\n');

    // Pick a random sample query
    const sample = sampleQueries[Math.floor(Math.random() * sampleQueries.length)];

    await submitIntelRequest(client, {
      requestId: `REQ-${Date.now()}`,
      query: sample.query,
      requester: sample.requester,
      priority: sample.priority,
    });
  } else {
    // Use provided query
    const query = args.join(' ');
    await submitIntelRequest(client, {
      requestId: `REQ-${Date.now()}`,
      query,
      requester: 'CLI User',
      priority: 'routine',
    });
  }

  await connection.close();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});

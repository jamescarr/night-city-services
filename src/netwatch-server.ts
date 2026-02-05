/**
 * NetWatch Intelligence API Server
 *
 * Serves the frontend and handles API requests to the Temporal worker.
 * Note: API keys are NOT needed here - only the worker needs them.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client, Connection } from '@temporalio/client';
import { netwatchIntelAgent } from './workflows/netwatch-agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const TASK_QUEUE = 'netwatch-intel';

async function main() {
  // Connect to Temporal
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });
  const client = new Client({ connection });

  const app = express();
  app.use(cors());
  app.use(express.json());

  // Serve static frontend
  app.use(express.static(path.join(__dirname, '../frontend')));

  // Multi-model scatter/gather intelligence request
  app.post('/api/intel', async (req, res) => {
    try {
      const { query, priority = 'routine', requester = 'Anonymous' } = req.body;

      if (!query) {
        res.status(400).json({ error: 'Query is required' });
        return;
      }

      const requestId = `REQ-${Date.now()}`;

      console.log('─'.repeat(50));
      console.log(`[API] Scatter/Gather request: ${requestId}`);
      console.log(`[API] Models: Haiku 4.5, Sonnet 4.5, Opus 4.5`);
      console.log(`[API] Requester: ${requester}`);
      console.log(`[API] Query: ${query.substring(0, 80)}${query.length > 80 ? '...' : ''}`);

      const handle = await client.workflow.start(netwatchIntelAgent, {
        taskQueue: TASK_QUEUE,
        workflowId: `netwatch-${requestId}`,
        args: [{ requestId, query, requester, priority }],
      });

      console.log(`[API] Workflow: ${handle.workflowId}`);
      const result = await handle.result();
      
      const successCount = result.analyses.filter((a: { success: boolean }) => a.success).length;
      console.log(`[API] Complete: ${successCount}/3 models succeeded, ${result.totalProcessingTime}ms`);
      console.log('─'.repeat(50));

      res.json(result);
    } catch (error) {
      console.error('[API] Error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'online', service: 'NetWatch Intelligence API' });
  });

  app.listen(PORT, () => {
    console.log('═'.repeat(50));
    console.log('NETWATCH MULTI-MODEL INTELLIGENCE SERVER');
    console.log('Scatter/Gather: Haiku + Sonnet + Opus');
    console.log('═'.repeat(50));
    console.log();
    console.log(`Frontend: http://localhost:${PORT}`);
    console.log(`API:      POST /api/intel`);
    console.log();
    console.log('Make sure the NetWatch worker is running:');
    console.log('  pnpm run netwatch:worker');
    console.log('─'.repeat(50));
  });
}

main().catch((err) => {
  console.error('Server error:', err);
  process.exit(1);
});

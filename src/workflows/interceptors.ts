/**
 * Workflow interceptors for NetWatch
 * 
 * Limits AI model activity retries to 3 attempts.
 */

import type {
  WorkflowInterceptorsFactory,
  WorkflowOutboundCallsInterceptor,
  Next,
  ScheduleActivityInput,
} from '@temporalio/workflow';

class LimitAiRetriesInterceptor implements WorkflowOutboundCallsInterceptor {
  async scheduleActivity(
    input: ScheduleActivityInput,
    next: Next<WorkflowOutboundCallsInterceptor, 'scheduleActivity'>
  ): Promise<unknown> {
    // Limit retries for AI SDK activities
    if (input.activityType === 'invokeModel' || input.activityType === 'invokeEmbeddingModel') {
      const modifiedInput = {
        ...input,
        options: {
          ...input.options,
          retry: {
            ...(input.options.retry || {}),
            maximumAttempts: 3,
          },
        },
      };
      return next(modifiedInput);
    }
    return next(input);
  }
}

// Must be the default export for interceptor modules
const interceptors: WorkflowInterceptorsFactory = () => ({
  outbound: [new LimitAiRetriesInterceptor()],
});

export default interceptors;

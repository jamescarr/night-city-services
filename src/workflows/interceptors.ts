/**
 * Workflow interceptors for NetWatch
 * 
 * Limits AI model activity retries to 3 attempts.
 */

import {
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
    // Limit retries for AI SDK activities (invokeModel, invokeEmbeddingModel)
    if (input.activityType.startsWith('invoke')) {
      return next({
        ...input,
        options: {
          ...input.options,
          retry: {
            ...input.options.retry,
            maximumAttempts: 3,
          },
        },
      });
    }
    return next(input);
  }
}

export const interceptors: WorkflowInterceptorsFactory = () => ({
  outbound: [new LimitAiRetriesInterceptor()],
});

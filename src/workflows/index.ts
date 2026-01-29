/**
 * Night City Chrome & Data Services - Workflow Exports
 * 
 * Three enterprise integration patterns demonstrated through
 * the lens of Night City's underground economy.
 */

// Saga Pattern: Cyberware Installation with Compensation
export { cyberwareInstallationSaga } from './cyberware-saga';

// Scatter-Gather Pattern: Data Broker Queries
export { dataBrokerScatterGather } from './data-broker-scatter-gather';

// Process Manager Pattern: Heist Coordination
export { 
  heistProcessManager, 
  abortHeistSignal, 
  updateAlertLevelSignal,
  confirmTeamReadySignal,
  getHeistStateQuery 
} from './heist-process-manager';

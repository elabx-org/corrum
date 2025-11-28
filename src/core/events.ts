/**
 * Workflow Event System
 *
 * Emits structured JSON events (NDJSON format) to stderr for real-time progress tracking.
 * Results go to stdout, progress events go to stderr.
 */

export type WorkflowPhase =
  | 'analysis'
  | 'planning'
  | 'review'
  | 'consensus'
  | 'arbitration'
  | 'implementation'
  | 'complete';

export type EventType =
  | 'workflow_started'
  | 'workflow_complete'
  | 'workflow_error'
  | 'phase_started'
  | 'phase_complete'
  | 'analysis_complete'
  | 'expertise_matched'
  | 'proposal_created'
  | 'review_requested'
  | 'review_received'
  | 'consensus_checked'
  | 'consensus_reached'
  | 'dispute_detected'
  | 'arbiter_invoked'
  | 'arbiter_decision'
  | 'implementation_started'
  | 'implementation_complete'
  | 'human_escalation';

export interface BaseEvent {
  event: EventType;
  timestamp: string;
  phase?: WorkflowPhase;
}

export interface WorkflowStartedEvent extends BaseEvent {
  event: 'workflow_started';
  task: string;
  phase: 'analysis';
}

export interface WorkflowCompleteEvent extends BaseEvent {
  event: 'workflow_complete';
  status: 'approved' | 'rejected' | 'escalated' | 'implemented';
  proposalId: string;
  phase: 'complete';
}

export interface WorkflowErrorEvent extends BaseEvent {
  event: 'workflow_error';
  error: string;
  phase: WorkflowPhase;
}

export interface PhaseStartedEvent extends BaseEvent {
  event: 'phase_started';
  phase: WorkflowPhase;
  details?: Record<string, unknown>;
}

export interface PhaseCompleteEvent extends BaseEvent {
  event: 'phase_complete';
  phase: WorkflowPhase;
  details?: Record<string, unknown>;
}

export interface AnalysisCompleteEvent extends BaseEvent {
  event: 'analysis_complete';
  phase: 'analysis';
  requiresReview: boolean;
  expertise: string;
  triggers: string[];
  consensusMode: 'majority' | 'unanimous';
}

export interface ExpertiseMatchedEvent extends BaseEvent {
  event: 'expertise_matched';
  phase: 'analysis';
  expertise: string;
  score: number;
  promptFocus: string;
}

export interface ProposalCreatedEvent extends BaseEvent {
  event: 'proposal_created';
  phase: 'planning';
  proposalId: string;
  title: string;
  planner: string;
}

export interface ReviewRequestedEvent extends BaseEvent {
  event: 'review_requested';
  phase: 'review';
  agent: string;
  current: number;
  total: number;
}

export interface ReviewReceivedEvent extends BaseEvent {
  event: 'review_received';
  phase: 'review';
  agent: string;
  vote: 'APPROVE' | 'REJECT' | 'REVISE';
  current: number;
  total: number;
}

export interface ConsensusCheckedEvent extends BaseEvent {
  event: 'consensus_checked';
  phase: 'consensus';
  votes: Array<{ agent: string; vote: string }>;
  mode: 'majority' | 'unanimous';
}

export interface ConsensusReachedEvent extends BaseEvent {
  event: 'consensus_reached';
  phase: 'consensus';
  outcome: 'approved' | 'rejected' | 'revision' | 'disputed';
  mode: 'majority' | 'unanimous';
}

export interface DisputeDetectedEvent extends BaseEvent {
  event: 'dispute_detected';
  phase: 'arbitration';
  votes: Array<{ agent: string; vote: string }>;
}

export interface ArbiterInvokedEvent extends BaseEvent {
  event: 'arbiter_invoked';
  phase: 'arbitration';
  arbiter: string;
}

export interface ArbiterDecisionEvent extends BaseEvent {
  event: 'arbiter_decision';
  phase: 'arbitration';
  arbiter: string;
  decision: 'APPROVE' | 'REJECT';
}

export interface ImplementationStartedEvent extends BaseEvent {
  event: 'implementation_started';
  phase: 'implementation';
  proposalId: string;
}

export interface ImplementationCompleteEvent extends BaseEvent {
  event: 'implementation_complete';
  phase: 'implementation';
  proposalId: string;
}

export interface HumanEscalationEvent extends BaseEvent {
  event: 'human_escalation';
  phase: WorkflowPhase;
  reason: string;
  proposalId: string;
}

export type WorkflowEvent =
  | WorkflowStartedEvent
  | WorkflowCompleteEvent
  | WorkflowErrorEvent
  | PhaseStartedEvent
  | PhaseCompleteEvent
  | AnalysisCompleteEvent
  | ExpertiseMatchedEvent
  | ProposalCreatedEvent
  | ReviewRequestedEvent
  | ReviewReceivedEvent
  | ConsensusCheckedEvent
  | ConsensusReachedEvent
  | DisputeDetectedEvent
  | ArbiterInvokedEvent
  | ArbiterDecisionEvent
  | ImplementationStartedEvent
  | ImplementationCompleteEvent
  | HumanEscalationEvent;

/**
 * Event emitter class for workflow progress tracking
 */
export class WorkflowEventEmitter {
  private enabled: boolean;
  private listeners: Array<(event: WorkflowEvent) => void> = [];

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }

  /**
   * Enable or disable event emission
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Add a listener for events
   */
  addListener(listener: (event: WorkflowEvent) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove a listener
   */
  removeListener(listener: (event: WorkflowEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Emit an event to stderr (NDJSON format) and notify listeners
   */
  emit(event: Omit<WorkflowEvent, 'timestamp'>): void {
    if (!this.enabled) return;

    const fullEvent = {
      ...event,
      timestamp: new Date().toISOString()
    } as WorkflowEvent;

    // Write to stderr as NDJSON
    process.stderr.write(JSON.stringify(fullEvent) + '\n');

    // Notify listeners
    for (const listener of this.listeners) {
      listener(fullEvent);
    }
  }

  // Convenience methods for common events

  workflowStarted(task: string): void {
    this.emit({
      event: 'workflow_started',
      task,
      phase: 'analysis'
    });
  }

  workflowComplete(status: 'approved' | 'rejected' | 'escalated' | 'implemented', proposalId: string): void {
    this.emit({
      event: 'workflow_complete',
      status,
      proposalId,
      phase: 'complete'
    });
  }

  workflowError(error: string, phase: WorkflowPhase): void {
    this.emit({
      event: 'workflow_error',
      error,
      phase
    });
  }

  phaseStarted(phase: WorkflowPhase, details?: Record<string, unknown>): void {
    this.emit({
      event: 'phase_started',
      phase,
      details
    });
  }

  phaseComplete(phase: WorkflowPhase, details?: Record<string, unknown>): void {
    this.emit({
      event: 'phase_complete',
      phase,
      details
    });
  }

  analysisComplete(
    requiresReview: boolean,
    expertise: string,
    triggers: string[],
    consensusMode: 'majority' | 'unanimous'
  ): void {
    this.emit({
      event: 'analysis_complete',
      phase: 'analysis',
      requiresReview,
      expertise,
      triggers,
      consensusMode
    });
  }

  expertiseMatched(expertise: string, score: number, promptFocus: string): void {
    this.emit({
      event: 'expertise_matched',
      phase: 'analysis',
      expertise,
      score,
      promptFocus
    });
  }

  proposalCreated(proposalId: string, title: string, planner: string): void {
    this.emit({
      event: 'proposal_created',
      phase: 'planning',
      proposalId,
      title,
      planner
    });
  }

  reviewRequested(agent: string, current: number, total: number): void {
    this.emit({
      event: 'review_requested',
      phase: 'review',
      agent,
      current,
      total
    });
  }

  reviewReceived(agent: string, vote: 'APPROVE' | 'REJECT' | 'REVISE', current: number, total: number): void {
    this.emit({
      event: 'review_received',
      phase: 'review',
      agent,
      vote,
      current,
      total
    });
  }

  consensusChecked(votes: Array<{ agent: string; vote: string }>, mode: 'majority' | 'unanimous'): void {
    this.emit({
      event: 'consensus_checked',
      phase: 'consensus',
      votes,
      mode
    });
  }

  consensusReached(outcome: 'approved' | 'rejected' | 'revision' | 'disputed', mode: 'majority' | 'unanimous'): void {
    this.emit({
      event: 'consensus_reached',
      phase: 'consensus',
      outcome,
      mode
    });
  }

  disputeDetected(votes: Array<{ agent: string; vote: string }>): void {
    this.emit({
      event: 'dispute_detected',
      phase: 'arbitration',
      votes
    });
  }

  arbiterInvoked(arbiter: string): void {
    this.emit({
      event: 'arbiter_invoked',
      phase: 'arbitration',
      arbiter
    });
  }

  arbiterDecision(arbiter: string, decision: 'APPROVE' | 'REJECT'): void {
    this.emit({
      event: 'arbiter_decision',
      phase: 'arbitration',
      arbiter,
      decision
    });
  }

  implementationStarted(proposalId: string): void {
    this.emit({
      event: 'implementation_started',
      phase: 'implementation',
      proposalId
    });
  }

  implementationComplete(proposalId: string): void {
    this.emit({
      event: 'implementation_complete',
      phase: 'implementation',
      proposalId
    });
  }

  humanEscalation(reason: string, proposalId: string, phase: WorkflowPhase): void {
    this.emit({
      event: 'human_escalation',
      phase,
      reason,
      proposalId
    });
  }
}

// Global event emitter instance
export const workflowEvents = new WorkflowEventEmitter(false);

/**
 * Enable progress events globally
 */
export function enableProgressEvents(): void {
  workflowEvents.setEnabled(true);
}

/**
 * Disable progress events globally
 */
export function disableProgressEvents(): void {
  workflowEvents.setEnabled(false);
}

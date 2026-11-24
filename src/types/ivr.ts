export type IVRNodeType =
  | 'greeting'
  | 'dtmf_menu'
  | 'tts_prompt'
  | 'business_hours'
  | 'account_lookup'
  | 'queue_bridge'
  | 'voicemail'
  | 'transfer'
  | 'hangup';

export interface DTMFBranch {
  key: string; // '0'-'9', '*', '#'
  label: string;
  targetNodeId: string;
}

export interface BusinessSchedule {
  days: string; // e.g. "Mon - Fri"
  open: string; // "09:00"
  close: string; // "18:00"
}

export interface IVRNode {
  id: string;
  type: IVRNodeType;
  name: string;
  position: { x: number; y: number };
  data: {
    // Common / Greeting
    audioFile?: string;
    ttsText?: string;
    voice?: string;
    bargeIn?: boolean;

    // DTMF Menu
    timeoutSec?: number;
    maxRetries?: number;
    branches?: DTMFBranch[];
    defaultBranchNodeId?: string;

    // TTS Prompt
    templateText?: string;
    provider?: 'elevenlabs' | 'openai' | 'polly' | 'webspeech';
    cacheTtlSec?: number;

    // Business Hours
    timezone?: string;
    schedule?: BusinessSchedule[];
    openBranchNodeId?: string;
    closedBranchNodeId?: string;

    // Account / CRM Lookup
    apiEndpoint?: string;
    variableKey?: string;
    successNodeId?: string;
    fallbackNodeId?: string;

    // Queue / ARI Bridge
    queueName?: string;
    mohClass?: string; // Music on hold class
    ringStrategy?: 'ringall' | 'roundrobin' | 'leastrecent';
    maxWaitSec?: number;

    // Voicemail
    mailbox?: string;
    maxDurationSec?: number;
    transcribeEmail?: string;

    // Transfer
    destinationNumber?: string;
    callerIdMode?: 'original' | 'trunk';

    // Hangup
    reason?: string;
  };
}

export interface IVRConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  key?: string;
  label?: string;
}

export interface CallFlow {
  id: string;
  name: string;
  description: string;
  startNodeId: string;
  nodes: IVRNode[];
  connections: IVRConnection[];
  didAssigned: string;
  updatedAt: string;
}

export interface SipTrunk {
  id: string;
  name: string;
  provider: 'twilio' | 'telnyx' | 'plivo' | 'aws_chime' | 'custom';
  host: string;
  port: number;
  transport: 'udp' | 'tcp' | 'tls';
  username: string;
  secret: string;
  codecs: string[];
  status: 'registered' | 'unregistered' | 'testing';
  latencyMs: number;
  inboundContext: string;
  maxChannels: number;
}

export interface DIDNumber {
  id: string;
  number: string;
  e164: string;
  label: string;
  trunkId: string;
  assignedFlowId: string;
  activeCalls: number;
  totalCallsToday: number;
  status: 'active' | 'standby';
}

export interface AudioPrompt {
  id: string;
  title: string;
  filename: string;
  category: 'greeting' | 'menu' | 'hold' | 'announcement';
  type: 'prerecorded' | 'tts_generated';
  sampleRate: string; // e.g. "8000 Hz, 16-bit Mono PCM"
  durationSec: number;
  transcript: string;
  provider?: 'elevenlabs' | 'openai' | 'polly' | 'browser';
  voice?: string;
  updatedAt: string;
}

export interface ActiveCall {
  id: string;
  channelId: string;
  callerId: string;
  callerName: string;
  did: string;
  flowId: string;
  currentNodeId: string;
  state: 'ringing' | 'in_ivr' | 'on_hold' | 'bridged_agent' | 'completed';
  startedAt: string;
  durationSec: number;
  dtmfHistory: string[];
  currentPrompt?: string;
  agentAssigned?: string;
  queueName?: string;
}

export interface CallDetailRecord {
  id: string;
  callerId: string;
  did: string;
  flowName: string;
  startTime: string;
  durationSec: number;
  disposition: 'ANSWERED' | 'ABANDONED' | 'VOICEMAIL' | 'TRANSFERRED';
  dtmfPath: string[];
  finalDestination: string;
}

export interface QueueMetrics {
  id: string;
  name: string;
  strategy: string;
  agentsAvailable: number;
  agentsBusy: number;
  callersWaiting: number;
  avgWaitSec: number;
  abandonedRatePct: number;
}

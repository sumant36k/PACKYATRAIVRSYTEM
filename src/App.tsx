/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  INITIAL_CALL_FLOWS,
  INITIAL_SIP_TRUNKS,
  INITIAL_DIDS,
  INITIAL_AUDIO_PROMPTS,
  INITIAL_ACTIVE_CALLS,
  INITIAL_QUEUES,
  INITIAL_CDRS,
} from './data/initialData';
import { CallFlow, SipTrunk, DIDNumber, AudioPrompt, ActiveCall, QueueMetrics, CallDetailRecord } from './types/ivr';
import { FlowBuilder } from './components/flow/FlowBuilder';
import { SipTrunkManager } from './components/telephony/SipTrunkManager';
import { AudioPromptStudio } from './components/audio/AudioPromptStudio';
import { LiveCallMonitor } from './components/monitor/LiveCallMonitor';
import { CodeExportCenter } from './components/code/CodeExportCenter';
import { SoftphoneModal } from './components/softphone/SoftphoneModal';
import { LiveCarrierDispatcherModal } from './components/telephony/LiveCarrierDispatcherModal';
import {
  PhoneCall,
  GitFork,
  Radio,
  Sparkles,
  Activity,
  Code2,
  Play,
  ArrowRight,
  ShieldCheck,
  Server,
  Layers,
} from 'lucide-react';

type ActiveTab = 'flow' | 'trunks' | 'audio' | 'monitor' | 'code';

export default function App() {
  const [flows, setFlows] = useState<CallFlow[]>(INITIAL_CALL_FLOWS);
  const [selectedFlowId, setSelectedFlowId] = useState<string>(INITIAL_CALL_FLOWS[0].id);
  const [trunks, setTrunks] = useState<SipTrunk[]>(INITIAL_SIP_TRUNKS);
  const [dids, setDids] = useState<DIDNumber[]>(INITIAL_DIDS);
  const [prompts, setPrompts] = useState<AudioPrompt[]>(INITIAL_AUDIO_PROMPTS);
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>(INITIAL_ACTIVE_CALLS);
  const [queues, setQueues] = useState<QueueMetrics[]>(INITIAL_QUEUES);
  const [cdrs, setCdrs] = useState<CallDetailRecord[]>(INITIAL_CDRS);

  const [activeTab, setActiveTab] = useState<ActiveTab>('flow');
  const [isSoftphoneOpen, setIsSoftphoneOpen] = useState<boolean>(false);
  const [isCarrierDispatcherOpen, setIsCarrierDispatcherOpen] = useState<boolean>(false);
  const [carrierTargetNumber, setCarrierTargetNumber] = useState<string>('+91 9916109192');
  const [softphoneDialNumber, setSoftphoneDialNumber] = useState<string>('');
  const [softphoneCallerId, setSoftphoneCallerId] = useState<string>('+91 9916109192');
  const [softphoneRedirectTo, setSoftphoneRedirectTo] = useState<string>('+91 9916109192');
  const [traversedNodeId, setTraversedNodeId] = useState<string | null>(null);

  const currentFlow = flows.find((f) => f.id === selectedFlowId) || flows[0];

  const handleUpdateFlow = (updated: CallFlow) => {
    setFlows((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
  };

  const handleLaunchSoftphone = (
    numberOrFlowId?: string,
    options?: { callerId?: string; redirectTo?: string }
  ) => {
    if (numberOrFlowId && numberOrFlowId.startsWith('+')) {
      setSoftphoneDialNumber(numberOrFlowId);
    } else if (numberOrFlowId && numberOrFlowId.startsWith('flow-')) {
      setSelectedFlowId(numberOrFlowId);
      const match = dids.find((d) => d.assignedFlowId === numberOrFlowId);
      if (match) setSoftphoneDialNumber(match.number);
    }
    if (options?.callerId) setSoftphoneCallerId(options.callerId);
    if (options?.redirectTo) setSoftphoneRedirectTo(options.redirectTo);
    setIsSoftphoneOpen(true);
  };

  const handleTerminateCall = (channelId: string) => {
    setActiveCalls((prev) => prev.filter((c) => c.channelId !== channelId));
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (4-5 single-line Nav links) — Zone 3 (Primary Action) */}
      <header className="h-14 px-6 border-b border-slate-800 bg-slate-950 flex items-center justify-between gap-8 shrink-0 z-30 select-none">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-cyan-500/20">
            <Radio className="w-4 h-4 text-slate-950" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            Asterisk + FastAPI IVR Studio
          </span>
        </div>

        {/* Zone 2: 4-5 single-line nav links */}
        <nav className="hidden md:flex items-center gap-1 text-xs font-medium text-slate-400">
          <button
            onClick={() => setActiveTab('flow')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'flow'
                ? 'bg-slate-900 text-cyan-400 border border-slate-800 shadow-sm'
                : 'hover:text-slate-200'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Call Flow Builder</span>
          </button>

          <button
            onClick={() => setActiveTab('trunks')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'trunks'
                ? 'bg-slate-900 text-cyan-400 border border-slate-800 shadow-sm'
                : 'hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>SIP Trunks & DIDs</span>
          </button>

          <button
            onClick={() => setActiveTab('audio')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'audio'
                ? 'bg-slate-900 text-cyan-400 border border-slate-800 shadow-sm'
                : 'hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Dynamic Voice & TTS</span>
          </button>

          <button
            onClick={() => setActiveTab('monitor')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'monitor'
                ? 'bg-slate-900 text-cyan-400 border border-slate-800 shadow-sm'
                : 'hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Live Call Monitor</span>
            {activeCalls.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'code'
                ? 'bg-slate-900 text-cyan-400 border border-slate-800 shadow-sm'
                : 'hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>FastAPI & ARI Code</span>
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => handleLaunchSoftphone()}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-md shadow-emerald-500/20 transition-all whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Launch Softphone</span>
          </button>
        </div>
      </header>

      {/* Mobile Sub-Navigation Bar */}
      <div className="md:hidden flex items-center justify-between overflow-x-auto px-4 py-2 border-b border-slate-800 bg-slate-950 shrink-0 gap-2 text-xs">
        <button
          onClick={() => setActiveTab('flow')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${
            activeTab === 'flow' ? 'bg-cyan-950 text-cyan-400 font-semibold' : 'text-slate-400'
          }`}
        >
          Flow Builder
        </button>
        <button
          onClick={() => setActiveTab('trunks')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${
            activeTab === 'trunks' ? 'bg-cyan-950 text-cyan-400 font-semibold' : 'text-slate-400'
          }`}
        >
          SIP & DIDs
        </button>
        <button
          onClick={() => setActiveTab('audio')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${
            activeTab === 'audio' ? 'bg-cyan-950 text-cyan-400 font-semibold' : 'text-slate-400'
          }`}
        >
          Dynamic TTS
        </button>
        <button
          onClick={() => setActiveTab('monitor')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${
            activeTab === 'monitor' ? 'bg-cyan-950 text-cyan-400 font-semibold' : 'text-slate-400'
          }`}
        >
          Live Calls
        </button>
        <button
          onClick={() => setActiveTab('code')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${
            activeTab === 'code' ? 'bg-cyan-950 text-cyan-400 font-semibold' : 'text-slate-400'
          }`}
        >
          FastAPI Code
        </button>
      </div>

      {/* Main Viewport Content */}
      <main className="flex-1 flex overflow-hidden relative">
        {activeTab === 'flow' && (
          <FlowBuilder
            flow={currentFlow}
            allFlows={flows}
            onSelectFlow={setSelectedFlowId}
            onUpdateFlow={handleUpdateFlow}
            activeNodeId={traversedNodeId}
            onLaunchSimulator={handleLaunchSoftphone}
          />
        )}

        {activeTab === 'trunks' && (
          <SipTrunkManager
            trunks={trunks}
            dids={dids}
            flows={flows}
            onUpdateTrunks={setTrunks}
            onUpdateDids={setDids}
            onLaunchSoftphoneWithNumber={handleLaunchSoftphone}
            onOpenLiveCarrierDispatcher={(num) => {
              setCarrierTargetNumber(num);
              setIsCarrierDispatcherOpen(true);
            }}
          />
        )}

        {activeTab === 'audio' && (
          <AudioPromptStudio prompts={prompts} onUpdatePrompts={setPrompts} />
        )}

        {activeTab === 'monitor' && (
          <LiveCallMonitor
            activeCalls={activeCalls}
            queues={queues}
            cdrs={cdrs}
            onTerminateCall={handleTerminateCall}
          />
        )}

        {activeTab === 'code' && <CodeExportCenter currentFlow={currentFlow} />}
      </main>

      {/* Interactive Softphone Modal */}
      {isSoftphoneOpen && (
        <SoftphoneModal
          flows={flows}
          dids={dids}
          currentFlowId={selectedFlowId}
          initialDialNumber={softphoneDialNumber}
          initialCallerId={softphoneCallerId}
          initialRedirectTo={softphoneRedirectTo}
          onNodeTraversed={(nodeId) => setTraversedNodeId(nodeId)}
          onOpenLiveCarrierDispatcher={(num) => {
            setCarrierTargetNumber(num);
            setIsCarrierDispatcherOpen(true);
          }}
          onClose={() => {
            setIsSoftphoneOpen(false);
            setTraversedNodeId(null);
          }}
        />
      )}

      {/* Live Carrier PSTN Dispatcher Modal */}
      {isCarrierDispatcherOpen && (
        <LiveCarrierDispatcherModal
          userPhoneNumber={carrierTargetNumber}
          onClose={() => setIsCarrierDispatcherOpen(false)}
        />
      )}
    </div>
  );
}

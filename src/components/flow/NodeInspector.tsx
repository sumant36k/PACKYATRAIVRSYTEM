import React from 'react';
import { IVRNode, IVRNodeType } from '../../types/ivr';
import { Trash2, Plus, Volume2, Sparkles, Clock, Database, PhoneCall, Radio, X } from 'lucide-react';

interface NodeInspectorProps {
  node: IVRNode;
  allNodes: IVRNode[];
  onUpdate: (updated: IVRNode) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({
  node,
  allNodes,
  onUpdate,
  onDelete,
  onClose,
}) => {
  const otherNodes = allNodes.filter((n) => n.id !== node.id);

  const updateData = (fields: Partial<IVRNode['data']>) => {
    onUpdate({
      ...node,
      data: {
        ...node.data,
        ...fields,
      },
    });
  };

  const updateField = (field: keyof IVRNode, val: any) => {
    onUpdate({
      ...node,
      [field]: val,
    });
  };

  return (
    <aside className="w-80 md:w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-full overflow-hidden text-slate-200 shadow-xl shrink-0">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div>
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
            {node.type.replace('_', ' ')} node
          </span>
          <h3 className="text-sm font-semibold text-white truncate max-w-[200px]">
            {node.name}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDelete(node.id)}
            title="Delete Node"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-md transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body Form */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
        {/* Basic Info */}
        <div className="space-y-3">
          <div>
            <label className="block text-slate-400 font-medium mb-1">Node Title</label>
            <input
              type="text"
              value={node.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-medium"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-medium mb-1">Node ID (Asterisk Stasis State)</label>
            <input
              type="text"
              readOnly
              value={node.id}
              className="w-full bg-slate-950/50 border border-slate-800/80 rounded-md px-3 py-1.5 font-mono text-slate-400 text-[11px]"
            />
          </div>
        </div>

        <div className="h-px bg-slate-800" />

        {/* Greeting Node */}
        {node.type === 'greeting' && (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Audio Prompt / TTS Script</label>
              <textarea
                rows={3}
                value={node.data.ttsText || ''}
                onChange={(e) => updateData({ ttsText: e.target.value })}
                placeholder="Thank you for calling..."
                className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-white focus:outline-none focus:border-cyan-500 leading-relaxed"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Voice Persona</label>
                <select
                  value={node.data.voice || 'alloy'}
                  onChange={(e) => updateData({ voice: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="alloy">OpenAI: Alloy</option>
                  <option value="echo">OpenAI: Echo</option>
                  <option value="nova">OpenAI: Nova</option>
                  <option value="rachel">ElevenLabs: Rachel</option>
                  <option value="joanna">Polly: Joanna</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Barge-In (Interruptible)</label>
                <select
                  value={node.data.bargeIn ? 'true' : 'false'}
                  onChange={(e) => updateData({ bargeIn: e.target.value === 'true' })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="true">Allowed (Fast)</option>
                  <option value="false">Must Play Fully</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* DTMF Menu Node */}
        {node.type === 'dtmf_menu' && (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Menu Prompt Text</label>
              <textarea
                rows={3}
                value={node.data.ttsText || ''}
                onChange={(e) => updateData({ ttsText: e.target.value })}
                placeholder="For Sales press 1. For Support press 2..."
                className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Digit Timeout (sec)</label>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={node.data.timeoutSec || 7}
                  onChange={(e) => updateData({ timeoutSec: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Max Retries</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={node.data.maxRetries || 2}
                  onChange={(e) => updateData({ maxRetries: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            {/* DTMF Key Branches */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-medium">DTMF Key Branches</label>
                <button
                  type="button"
                  onClick={() => {
                    const branches = node.data.branches || [];
                    const nextKey = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '*', '#'].find(
                      (k) => !branches.some((b) => b.key === k)
                    ) || '9';
                    updateData({
                      branches: [
                        ...branches,
                        { key: nextKey, label: `Option ${nextKey}`, targetNodeId: otherNodes[0]?.id || '' },
                      ],
                    });
                  }}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Key
                </button>
              </div>

              <div className="space-y-2">
                {(node.data.branches || []).map((branch, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-950 rounded-md border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono font-bold rounded flex items-center justify-center shrink-0">
                        {branch.key}
                      </span>
                      <input
                        type="text"
                        value={branch.label}
                        onChange={(e) => {
                          const updated = [...(node.data.branches || [])];
                          updated[idx] = { ...updated[idx], label: e.target.value };
                          updateData({ branches: updated });
                        }}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs"
                        placeholder="Label"
                      />
                      <button
                        onClick={() => {
                          const updated = (node.data.branches || []).filter((_, i) => i !== idx);
                          updateData({ branches: updated });
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div>
                      <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">
                        Routes To Target Node
                      </label>
                      <select
                        value={branch.targetNodeId}
                        onChange={(e) => {
                          const updated = [...(node.data.branches || [])];
                          updated[idx] = { ...updated[idx], targetNodeId: e.target.value };
                          updateData({ branches: updated });
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs"
                      >
                        <option value="">-- Select Target --</option>
                        {otherNodes.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.name} ({n.type})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Dynamic TTS Node */}
        {node.type === 'tts_prompt' && (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">TTS Template Script</label>
              <textarea
                rows={3}
                value={node.data.templateText || ''}
                onChange={(e) => updateData({ templateText: e.target.value })}
                placeholder="Hello {{customer_name}}, your balance is {{balance}}..."
                className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-white focus:outline-none focus:border-cyan-500 font-mono text-[11px]"
              />
              <p className="text-slate-500 text-[11px] mt-1">
                Use <code className="text-cyan-400">{'{{variable_name}}'}</code> for runtime substitution from FastAPI database context.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Synthesis Provider</label>
                <select
                  value={node.data.provider || 'elevenlabs'}
                  onChange={(e) => updateData({ provider: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="elevenlabs">ElevenLabs v2</option>
                  <option value="openai">OpenAI TTS</option>
                  <option value="polly">Amazon Polly</option>
                  <option value="webspeech">Browser Speech</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Audio Cache TTL (hrs)</label>
                <input
                  type="number"
                  value={24}
                  readOnly
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-400 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Business Hours */}
        {node.type === 'business_hours' && (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-400 mb-1">PBX Operating Timezone</label>
              <select
                value={node.data.timezone || 'America/New_York'}
                onChange={(e) => updateData({ timezone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Chicago">America/Chicago (CST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-slate-300 font-medium">Schedule Rules</label>
              <div className="p-3 bg-slate-950 rounded-md border border-slate-800 space-y-1.5 text-slate-400 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span>Mon - Fri:</span>
                  <span className="text-white">08:00 - 20:00</span>
                </div>
                <div className="flex justify-between">
                  <span>Saturday:</span>
                  <span className="text-white">09:00 - 17:00</span>
                </div>
                <div className="flex justify-between">
                  <span>Sunday:</span>
                  <span className="text-rose-400">Closed</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-slate-400 mb-1">When Open, Route To</label>
                <select
                  value={node.data.openBranchNodeId || ''}
                  onChange={(e) => updateData({ openBranchNodeId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white"
                >
                  <option value="">-- Select Open Target --</option>
                  {otherNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">When Closed (After Hours)</label>
                <select
                  value={node.data.closedBranchNodeId || ''}
                  onChange={(e) => updateData({ closedBranchNodeId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white"
                >
                  <option value="">-- Select Closed Target --</option>
                  {otherNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Account / CRM Lookup */}
        {node.type === 'account_lookup' && (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">FastAPI REST / DB Route</label>
              <input
                type="text"
                value={node.data.apiEndpoint || ''}
                onChange={(e) => updateData({ apiEndpoint: e.target.value })}
                placeholder="https://api.internal/crm/v1/customer"
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-white font-mono text-[11px]"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">FastAPI State Context Variable</label>
              <input
                type="text"
                value={node.data.variableKey || ''}
                onChange={(e) => updateData({ variableKey: e.target.value })}
                placeholder="customer_balance"
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-white font-mono text-[11px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Record Found</label>
                <select
                  value={node.data.successNodeId || ''}
                  onChange={(e) => updateData({ successNodeId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white text-[11px]"
                >
                  <option value="">-- Target --</option>
                  {otherNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Lookup Failed</label>
                <select
                  value={node.data.fallbackNodeId || ''}
                  onChange={(e) => updateData({ fallbackNodeId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white text-[11px]"
                >
                  <option value="">-- Fallback --</option>
                  {otherNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Queue / ARI Bridge */}
        {node.type === 'queue_bridge' && (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Asterisk ARI Queue Target</label>
              <input
                type="text"
                value={node.data.queueName || ''}
                onChange={(e) => updateData({ queueName: e.target.value })}
                placeholder="sales_priority"
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-white font-mono text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">MOH (Music on Hold)</label>
                <select
                  value={node.data.mohClass || 'default'}
                  onChange={(e) => updateData({ mohClass: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white"
                >
                  <option value="default">Asterisk Default</option>
                  <option value="chime_ambient">Ambient Chimes</option>
                  <option value="corporate_jazz">Corporate Jazz</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Agent Ring Strategy</label>
                <select
                  value={node.data.ringStrategy || 'roundrobin'}
                  onChange={(e) => updateData({ ringStrategy: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white"
                >
                  <option value="roundrobin">Round Robin</option>
                  <option value="ringall">Ring All</option>
                  <option value="leastrecent">Least Recent</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Voicemail */}
        {node.type === 'voicemail' && (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-400 mb-1">Mailbox Context</label>
              <input
                type="text"
                value={node.data.mailbox || 'default'}
                onChange={(e) => updateData({ mailbox: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Transcription Dispatch Email</label>
              <input
                type="email"
                value={node.data.transcribeEmail || ''}
                onChange={(e) => updateData({ transcribeEmail: e.target.value })}
                placeholder="oncall@company.com"
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white"
              />
            </div>
          </div>
        )}

        {/* Transfer */}
        {node.type === 'transfer' && (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">SIP Endpoint or E.164 Dialstring</label>
              <input
                type="text"
                value={node.data.destinationNumber || ''}
                onChange={(e) => updateData({ destinationNumber: e.target.value })}
                placeholder="PJSIP/reception-101 or +14155550100"
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-white font-mono text-xs"
              />
            </div>
          </div>
        )}

        {/* Hangup */}
        {node.type === 'hangup' && (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-400 mb-1">SIP Termination Cause</label>
              <input
                type="text"
                value={node.data.reason || 'Normal Clearing (200 OK)'}
                onChange={(e) => updateData({ reason: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white font-mono"
              />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

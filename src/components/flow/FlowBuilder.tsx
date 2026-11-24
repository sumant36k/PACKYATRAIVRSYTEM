import React, { useState, useRef, useEffect } from 'react';
import { CallFlow, IVRNode, IVRNodeType, IVRConnection } from '../../types/ivr';
import { NodeInspector } from './NodeInspector';
import {
  Plus,
  Play,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Volume2,
  Radio,
  Clock,
  Database,
  Users,
  PhoneForwarded,
  Voicemail,
  PhoneOff,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Download,
  Upload,
} from 'lucide-react';

interface FlowBuilderProps {
  flow: CallFlow;
  allFlows: CallFlow[];
  onSelectFlow: (flowId: string) => void;
  onUpdateFlow: (flow: CallFlow) => void;
  activeNodeId?: string | null;
  onLaunchSimulator: (flowId: string) => void;
}

export const FlowBuilder: React.FC<FlowBuilderProps> = ({
  flow,
  allFlows,
  onSelectFlow,
  onUpdateFlow,
  activeNodeId,
  onLaunchSimulator,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync selected node with active node during test call
  useEffect(() => {
    if (activeNodeId) {
      setSelectedNodeId(activeNodeId);
    }
  }, [activeNodeId]);

  const selectedNode = flow.nodes.find((n) => n.id === selectedNodeId) || null;

  // Handle Dragging Nodes
  const handleMouseDownNode = (e: React.MouseEvent, node: IVRNode) => {
    e.stopPropagation();
    setSelectedNodeId(node.id);
    setDraggedNodeId(node.id);
    setDragOffset({
      x: e.clientX / zoom - node.position.x,
      y: e.clientY / zoom - node.position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedNodeId) {
      const newX = Math.round((e.clientX / zoom - dragOffset.x) / 10) * 10;
      const newY = Math.round((e.clientY / zoom - dragOffset.y) / 10) * 10;
      onUpdateFlow({
        ...flow,
        nodes: flow.nodes.map((n) =>
          n.id === draggedNodeId ? { ...n, position: { x: Math.max(20, newX), y: Math.max(20, newY) } } : n
        ),
      });
    } else if (isPanning) {
      setPan((prev) => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY,
      }));
    }
  };

  const handleMouseUp = () => {
    setDraggedNodeId(null);
    setIsPanning(false);
  };

  // Node Type icons and styling
  const getNodeMeta = (type: IVRNodeType) => {
    switch (type) {
      case 'greeting':
        return {
          icon: Volume2,
          color: 'text-amber-400',
          border: 'border-amber-500/30',
          bg: 'bg-amber-950/20',
          badge: 'Greeting Audio',
        };
      case 'dtmf_menu':
        return {
          icon: Radio,
          color: 'text-cyan-400',
          border: 'border-cyan-500/30',
          bg: 'bg-cyan-950/20',
          badge: 'DTMF Branch',
        };
      case 'tts_prompt':
        return {
          icon: Sparkles,
          color: 'text-purple-400',
          border: 'border-purple-500/30',
          bg: 'bg-purple-950/20',
          badge: 'Dynamic TTS',
        };
      case 'business_hours':
        return {
          icon: Clock,
          color: 'text-blue-400',
          border: 'border-blue-500/30',
          bg: 'bg-blue-950/20',
          badge: 'Schedule Filter',
        };
      case 'account_lookup':
        return {
          icon: Database,
          color: 'text-emerald-400',
          border: 'border-emerald-500/30',
          bg: 'bg-emerald-950/20',
          badge: 'FastAPI DB Query',
        };
      case 'queue_bridge':
        return {
          icon: Users,
          color: 'text-orange-400',
          border: 'border-orange-500/30',
          bg: 'bg-orange-950/20',
          badge: 'ARI Bridge / Queue',
        };
      case 'voicemail':
        return {
          icon: Voicemail,
          color: 'text-rose-400',
          border: 'border-rose-500/30',
          bg: 'bg-rose-950/20',
          badge: 'Voicemail Drop',
        };
      case 'transfer':
        return {
          icon: PhoneForwarded,
          color: 'text-sky-400',
          border: 'border-sky-500/30',
          bg: 'bg-sky-950/20',
          badge: 'SIP Transfer',
        };
      case 'hangup':
        return {
          icon: PhoneOff,
          color: 'text-slate-400',
          border: 'border-slate-700',
          bg: 'bg-slate-900/40',
          badge: 'End Call',
        };
    }
  };

  // Add new node
  const addNode = (type: IVRNodeType) => {
    const id = `node-${type}-${Date.now().toString().slice(-4)}`;
    const baseNames: Record<IVRNodeType, string> = {
      greeting: 'Voice Greeting',
      dtmf_menu: 'Keypad Menu',
      tts_prompt: 'Dynamic Speech',
      business_hours: 'Hours Validator',
      account_lookup: 'FastAPI Customer Lookup',
      queue_bridge: 'Agent Queue Bridge',
      voicemail: 'Voicemail Box',
      transfer: 'PSTN Transfer',
      hangup: 'Hangup Line',
    };

    const newNode: IVRNode = {
      id,
      type,
      name: baseNames[type],
      position: {
        x: Math.round((-pan.x + 300) / 10) * 10,
        y: Math.round((-pan.y + 200) / 10) * 10,
      },
      data: {
        ttsText: type === 'greeting' ? 'Welcome to our service.' : undefined,
        branches:
          type === 'dtmf_menu'
            ? [
                { key: '1', label: 'Option 1', targetNodeId: '' },
                { key: '2', label: 'Option 2', targetNodeId: '' },
              ]
            : undefined,
      },
    };

    onUpdateFlow({
      ...flow,
      nodes: [...flow.nodes, newNode],
    });
    setSelectedNodeId(id);
    setAddMenuOpen(false);
  };

  // Delete node
  const deleteNode = (id: string) => {
    onUpdateFlow({
      ...flow,
      nodes: flow.nodes.filter((n) => n.id !== id),
      connections: flow.connections.filter((c) => c.fromNodeId !== id && c.toNodeId !== id),
    });
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  // Update single node
  const updateNode = (updated: IVRNode) => {
    // Also sync connections if DTMF branches or explicit next targets changed
    let updatedConnections = [...flow.connections];

    if (updated.type === 'dtmf_menu' && updated.data.branches) {
      // Remove old connections from this node
      updatedConnections = updatedConnections.filter((c) => c.fromNodeId !== updated.id);
      // Re-add connections for current branches
      updated.data.branches.forEach((b) => {
        if (b.targetNodeId) {
          updatedConnections.push({
            id: `c-${updated.id}-${b.key}-${b.targetNodeId}`,
            fromNodeId: updated.id,
            toNodeId: b.targetNodeId,
            key: b.key,
            label: `Key ${b.key}`,
          });
        }
      });
    } else if (updated.type === 'business_hours') {
      updatedConnections = updatedConnections.filter((c) => c.fromNodeId !== updated.id);
      if (updated.data.openBranchNodeId) {
        updatedConnections.push({
          id: `c-${updated.id}-open`,
          fromNodeId: updated.id,
          toNodeId: updated.data.openBranchNodeId,
          label: 'Open Hours',
        });
      }
      if (updated.data.closedBranchNodeId) {
        updatedConnections.push({
          id: `c-${updated.id}-closed`,
          fromNodeId: updated.id,
          toNodeId: updated.data.closedBranchNodeId,
          label: 'After Hours',
        });
      }
    } else if (updated.type === 'account_lookup') {
      updatedConnections = updatedConnections.filter((c) => c.fromNodeId !== updated.id);
      if (updated.data.successNodeId) {
        updatedConnections.push({
          id: `c-${updated.id}-success`,
          fromNodeId: updated.id,
          toNodeId: updated.data.successNodeId,
          label: 'Record Found',
        });
      }
      if (updated.data.fallbackNodeId) {
        updatedConnections.push({
          id: `c-${updated.id}-fallback`,
          fromNodeId: updated.id,
          toNodeId: updated.data.fallbackNodeId,
          label: 'Fallback',
        });
      }
    }

    onUpdateFlow({
      ...flow,
      nodes: flow.nodes.map((n) => (n.id === updated.id ? updated : n)),
      connections: updatedConnections,
    });
  };

  // Node validation
  const validationIssues: string[] = [];
  flow.nodes.forEach((n) => {
    if (n.type === 'dtmf_menu') {
      n.data.branches?.forEach((b) => {
        if (!b.targetNodeId) {
          validationIssues.push(`Menu "${n.name}": Key ${b.key} has no destination.`);
        }
      });
    }
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Top Builder Bar */}
      <div className="h-14 px-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/60 backdrop-blur-sm z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs hidden sm:inline">Active IVR Tree:</span>
            <select
              value={flow.id}
              onChange={(e) => onSelectFlow(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1 text-white text-xs font-semibold focus:outline-none focus:border-cyan-500"
            >
              {allFlows.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded hidden sm:inline">
              DID: {flow.didAssigned}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Validation Status */}
          {validationIssues.length === 0 ? (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1 rounded-md">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Flow Valid</span>
            </div>
          ) : (
            <div
              className="hidden md:flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/40 border border-amber-800/50 px-2.5 py-1 rounded-md cursor-pointer"
              title={validationIssues.join('\n')}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{validationIssues.length} routing warning</span>
            </div>
          )}

          {/* Add Node Dropdown */}
          <div className="relative">
            <button
              onClick={() => setAddMenuOpen(!addMenuOpen)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium px-3 py-1.5 rounded-md border border-slate-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span>Add Node</span>
            </button>

            {addMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl p-1.5 z-50 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => addNode('greeting')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800 rounded flex items-center gap-2 text-slate-200"
                >
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  <span>Voice Greeting / Prompt</span>
                </button>
                <button
                  onClick={() => addNode('dtmf_menu')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800 rounded flex items-center gap-2 text-slate-200"
                >
                  <Radio className="w-4 h-4 text-cyan-400" />
                  <span>DTMF Keypad Menu (0-9)</span>
                </button>
                <button
                  onClick={() => addNode('tts_prompt')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800 rounded flex items-center gap-2 text-slate-200"
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Dynamic TTS Synthesis</span>
                </button>
                <button
                  onClick={() => addNode('business_hours')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800 rounded flex items-center gap-2 text-slate-200"
                >
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span>Business Hours Routing</span>
                </button>
                <button
                  onClick={() => addNode('account_lookup')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800 rounded flex items-center gap-2 text-slate-200"
                >
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>FastAPI / DB Account Lookup</span>
                </button>
                <button
                  onClick={() => addNode('queue_bridge')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800 rounded flex items-center gap-2 text-slate-200"
                >
                  <Users className="w-4 h-4 text-orange-400" />
                  <span>Agent ARI Bridge / Queue</span>
                </button>
                <button
                  onClick={() => addNode('voicemail')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800 rounded flex items-center gap-2 text-slate-200"
                >
                  <Voicemail className="w-4 h-4 text-rose-400" />
                  <span>Voicemail Box</span>
                </button>
                <button
                  onClick={() => addNode('transfer')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800 rounded flex items-center gap-2 text-slate-200"
                >
                  <PhoneForwarded className="w-4 h-4 text-sky-400" />
                  <span>SIP / PSTN Dialout</span>
                </button>
                <button
                  onClick={() => addNode('hangup')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800 rounded flex items-center gap-2 text-slate-200"
                >
                  <PhoneOff className="w-4 h-4 text-slate-400" />
                  <span>Hangup / Terminate</span>
                </button>
              </div>
            )}
          </div>

          {/* Test in Softphone CTA */}
          <button
            onClick={() => onLaunchSimulator(flow.id)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-semibold px-3.5 py-1.5 rounded-md shadow-sm transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Test In Softphone</span>
          </button>
        </div>
      </div>

      {/* Main Canvas + Inspector */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas viewport */}
        <div
          ref={containerRef}
          onMouseDown={(e) => {
            if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
              setIsPanning(true);
            }
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="flex-1 h-full overflow-hidden relative cursor-grab active:cursor-grabbing select-none"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(148, 163, 184, 0.12) 1px, transparent 1px)',
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        >
          {/* Zoom controls */}
          <div className="absolute bottom-5 left-5 z-20 flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-1 shadow-lg text-slate-400">
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
              className="p-1.5 hover:text-white hover:bg-slate-800 rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1.5 text-slate-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.8, z + 0.15))}
              className="p-1.5 hover:text-white hover:bg-slate-800 rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 40, y: 40 });
              }}
              className="p-1.5 hover:text-white hover:bg-slate-800 rounded"
              title="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* SVG Connection Lines */}
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{
              width: '100%',
              height: '100%',
            }}
          >
            <g
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
              }}
            >
              {flow.connections.map((conn) => {
                const fromNode = flow.nodes.find((n) => n.id === conn.fromNodeId);
                const toNode = flow.nodes.find((n) => n.id === conn.toNodeId);
                if (!fromNode || !toNode) return null;

                const nodeWidth = 240;
                const nodeHeight = 110;

                const startX = fromNode.position.x + nodeWidth;
                const startY = fromNode.position.y + nodeHeight / 2;
                const endX = toNode.position.x;
                const endY = toNode.position.y + nodeHeight / 2;

                const dx = Math.abs(endX - startX) * 0.5;
                const pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

                const isCurrentConnection =
                  activeNodeId && (fromNode.id === activeNodeId || toNode.id === activeNodeId);

                return (
                  <g key={conn.id}>
                    {/* Shadow / Glow line */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={isCurrentConnection ? '#06b6d4' : '#334155'}
                      strokeWidth={isCurrentConnection ? '3.5' : '2'}
                      strokeDasharray={conn.key ? 'none' : '4 3'}
                      className={isCurrentConnection ? 'animate-pulse' : ''}
                    />

                    {/* Connection Key Badge */}
                    {conn.label && (
                      <g transform={`translate(${(startX + endX) / 2}, ${(startY + endY) / 2})`}>
                        <rect
                          x="-32"
                          y="-10"
                          width="64"
                          height="20"
                          rx="4"
                          fill="#0f172a"
                          stroke={conn.key ? '#0284c7' : '#334155'}
                          strokeWidth="1"
                        />
                        <text
                          x="0"
                          y="4"
                          fill="#94a3b8"
                          fontSize="10"
                          fontFamily="monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {conn.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Transformed Canvas Nodes */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
            className="absolute inset-0 pointer-events-none"
          >
            {flow.nodes.map((node) => {
              const meta = getNodeMeta(node.type);
              const Icon = meta.icon;
              const isSelected = selectedNodeId === node.id;
              const isCallActive = activeNodeId === node.id;

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleMouseDownNode(e, node)}
                  style={{
                    left: `${node.position.x}px`,
                    top: `${node.position.y}px`,
                    width: '240px',
                  }}
                  className={`pointer-events-auto absolute rounded-lg border bg-slate-900/95 shadow-xl transition-all duration-150 cursor-grab active:cursor-grabbing ${
                    isCallActive
                      ? 'border-cyan-400 ring-4 ring-cyan-500/30 scale-105 z-30'
                      : isSelected
                      ? 'border-cyan-500 ring-2 ring-cyan-500/20 z-20'
                      : 'border-slate-800 hover:border-slate-700 z-10'
                  }`}
                >
                  {/* Node Header */}
                  <div
                    className={`px-3 py-2 rounded-t-lg border-b border-slate-800/80 flex items-center justify-between ${meta.bg}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${meta.color}`} />
                      <span className="text-[11px] font-mono text-slate-300 font-semibold uppercase tracking-wider">
                        {meta.badge}
                      </span>
                    </div>

                    {isCallActive && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-cyan-300 animate-pulse font-bold">
                        ACTIVE CALL
                      </span>
                    )}
                  </div>

                  {/* Node Body */}
                  <div className="p-3 space-y-2">
                    <div className="font-semibold text-xs text-white truncate">{node.name}</div>

                    {/* Summary text */}
                    {node.type === 'greeting' && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {node.data.ttsText || 'No audio prompt configured'}
                      </p>
                    )}

                    {node.type === 'dtmf_menu' && (
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-1">
                          {node.data.branches?.map((b) => (
                            <span
                              key={b.key}
                              className="text-[10px] font-mono bg-cyan-950/70 border border-cyan-800 text-cyan-300 px-1.5 py-0.5 rounded font-bold"
                            >
                              {b.key}: {b.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {node.type === 'tts_prompt' && (
                      <p className="text-[11px] text-purple-300/80 font-mono line-clamp-2">
                        {node.data.templateText || '{{dynamic_variable}}'}
                      </p>
                    )}

                    {node.type === 'business_hours' && (
                      <div className="text-[10px] font-mono text-slate-400 space-y-0.5">
                        <div>TZ: {node.data.timezone?.split('/')[1] || 'EST'}</div>
                        <div className="text-emerald-400">Mon-Fri 08:00 - 20:00</div>
                      </div>
                    )}

                    {node.type === 'account_lookup' && (
                      <div className="text-[10px] font-mono text-emerald-400 truncate">
                        API: {node.data.variableKey || 'balance'}
                      </div>
                    )}

                    {node.type === 'queue_bridge' && (
                      <div className="text-[10px] font-mono text-orange-300">
                        Queue: <span className="font-bold">{node.data.queueName || 'default'}</span>
                      </div>
                    )}

                    {node.type === 'transfer' && (
                      <div className="text-[10px] font-mono text-sky-400 truncate">
                        Dest: {node.data.destinationNumber || 'PJSIP/endpoint'}
                      </div>
                    )}

                    {node.type === 'voicemail' && (
                      <div className="text-[10px] font-mono text-rose-300">
                        Box: {node.data.mailbox || 'default'}
                      </div>
                    )}

                    {node.type === 'hangup' && (
                      <div className="text-[10px] font-mono text-slate-500">
                        Cause: {node.data.reason || 'Normal Clearing'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Node Property Inspector */}
        {selectedNode && (
          <NodeInspector
            node={selectedNode}
            allNodes={flow.nodes}
            onUpdate={updateNode}
            onDelete={deleteNode}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </div>
  );
};

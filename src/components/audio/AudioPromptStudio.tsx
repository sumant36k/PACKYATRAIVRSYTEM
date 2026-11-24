import React, { useState } from 'react';
import { AudioPrompt } from '../../types/ivr';
import { telephonyAudio } from '../../utils/audioEngine';
import {
  Volume2,
  Sparkles,
  Play,
  Square,
  Sliders,
  Upload,
  Plus,
  RefreshCw,
  CheckCircle2,
  Headphones,
  Radio,
  FileAudio,
  Trash2,
  Code2,
} from 'lucide-react';

interface AudioPromptStudioProps {
  prompts: AudioPrompt[];
  onUpdatePrompts: (prompts: AudioPrompt[]) => void;
}

export const AudioPromptStudio: React.FC<AudioPromptStudioProps> = ({
  prompts,
  onUpdatePrompts,
}) => {
  const [selectedPromptId, setSelectedPromptId] = useState<string>(prompts[0]?.id || '');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [useTelephonyFilter, setUseTelephonyFilter] = useState<boolean>(true);

  // Dynamic Variable Sandbox
  const [testVariables, setTestVariables] = useState<Record<string, string>>({
    customer_name: 'Alexander Wright',
    customer_balance: '$142.50',
    order_id: 'ORD-98214',
    eta_minutes: '12 minutes',
  });

  // Custom Prompt Creator
  const [isCreatingPrompt, setIsCreatingPrompt] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'prerecorded' | 'tts_generated'>('tts_generated');
  const [newCategory, setNewCategory] = useState<'greeting' | 'menu' | 'hold' | 'announcement'>('menu');
  const [newTranscript, setNewTranscript] = useState('');
  const [newProvider, setNewProvider] = useState<'elevenlabs' | 'openai' | 'polly' | 'browser'>('openai');
  const [newVoice, setNewVoice] = useState('alloy');

  const activePrompt = prompts.find((p) => p.id === selectedPromptId) || prompts[0];

  const handleToggleFilter = (enabled: boolean) => {
    setUseTelephonyFilter(enabled);
    telephonyAudio.setTelephonyFilter(enabled);
  };

  // Interpolate dynamic template string with variables
  const getInterpolatedTranscript = (text: string) => {
    let result = text;
    Object.entries(testVariables).forEach(([key, val]) => {
      result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), val);
    });
    return result;
  };

  const handlePlayPrompt = async (prompt: AudioPrompt) => {
    if (isPlaying) {
      telephonyAudio.stopAllAudio();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    telephonyAudio.setTelephonyFilter(useTelephonyFilter);

    if (prompt.category === 'hold') {
      const stopHold = telephonyAudio.startHoldMusic();
      setTimeout(() => {
        stopHold();
        setIsPlaying(false);
      }, 6000);
      return;
    }

    const spokenText = getInterpolatedTranscript(prompt.transcript);
    await telephonyAudio.speakTTS(spokenText, {
      voiceName: prompt.voice || 'Google US English',
    });
    setIsPlaying(false);
  };

  const handleCreatePrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newTranscript) return;

    const slug = newTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const created: AudioPrompt = {
      id: `prompt-${Date.now().toString().slice(-4)}`,
      title: newTitle,
      filename: `${slug}_8k.wav`,
      category: newCategory,
      type: newType,
      sampleRate: '8000 Hz, 16-bit Mono PCM',
      durationSec: Math.max(2, Math.round(newTranscript.length / 14)),
      transcript: newTranscript,
      provider: newType === 'tts_generated' ? newProvider : undefined,
      voice: newType === 'tts_generated' ? newVoice : undefined,
      updatedAt: '2026-11-08',
    };

    onUpdatePrompts([...prompts, created]);
    setSelectedPromptId(created.id);
    setIsCreatingPrompt(false);
    setNewTitle('');
    setNewTranscript('');
  };

  const handleDeletePrompt = (id: string) => {
    const updated = prompts.filter((p) => p.id !== id);
    onUpdatePrompts(updated);
    if (selectedPromptId === id && updated.length > 0) {
      setSelectedPromptId(updated[0].id);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Audio & Dynamic Voice Customization
            </h1>
            <span className="text-xs font-mono text-purple-400 bg-purple-950/60 border border-purple-800/60 px-2 py-0.5 rounded">
              TTS & 8kHz Mono Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Manage pre-recorded PCM audio files for Asterisk Stasis zero-latency playback, or generate
            hyper-realistic dynamic text-to-speech with runtime database variable interpolation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Telephony Acoustic Filter Switch */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-300">G.711 Telephony Filter (300-3400Hz):</span>
            <button
              onClick={() => handleToggleFilter(!useTelephonyFilter)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors ${
                useTelephonyFilter
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {useTelephonyFilter ? 'ON (PSTN/PJSIP)' : 'OFF (Hi-Fi)'}
            </button>
          </div>

          <button
            onClick={() => setIsCreatingPrompt(true)}
            className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs px-3.5 py-2 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Voice Prompt</span>
          </button>
        </div>
      </div>

      {/* Prompts List & Active Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Prompts List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 uppercase">
            <span>Sound Files & Prompts ({prompts.length})</span>
            <span className="text-slate-500">Asterisk /var/lib/sounds</span>
          </div>

          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {prompts.map((p) => {
              const isSelected = selectedPromptId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPromptId(p.id)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-900 border-cyan-500 ring-2 ring-cyan-500/20'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {p.type === 'tts_generated' ? (
                        <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      ) : (
                        <FileAudio className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      <h4 className="font-semibold text-white truncate max-w-[180px]">{p.title}</h4>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase shrink-0">
                      {p.category}
                    </span>
                  </div>

                  <p className="text-slate-400 text-[11px] mt-1.5 line-clamp-2 leading-relaxed">
                    {p.transcript}
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60 text-[10px] font-mono text-slate-500">
                    <span className="text-slate-400 truncate max-w-[140px]">{p.filename}</span>
                    <span className="text-cyan-400">{p.durationSec}s</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2 Columns: Prompt Sandbox & Live Player */}
        <div className="lg:col-span-2 space-y-5">
          {activePrompt && (
            <div className="border border-slate-800 rounded-xl bg-slate-900/90 p-5 space-y-5 shadow-xl">
              {/* Active Prompt Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                      {activePrompt.type === 'tts_generated' ? 'Dynamic Text-To-Speech' : 'PCM Audio Prompt'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {activePrompt.sampleRate}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white mt-1">{activePrompt.title}</h2>
                  <span className="text-xs font-mono text-slate-400">
                    /var/lib/asterisk/sounds/ivr/{activePrompt.filename}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeletePrompt(activePrompt.id)}
                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors"
                    title="Delete Prompt"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Waveform / Visual Player Bar */}
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handlePlayPrompt(activePrompt)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                        isPlaying
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20'
                      }`}
                    >
                      {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                    </button>
                    <div>
                      <div className="text-xs font-medium text-white">
                        {isPlaying ? 'Auditioning Voice Output...' : 'Click to Play Audio'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {useTelephonyFilter ? 'Simulating 3.4kHz Telephone Bandwidth' : 'Studio Reference Quality'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-mono text-slate-300">
                      {activePrompt.voice || 'Default Voice'}
                    </span>
                  </div>
                </div>

                {/* Animated Audio Equalizer Bars */}
                <div className="h-10 bg-slate-900 rounded flex items-center justify-between px-4 gap-1 overflow-hidden">
                  {Array.from({ length: 36 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 rounded-full transition-all duration-150 ${
                        isPlaying
                          ? 'bg-cyan-400'
                          : 'bg-slate-700'
                      }`}
                      style={{
                        height: isPlaying ? `${Math.max(15, (Math.sin(i * 0.5 + Date.now() / 200) * 0.5 + 0.5) * 32)}px` : '6px',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Dynamic Transcript & Variable Sandbox */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono uppercase text-slate-300 font-semibold">
                    Transcript & Runtime Interpolation
                  </label>
                  {activePrompt.type === 'tts_generated' && (
                    <span className="text-[11px] text-purple-400 font-mono">
                      FastAPI Dynamic Evaluator
                    </span>
                  )}
                </div>

                <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 text-sm font-mono text-slate-200 leading-relaxed">
                  {getInterpolatedTranscript(activePrompt.transcript)}
                </div>

                {/* Template Variables Sandbox */}
                <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                    <Code2 className="w-4 h-4" />
                    <span>FastAPI Context Variables (Simulate Caller Database Record)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {Object.entries(testVariables).map(([key, val]) => (
                      <div key={key}>
                        <label className="block text-slate-400 font-mono text-[11px] mb-1">
                          {`{{${key}}}`}
                        </label>
                        <input
                          type="text"
                          value={val}
                          onChange={(e) =>
                            setTestVariables((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Asterisk Audio Conversion Specs */}
              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/80 text-xs font-mono text-slate-400 flex items-center justify-between">
                <div>
                  <span className="text-slate-300 block font-semibold mb-0.5">
                    Asterisk Native Sound Format:
                  </span>
                  <span>RIFF (little-endian) data, WAVE audio, Microsoft PCM, 16 bit, mono 8000 Hz</span>
                </div>
                <code className="text-[11px] bg-slate-900 text-cyan-300 px-2.5 py-1 rounded border border-slate-800 hidden sm:block">
                  ffmpeg -i prompt.mp3 -ar 8000 -ac 1 -c:a pcm_s16le prompt_8k.wav
                </code>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Voice Prompt */}
      {isCreatingPrompt && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-semibold text-white">Create New Voice Prompt</h3>

            <form onSubmit={handleCreatePrompt} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Prompt Name</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Appointment Confirmation Greeting"
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Audio Source Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="tts_generated">Dynamic Text-to-Speech</option>
                    <option value="prerecorded">Pre-recorded WAV (8kHz PCM)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="greeting">Greeting</option>
                    <option value="menu">Menu Options</option>
                    <option value="hold">Hold Music (MOH)</option>
                    <option value="announcement">Announcement / Notice</option>
                  </select>
                </div>
              </div>

              {newType === 'tts_generated' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">TTS Provider</label>
                    <select
                      value={newProvider}
                      onChange={(e) => setNewProvider(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="openai">OpenAI TTS</option>
                      <option value="elevenlabs">ElevenLabs Multilingual</option>
                      <option value="polly">Amazon Polly</option>
                      <option value="browser">Browser SpeechSynthesis</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Voice Persona</label>
                    <select
                      value={newVoice}
                      onChange={(e) => setNewVoice(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="alloy">Alloy (Clear & Direct)</option>
                      <option value="echo">Echo (Warm)</option>
                      <option value="nova">Nova (Bright & Professional)</option>
                      <option value="rachel">Rachel (ElevenLabs)</option>
                      <option value="joanna">Joanna (Amazon Polly)</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1">
                  Prompt Transcript / Template (Supports <code className="text-cyan-400">{'{{variables}}'}</code>)
                </label>
                <textarea
                  rows={4}
                  required
                  value={newTranscript}
                  onChange={(e) => setNewTranscript(e.target.value)}
                  placeholder="Welcome {{customer_name}}, we found your order {{order_id}}..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-md p-3 text-white font-mono text-xs focus:outline-none focus:border-cyan-500 leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreatingPrompt(false)}
                  className="px-3 py-1.5 rounded text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded"
                >
                  Create Prompt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

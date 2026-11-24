import React from 'react';
import { Download, Volume2, X } from 'lucide-react';
import { ExotelCallRecord, formatCallTime, formatDuration } from '../types/exotel';

interface AudioPlayerBarProps {
  call: ExotelCallRecord | null;
  onClose: () => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({ call, onClose }) => {
  if (!call || !call.audioProxyUrl) return null;

  return (
    <div
      role="region"
      aria-label="Call recording playback"
      className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-col lg:flex-row lg:items-center gap-4"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
          <Volume2 className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-900 font-mono tabular-nums truncate">
            {call.from || 'Unknown'} &rarr; {call.to || call.phoneNumberSid}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-2 font-mono tabular-nums">
            <span>{formatCallTime(call.dateCreated)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDuration(call.duration)}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate max-w-[140px]">{call.sid.slice(0, 12)}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <audio
          key={call.sid}
          controls
          autoPlay
          preload="auto"
          src={call.audioProxyUrl}
          className="w-full h-9"
        />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <a
          href={`${call.audioProxyUrl}?download=1`}
          download={`exotel_call_${call.sid}.mp3`}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Download MP3
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close audio player"
          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

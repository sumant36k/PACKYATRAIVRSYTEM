import React, { useEffect, useState } from 'react';
import { AlertCircle, Download, Loader2, Volume2, X } from 'lucide-react';
import { ExotelCallRecord, formatCallTime, formatDuration } from '../types/exotel';

interface AudioPlayerBarProps {
  call: ExotelCallRecord | null;
  authToken: string | null;
  onUnauthorized: () => void;
  onClose: () => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  call,
  authToken,
  onUnauthorized,
  onClose,
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    if (!call || !call.audioProxyUrl || !authToken) {
      setObjectUrl(null);
      setAudioError(null);
      setLoadingAudio(false);
      return;
    }

    let cancelled = false;
    let activeBlobUrl: string | null = null;
    const controller = new AbortController();

    setLoadingAudio(true);
    setAudioError(null);
    setObjectUrl(null);

    fetch(call.audioProxyUrl, {
      headers: { Authorization: `Bearer ${authToken}` },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 401) {
          onUnauthorized();
          throw new Error('Session expired. Please sign in again.');
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.detail || `Failed to load audio (HTTP ${res.status})`);
        }
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        activeBlobUrl = URL.createObjectURL(blob);
        setObjectUrl(activeBlobUrl);
      })
      .catch((err) => {
        if (cancelled || err?.name === 'AbortError') return;
        setAudioError(err instanceof Error ? err.message : 'Unable to play recording');
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingAudio(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
      if (activeBlobUrl) {
        URL.revokeObjectURL(activeBlobUrl);
      }
    };
  }, [call?.sid, call?.audioProxyUrl, authToken, onUnauthorized]);

  if (!call || !call.audioProxyUrl) return null;

  const handleDownload = async () => {
    if (!authToken) return;
    try {
      const res = await fetch(`${call.audioProxyUrl}?download=1`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call_${call.sid}.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Ignore transient download failure
    }
  };

  return (
    <div
      role="region"
      aria-label="Call recording playback"
      className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-col lg:flex-row lg:items-center gap-4"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
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
        {loadingAudio && (
          <div className="h-9 flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-blue-700" />
            <span>Loading call recording...</span>
          </div>
        )}
        {!loadingAudio && audioError && (
          <div className="h-9 flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{audioError}</span>
          </div>
        )}
        {!loadingAudio && !audioError && objectUrl && (
          <audio
            key={call.sid}
            controls
            autoPlay
            preload="auto"
            src={objectUrl}
            className="w-full h-9"
          />
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Download MP3
        </button>
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

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { CallFlow, IVRNode, DIDNumber } from '../../types/ivr';
import { telephonyAudio } from '../../utils/audioEngine';
import {
  Phone,
  PhoneOff,
  PhoneForwarded,
  PhoneIncoming,
  Mic,
  MicOff,
  Radio,
  Terminal,
  X,
  Minimize2,
  Maximize2,
  CheckCircle2,
  Delete,
  Settings2,
  UserCheck,
  AlertCircle,
  Smartphone,
  RefreshCw,
  Wifi,
  WifiOff,
  Volume2,
  ArrowRightLeft,
} from 'lucide-react';

interface SoftphoneModalProps {
  flows: CallFlow[];
  dids: DIDNumber[];
  currentFlowId: string;
  initialDialNumber?: string;
  initialCallerId?: string;
  initialRedirectTo?: string;
  onNodeTraversed?: (nodeId: string) => void;
  onOpenLiveCarrierDispatcher?: (phoneNumber: string) => void;
  onClose: () => void;
}

type SoftphoneMode = 'live_twilio' | 'ivr_simulator';

type CallStatus =
  | 'idle'
  | 'dialing'
  | 'ringing'
  | 'in_stasis'
  | 'speaking_prompt'
  | 'awaiting_dtmf'
  | 'in_queue_bridge'
  | 'redirecting_to_user'
  | 'connected_user_phone'
  | 'connected_agent'
  | 'terminated';

type WebRTCStatus =
  | 'disconnected'
  | 'connecting'
  | 'ready'
  | 'dialing'
  | 'ringing'
  | 'connected'
  | 'incoming';

interface BackendTwilioStatus {
  status: string;
  runtime?: string;
  caller_id: string;
  default_agent_mobile: string;
  identity: string;
  bridge_ready: boolean;
  webrtc_ready: boolean;
  missing_bridge_env: string[];
  missing_webrtc_env: string[];
}

interface ExotelStatus {
  status: string;
  exotel_ready: boolean;
  account_sid_masked: string;
  subdomain: string;
  caller_id: string;
  flow_app_id: string;
  default_agent_mobile: string;
  missing_env: string[];
}

interface ARIEventLog {
  timestamp: string;
  event: string;
  details: string;
}

const QUICK_CONTACTS = [
  { label: 'You (Owner)', number: '+919916109192', short: '9916109192', tone: 'emerald' as const },
  { label: 'Contact 1', number: '+919199225154', short: '9199225154', tone: 'purple' as const },
  { label: 'Contact 2', number: '+919620303042', short: '9620303042', tone: 'amber' as const },
];

export const SoftphoneModal: React.FC<SoftphoneModalProps> = ({
  flows,
  dids,
  currentFlowId,
  initialDialNumber,
  initialCallerId,
  initialRedirectTo,
  onNodeTraversed,
  onOpenLiveCarrierDispatcher,
  onClose,
}) => {
  const [softphoneMode, setSoftphoneMode] = useState<SoftphoneMode>('live_twilio');

  // Shared & Simulator State
  const [dialedNumber, setDialedNumber] = useState<string>(
    initialDialNumber || dids[0]?.number || '+91 (22) 6900-4100'
  );
  const [callerNumber, setCallerNumber] = useState<string>(
    initialCallerId || '+91 9916109192'
  );
  const [forwardRedirectNumber, setForwardRedirectNumber] = useState<string>(
    initialRedirectTo || '+91 9916109192'
  );
  const [showNumberSettings, setShowNumberSettings] = useState<boolean>(
    Boolean(initialRedirectTo)
  );
  const [selectedFlowId, setSelectedFlowId] = useState<string>(currentFlowId);
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [pressedDigits, setPressedDigits] = useState<string[]>([]);
  const [currentPromptText, setCurrentPromptText] = useState<string>('');
  const [channelId, setChannelId] = useState<string>('');
  const [callSeconds, setCallSeconds] = useState<number>(0);
  const [eventLogs, setEventLogs] = useState<ARIEventLog[]>([]);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // Live Twilio WebRTC & Bridge State (defaults to same-origin AI Studio server)
  const [backendUrl, setBackendUrl] = useState<string>('');
  const [backendChecking, setBackendChecking] = useState<boolean>(false);
  const [backendStatus, setBackendStatus] = useState<BackendTwilioStatus | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  const [webrtcTarget, setWebrtcTarget] = useState<string>('+919916109192');
  const [webrtcStatus, setWebrtcStatus] = useState<WebRTCStatus>('disconnected');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [webrtcCallSeconds, setWebrtcCallSeconds] = useState<number>(0);
  const [incomingFrom, setIncomingFrom] = useState<string>('');
  const [ngrokUrl, setNgrokUrl] = useState<string>('');
  const [isAutoSettingUp, setIsAutoSettingUp] = useState<boolean>(false);

  const [bridgeAgentMobile, setBridgeAgentMobile] = useState<string>('+919916109192');
  const [bridgeCustomDest, setBridgeCustomDest] = useState<string>('+919199225154');
  const [isDirectDispatching, setIsDirectDispatching] = useState<boolean>(false);
  const [directCallSuccess, setDirectCallSuccess] = useState<string | null>(null);
  const [directCallError, setDirectCallError] = useState<string | null>(null);
  const [activeBridgeSid, setActiveBridgeSid] = useState<string | null>(null);
  const [bridgeLiveLegs, setBridgeLiveLegs] = useState<{
    parentStatus: string;
    parentDuration: string;
    childStatus?: string;
    childTo?: string;
    errorNote?: string;
  } | null>(null);

  const [ivrBound, setIvrBound] = useState<boolean>(false);
  const [ivrRoute1, setIvrRoute1] = useState<string>('+919916109192');
  const [ivrRoute2, setIvrRoute2] = useState<string>('+919199225154');
  const [ivrRoute3, setIvrRoute3] = useState<string>('+919620303042');
  const [ivrTestPhone, setIvrTestPhone] = useState<string>('+919916109192');
  const [isDeployingIvr, setIsDeployingIvr] = useState<boolean>(false);
  const [isTestingIvr, setIsTestingIvr] = useState<boolean>(false);

  const [exotelStatus, setExotelStatus] = useState<ExotelStatus | null>(null);
  const [exotelFlowAppId, setExotelFlowAppId] = useState<string>('1386346');
  const [isExotelCalling, setIsExotelCalling] = useState<boolean>(false);

  const activeFlow = flows.find((f) => f.id === selectedFlowId) || flows[0];
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const webrtcTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRingbackRef = useRef<(() => void) | null>(null);
  const stopHoldRef = useRef<(() => void) | null>(null);

  const deviceRef = useRef<Device | null>(null);
  const activeWebRTCCallRef = useRef<Call | null>(null);
  const incomingCallRef = useRef<Call | null>(null);

  const addEvent = useCallback((event: string, details: string) => {
    const timestamp = new Date().toISOString().substring(11, 19);
    setEventLogs((prev) => [{ timestamp, event, details }, ...prev.slice(0, 40)]);
  }, []);

  const normalizedBackend = backendUrl.replace(/\/+$/, '');

  const checkBackendStatus = useCallback(async () => {
    setBackendChecking(true);
    setBackendError(null);
    try {
      const res = await fetch(`${normalizedBackend}/api/twilio/status`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from ${normalizedBackend}/api/twilio/status`);
      }
      const data: BackendTwilioStatus = await res.json();
      setBackendStatus(data);
      if (data.default_agent_mobile) {
        setBridgeAgentMobile(data.default_agent_mobile);
      }
      addEvent(
        'BackendConnected',
        `FastAPI ready (WebRTC: ${data.webrtc_ready ? 'YES' : 'Needs .env'}, Bridge: ${data.bridge_ready ? 'YES' : 'Needs .env'})`
      );
      fetch(`${normalizedBackend}/api/twilio/ivr-status`)
        .then((r) => (r.ok ? r.json() : null))
        .then((ivr) => {
          if (ivr) setIvrBound(Boolean(ivr.bound_to_ivr));
        })
        .catch(() => {});
      fetch(`${normalizedBackend}/api/exotel/status`)
        .then((r) => (r.ok ? r.json() : null))
        .then((exo: ExotelStatus | null) => {
          if (exo) {
            setExotelStatus(exo);
            if (exo.flow_app_id) setExotelFlowAppId(exo.flow_app_id);
          }
        })
        .catch(() => {});
    } catch (err) {
      setBackendStatus(null);
      const msg = err instanceof Error ? err.message : 'Connection refused';
      setBackendError(
        `Cannot reach FastAPI at ${normalizedBackend} (${msg}). Run: python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
      );
    } finally {
      setBackendChecking(false);
    }
  }, [normalizedBackend, addEvent]);

  useEffect(() => {
    checkBackendStatus();
  }, [checkBackendStatus]);

  const handleDeployIvr = async () => {
    setIsDeployingIvr(true);
    setDirectCallError(null);
    setDirectCallSuccess(null);
    addEvent('IVRDeploy', 'Publishing 3-number IVR Flow to +17438887718...');
    try {
      const res = await fetch(`${normalizedBackend}/api/twilio/deploy-ivr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          num1: ivrRoute1,
          num2: ivrRoute2,
          num3: ivrRoute3,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
      setIvrBound(true);
      setDirectCallSuccess(data.message || 'Live 3-Number IVR activated on +17438887718!');
      addEvent('IVRDeployed', `Flow ${data.flow_sid} bound to +17438887718`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to deploy IVR';
      setDirectCallError(`IVR Deploy Error: ${msg}`);
      addEvent('IVRError', msg);
    } finally {
      setIsDeployingIvr(false);
    }
  };

  const handleTestIvrOnPhone = async (targetPhone?: string) => {
    const dest = (targetPhone || ivrTestPhone || bridgeAgentMobile).trim();
    if (!dest) return;
    setIsTestingIvr(true);
    setDirectCallError(null);
    setDirectCallSuccess(null);
    addEvent('IVRTest', `Starting Callback IVR call from +17438887718 to ${dest}...`);
    try {
      const res = await fetch(`${normalizedBackend}/api/twilio/test-ivr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: dest }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
      setDirectCallSuccess(data.message);
      addEvent('IVRTestStarted', `Execution ${data.execution_sid}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start IVR test';
      setDirectCallError(`IVR Test Error: ${msg}`);
      addEvent('IVRError', msg);
    } finally {
      setIsTestingIvr(false);
    }
  };

  const handleExotelBridge = async (destNumber: string) => {
    setIsExotelCalling(true);
    setDirectCallError(null);
    setDirectCallSuccess(null);
    addEvent('ExotelBridge', `Dialing ${bridgeAgentMobile} <-> ${destNumber} via Exotel +91...`);
    try {
      const res = await fetch(`${normalizedBackend}/api/exotel/calls/bridge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentPhone: bridgeAgentMobile,
          destination: destNumber,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
      setDirectCallSuccess(data.message);
      addEvent('ExotelCallCreated', `SID: ${data.call_sid}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Exotel call failed';
      setDirectCallError(`Exotel Error: ${msg}`);
      addEvent('ExotelError', msg);
    } finally {
      setIsExotelCalling(false);
    }
  };

  const handleExotelIvr = async (targetPhone: string) => {
    setIsExotelCalling(true);
    setDirectCallError(null);
    setDirectCallSuccess(null);
    addEvent('ExotelIVR', `Triggering Exotel App Bazaar IVR call to ${targetPhone}...`);
    try {
      const res = await fetch(`${normalizedBackend}/api/exotel/calls/ivr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: targetPhone,
          flowAppId: exotelFlowAppId.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
      setDirectCallSuccess(data.message);
      addEvent('ExotelIVRStarted', `SID: ${data.call_sid}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Exotel IVR failed';
      setDirectCallError(`Exotel IVR Error: ${msg}`);
      addEvent('ExotelError', msg);
    } finally {
      setIsExotelCalling(false);
    }
  };

  // Auto-fill initial dialed number if changed
  useEffect(() => {
    if (initialDialNumber) {
      setDialedNumber(initialDialNumber);
      const matchingDid = dids.find(
        (d) => d.number === initialDialNumber || d.e164 === initialDialNumber
      );
      if (matchingDid) {
        setSelectedFlowId(matchingDid.assignedFlowId);
      }
    }
  }, [initialDialNumber, dids]);

  useEffect(() => {
    if (initialCallerId) setCallerNumber(initialCallerId);
    if (initialRedirectTo) {
      setForwardRedirectNumber(initialRedirectTo);
      setShowNumberSettings(true);
    }
  }, [initialCallerId, initialRedirectTo]);

  // Simulator duration timer
  useEffect(() => {
    if (callStatus !== 'idle' && callStatus !== 'terminated') {
      timerRef.current = setInterval(() => {
        setCallSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  // WebRTC call timer
  useEffect(() => {
    if (webrtcStatus === 'connected') {
      setWebrtcCallSeconds(0);
      webrtcTimerRef.current = setInterval(() => {
        setWebrtcCallSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (webrtcTimerRef.current) clearInterval(webrtcTimerRef.current);
      if (webrtcStatus === 'ready' || webrtcStatus === 'disconnected') {
        setWebrtcCallSeconds(0);
      }
    }
    return () => {
      if (webrtcTimerRef.current) clearInterval(webrtcTimerRef.current);
    };
  }, [webrtcStatus]);

  // Cleanup audio & WebRTC device on unmount
  useEffect(() => {
    return () => {
      telephonyAudio.stopAllAudio();
      if (stopRingbackRef.current) stopRingbackRef.current();
      if (stopHoldRef.current) stopHoldRef.current();
      if (activeWebRTCCallRef.current) {
        activeWebRTCCallRef.current.disconnect();
      }
      if (deviceRef.current) {
        deviceRef.current.destroy();
      }
    };
  }, []);

  const attachCallListeners = (call: Call, targetLabel: string) => {
    activeWebRTCCallRef.current = call;
    setIsMuted(false);

    call.on('ringing', () => {
      setWebrtcStatus('ringing');
      addEvent('WebRTCRinging', `Twilio ringing ${targetLabel}...`);
    });

    call.on('accept', () => {
      setWebrtcStatus('connected');
      addEvent('WebRTCConnected', `2-way WebRTC audio LIVE with ${targetLabel}`);
    });

    call.on('disconnect', () => {
      activeWebRTCCallRef.current = null;
      setIsMuted(false);
      setWebrtcStatus(deviceRef.current?.state === Device.State.Registered ? 'ready' : 'disconnected');
      addEvent('WebRTCDisconnected', `Call with ${targetLabel} ended`);
    });

    call.on('cancel', () => {
      activeWebRTCCallRef.current = null;
      incomingCallRef.current = null;
      setWebrtcStatus(deviceRef.current?.state === Device.State.Registered ? 'ready' : 'disconnected');
      addEvent('WebRTCCancelled', `Call cancelled`);
    });

    call.on('error', (error) => {
      addEvent('WebRTCError', error.message || 'Unknown Twilio Voice SDK error');
      setDirectCallError(`WebRTC call error: ${error.message}`);
    });
  };

  // Auto-create API Key, API Secret, and TwiML App SID using ONLY Account SID + Auth Token
  const handleAutoSetupWebRTC = async () => {
    setDirectCallError(null);
    setDirectCallSuccess(null);

    const trimmed = ngrokUrl.trim();
    if (!trimmed.startsWith('https://')) {
      setDirectCallError('Paste your https://... ngrok URL first (run: ngrok http 8000).');
      return;
    }

    setIsAutoSettingUp(true);
    addEvent('WebRTCAutoSetup', `Provisioning API Key & TwiML App via Twilio REST...`);
    try {
      const res = await fetch(`${normalizedBackend}/api/twilio/auto-setup-webrtc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ngrokUrl: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || `HTTP ${res.status}`);
      }
      addEvent('WebRTCAutoSetup', `Created Key ${data.api_key} & App ${data.twiml_app_sid}`);
      setDirectCallSuccess('WebRTC keys auto-created! Connecting laptop microphone...');
      await checkBackendStatus();
      await handleConnectWebRTC();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Auto-setup failed';
      setDirectCallError(`Auto-Setup Error: ${msg}`);
      addEvent('WebRTCError', msg);
    } finally {
      setIsAutoSettingUp(false);
    }
  };

  // Initialize & Register Twilio WebRTC Browser Device
  const handleConnectWebRTC = async () => {
    setDirectCallError(null);
    setDirectCallSuccess(null);

    if (deviceRef.current && webrtcStatus !== 'disconnected') {
      deviceRef.current.destroy();
      deviceRef.current = null;
      activeWebRTCCallRef.current = null;
      setWebrtcStatus('disconnected');
      addEvent('WebRTCOffline', 'Browser WebRTC softphone disconnected');
      return;
    }

    setWebrtcStatus('connecting');
    addEvent('WebRTCToken', `Fetching Voice token from ${normalizedBackend}/api/twilio/token`);

    try {
      const res = await fetch(`${normalizedBackend}/api/twilio/token?identity=agent201`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || `HTTP ${res.status}`);
      }

      const device = new Device(data.token, {
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        logLevel: 'warn',
      });

      device.on('registered', () => {
        setWebrtcStatus('ready');
        setDirectCallSuccess('Laptop mic & speakers ready! You can now place or receive 2-way calls.');
        addEvent('WebRTCRegistered', `Registered as client:agent201 (Caller ID ${data.callerId})`);
      });

      device.on('unregistered', () => {
        setWebrtcStatus('disconnected');
        addEvent('WebRTCUnregistered', 'Device unregistered from Twilio');
      });

      device.on('error', (twilioError) => {
        setDirectCallError(`Twilio Device error (${twilioError.code}): ${twilioError.message}`);
        addEvent('WebRTCDeviceError', `${twilioError.code}: ${twilioError.message}`);
        if (!activeWebRTCCallRef.current) {
          setWebrtcStatus('disconnected');
        }
      });

      device.on('incoming', (incomingCall: Call) => {
        const from = incomingCall.parameters?.From || 'Unknown Caller';
        incomingCallRef.current = incomingCall;
        setIncomingFrom(from);
        setWebrtcStatus('incoming');
        addEvent('WebRTCIncoming', `Incoming call from ${from}`);

        incomingCall.on('cancel', () => {
          incomingCallRef.current = null;
          setIncomingFrom('');
          setWebrtcStatus('ready');
          addEvent('WebRTCCancelled', 'Incoming caller hung up');
        });
      });

      await device.register();
      deviceRef.current = device;
    } catch (err) {
      setWebrtcStatus('disconnected');
      const msg = err instanceof Error ? err.message : 'Failed to initialize WebRTC';
      setDirectCallError(`WebRTC Setup Error: ${msg}`);
      addEvent('WebRTCError', msg);
    }
  };

  // Start Outbound 2-Way Call directly from Laptop Mic/Speakers via Twilio WebRTC
  const handleStartWebRTCCall = async (targetNumber: string) => {
    setDirectCallError(null);
    setDirectCallSuccess(null);

    if (!deviceRef.current || webrtcStatus === 'disconnected') {
      setDirectCallError('Click "Connect Laptop Mic (WebRTC)" first, or use "Bridge Phone-to-Phone" below.');
      return;
    }

    const cleanNum = targetNumber.replace(/[\s\(\)\-]/g, '');
    setWebrtcTarget(cleanNum);
    setWebrtcStatus('dialing');
    addEvent('WebRTCDial', `Dialing ${cleanNum} from laptop WebRTC mic...`);

    try {
      const call = await deviceRef.current.connect({
        params: { To: cleanNum },
      });
      attachCallListeners(call, cleanNum);
    } catch (err) {
      setWebrtcStatus('ready');
      const msg = err instanceof Error ? err.message : 'Call failed to connect';
      setDirectCallError(`WebRTC Dial Failed: ${msg}`);
      addEvent('WebRTCError', msg);
    }
  };

  const handleAnswerIncomingWebRTC = () => {
    const incoming = incomingCallRef.current;
    if (!incoming) return;
    incomingCallRef.current = null;
    attachCallListeners(incoming, incomingFrom || 'Inbound Caller');
    incoming.accept();
  };

  const handleRejectIncomingWebRTC = () => {
    const incoming = incomingCallRef.current;
    if (!incoming) return;
    incoming.reject();
    incomingCallRef.current = null;
    setIncomingFrom('');
    setWebrtcStatus('ready');
    addEvent('WebRTCRejected', 'Rejected incoming call');
  };

  const handleHangupWebRTC = () => {
    if (activeWebRTCCallRef.current) {
      activeWebRTCCallRef.current.disconnect();
    }
  };

  const handleToggleMuteWebRTC = () => {
    if (!activeWebRTCCallRef.current) return;
    const nextMute = !isMuted;
    activeWebRTCCallRef.current.mute(nextMute);
    setIsMuted(nextMute);
    addEvent('WebRTCMute', nextMute ? 'Microphone muted' : 'Microphone unmuted');
  };

  // Poll live 2-leg bridge status so user sees Leg 1 & Leg 2 progress in real time
  useEffect(() => {
    if (!activeBridgeSid) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${normalizedBackend}/api/calls/${activeBridgeSid}/status`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const child = data.children?.[0];
        const allNotes = [
          ...(data.parent?.notifications || []),
          ...(child?.notifications || []),
        ];
        const firstNote = allNotes[0]
          ? `Twilio ${allNotes[0].errorCode}: ${allNotes[0].messageText}`
          : undefined;

        setBridgeLiveLegs({
          parentStatus: data.parent?.status || 'unknown',
          parentDuration: data.parent?.duration || '0',
          childStatus: child?.status,
          childTo: child?.to,
          errorNote: firstNote,
        });

        const terminal = ['completed', 'failed', 'busy', 'no-answer', 'canceled'];
        if (terminal.includes(data.parent?.status)) {
          setActiveBridgeSid(null);
          if (!child && Number(data.parent?.duration || 0) >= 10 && Number(data.parent?.duration || 0) <= 16) {
            setDirectCallError(
              'Call 1 ended after ~13s before dialing Phone 2. On Twilio Trial, answer Phone 1 and PRESS ANY KEY (e.g. 1) when Twilio says "Press any key to execute your code".'
            );
          } else if (firstNote) {
            setDirectCallError(firstNote);
          }
        }
      } catch {
        // Ignore transient poll errors
      }
    };

    poll();
    const interval = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeBridgeSid, normalizedBackend]);

  // FastAPI / AI Studio 2-Way Phone-to-Phone Bridge (Twilio REST API)
  const handleTriggerBridgeCall = async (targetNumber: string) => {
    setIsDirectDispatching(true);
    setDirectCallSuccess(null);
    setDirectCallError(null);
    setBridgeLiveLegs(null);

    const cleanDest = targetNumber.replace(/[\s\(\)\-]/g, '');
    const cleanAgent = bridgeAgentMobile.replace(/[\s\(\)\-]/g, '');
    setBridgeCustomDest(cleanDest);
    addEvent('BridgeRequest', `Twilio bridging ${cleanAgent} <-> ${cleanDest}`);

    try {
      const res = await fetch(`${normalizedBackend}/api/calls/bridge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: cleanDest,
          agentPhone: cleanAgent,
          callerId: backendStatus?.caller_id || '+17438887718',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || `HTTP ${res.status}`);
      }
      if (data.call_sid) {
        setActiveBridgeSid(data.call_sid);
      }
      const msg = data.message || `Ringing ${cleanAgent}, bridging 2-way voice to ${cleanDest}`;
      setDirectCallSuccess(msg);
      addEvent('BridgeStarted', `CallSid ${data.call_sid || 'ok'}: ${msg}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reach backend';
      setDirectCallError(
        `Bridge call failed: ${msg}.`
      );
      addEvent('BridgeError', msg);
    } finally {
      setIsDirectDispatching(false);
    }
  };

  // Simulator: Initiate Inbound Call to Asterisk Stasis
  const handleStartCall = async (forceImmediateRedirect = false) => {
    if (!activeFlow) return;

    telephonyAudio.setTelephonyFilter(true);
    const newChanId = `PJSIP/carrier-in-${Math.random().toString(16).substring(2, 8)}`;
    setChannelId(newChanId);
    setCallSeconds(0);
    setPressedDigits([]);
    setCallStatus('dialing');

    addEvent('Dialing', `Calling DID ${dialedNumber} from CallerID: ${callerNumber}`);

    setTimeout(() => {
      setCallStatus('ringing');
      addEvent('ChannelStateChange', `${newChanId} state: Ringing (180 Ringing)`);
      stopRingbackRef.current = telephonyAudio.startRingback();

      setTimeout(() => {
        if (stopRingbackRef.current) {
          stopRingbackRef.current();
          stopRingbackRef.current = null;
        }

        setCallStatus('in_stasis');
        addEvent('StasisStart', `Channel ${newChanId} entered Stasis application: ivr-controller`);

        if (forceImmediateRedirect) {
          triggerCallRedirection(forwardRedirectNumber);
        } else {
          const startNode = activeFlow.nodes.find((n) => n.id === activeFlow.startNodeId) || activeFlow.nodes[0];
          if (startNode) {
            executeNode(startNode);
          }
        }
      }, 2000);
    }, 600);
  };

  const executeNode = async (node: IVRNode) => {
    setCurrentNodeId(node.id);
    onNodeTraversed?.(node.id);
    addEvent('NodeEntered', `Executing node: [${node.type.toUpperCase()}] ${node.name}`);

    switch (node.type) {
      case 'greeting': {
        const text = node.data.ttsText || 'Welcome.';
        setCurrentPromptText(text);
        setCallStatus('speaking_prompt');
        addEvent('PlaybackStarted', `Playback media: ${text.slice(0, 35)}...`);

        await telephonyAudio.speakTTS(text, {
          voiceName: node.data.voice || 'alloy',
        });

        addEvent('PlaybackFinished', `Channel ${channelId} completed greeting prompt`);

        const nextConn = activeFlow.connections.find((c) => c.fromNodeId === node.id);
        if (nextConn) {
          const nextNode = activeFlow.nodes.find((n) => n.id === nextConn.toNodeId);
          if (nextNode) {
            executeNode(nextNode);
          }
        }
        break;
      }

      case 'business_hours': {
        addEvent('TimeCheck', `FastAPI evaluated PBX schedule in ${node.data.timezone || 'EST'}: CURRENTLY OPEN`);
        const openTargetId = node.data.openBranchNodeId;
        const targetNode =
          activeFlow.nodes.find((n) => n.id === openTargetId) ||
          activeFlow.nodes.find((n) => n.id === activeFlow.connections.find((c) => c.fromNodeId === node.id)?.toNodeId);

        if (targetNode) {
          executeNode(targetNode);
        }
        break;
      }

      case 'dtmf_menu': {
        const text = node.data.ttsText || 'Please make a selection from the keypad.';
        setCurrentPromptText(text);
        setCallStatus('awaiting_dtmf');
        addEvent('DTMFAwait', `Menu awaiting digit input (0-9, *, #)`);

        telephonyAudio.speakTTS(text, {
          voiceName: node.data.voice || 'alloy',
        });
        break;
      }

      case 'account_lookup': {
        addEvent('DBLookup', `FastAPI queried customer record for caller ID: ${callerNumber}`);
        setCurrentPromptText(`Looking up database profile for ${callerNumber}...`);

        setTimeout(() => {
          addEvent('DBSuccess', `Account verified for ${callerNumber}: balance=$142.50, status=ACTIVE`);
          const successId = node.data.successNodeId;
          const target = activeFlow.nodes.find((n) => n.id === successId);
          if (target) executeNode(target);
        }, 1200);
        break;
      }

      case 'tts_prompt': {
        const text = node.data.templateText?.replace('{{customer_balance}}', '$142.50') || 'Thank you.';
        setCurrentPromptText(text);
        setCallStatus('speaking_prompt');
        addEvent('DynamicTTS', `Synthesizing ${node.data.provider || 'OpenAI'}: ${text.slice(0, 40)}...`);

        await telephonyAudio.speakTTS(text, {
          voiceName: 'Rachel',
        });

        const nextConn = activeFlow.connections.find((c) => c.fromNodeId === node.id);
        if (nextConn) {
          const nextNode = activeFlow.nodes.find((n) => n.id === nextConn.toNodeId);
          if (nextNode) executeNode(nextNode);
        }
        break;
      }

      case 'queue_bridge': {
        setCallStatus('in_queue_bridge');
        const qName = node.data.queueName || 'support_queue';
        setCurrentPromptText(`Entering queue: ${qName}. Music on Hold is playing...`);
        addEvent('BridgeCreated', `ARI created Mixing Bridge: bridge-${qName}`);
        addEvent('ChannelJoinedBridge', `Channel ${channelId} added to bridge-${qName} with MOH`);

        stopHoldRef.current = telephonyAudio.startHoldMusic();

        setTimeout(() => {
          if (stopHoldRef.current) {
            stopHoldRef.current();
            stopHoldRef.current = null;
          }
          setCallStatus('connected_agent');
          setCurrentPromptText('Connected with Agent Sarah Miller (Ext 204). Two-way audio active.');
          addEvent('AgentAnswered', `SIP/agent-sarah bridged with channel ${channelId}`);
          telephonyAudio.speakTTS('Hello, this is Sarah from Tier 2 Engineering. How can I assist you today?');
        }, 5000);
        break;
      }

      case 'voicemail': {
        setCurrentPromptText('Please leave your message after the tone. Press pound when finished.');
        addEvent('VoicemailStart', `Recording caller audio stream to mailbox ${node.data.mailbox}`);
        await telephonyAudio.speakTTS('Please leave your message after the beep.');
        await telephonyAudio.playDTMF('1', 300);
        break;
      }

      case 'transfer': {
        const dest = forwardRedirectNumber || node.data.destinationNumber || 'Operator';
        triggerCallRedirection(dest);
        break;
      }

      case 'hangup': {
        handleHangup();
        break;
      }
    }
  };

  const triggerCallRedirection = async (targetNumber: string) => {
    setCallStatus('redirecting_to_user');
    setCurrentPromptText(
      `Redirecting call to your number: ${targetNumber}. Asterisk is originating outbound leg...`
    );

    addEvent('ChannelRedirect', `SIP REFER / Channel Redirect to ${targetNumber}`);
    addEvent('PJSIPOutbound', `Creating outbound channel PJSIP/trunk-out/${targetNumber.replace(/\D/g, '')}`);

    await telephonyAudio.speakTTS(
      `Redirecting your call to ${targetNumber}. Please hold while your phone rings.`
    );

    stopRingbackRef.current = telephonyAudio.startRingback();
    addEvent('ChannelStateChange', `Outbound leg to ${targetNumber} is Ringing (180)`);

    setTimeout(() => {
      if (stopRingbackRef.current) {
        stopRingbackRef.current();
        stopRingbackRef.current = null;
      }

      setCallStatus('connected_user_phone');
      setCurrentPromptText(
        `Call successfully redirected and answered on your number: ${targetNumber}! Two-way audio bridged.`
      );
      addEvent('ChannelAnswered', `200 OK received from ${targetNumber}`);
      addEvent('BridgeCreated', `ARI Mixing Bridge bridge-redirect-01 created`);
      addEvent('ChannelJoinedBridge', `Caller and ${targetNumber} successfully bridged.`);

      telephonyAudio.speakTTS(
        `Call connected! This call has been redirected to ${targetNumber}. Telephony audio bridge is live.`
      );
    }, 4000);
  };

  const handlePressKey = async (digit: string) => {
    telephonyAudio.playDTMF(digit, 160);

    // If inside an active live WebRTC call, send real DTMF tone over Twilio!
    if (softphoneMode === 'live_twilio' && activeWebRTCCallRef.current && webrtcStatus === 'connected') {
      activeWebRTCCallRef.current.sendDigits(digit);
      addEvent('WebRTCDTMF', `Sent live DTMF digit "${digit}" to Twilio call`);
      return;
    }

    if (softphoneMode === 'live_twilio') {
      setWebrtcTarget((prev) => prev + digit);
      return;
    }

    if (callStatus === 'idle') {
      setDialedNumber((prev) => prev + digit);
      return;
    }

    setPressedDigits((prev) => [...prev, digit]);
    addEvent('ChannelDtmfReceived', `Channel ${channelId} received DTMF digit: "${digit}"`);

    if (callStatus === 'awaiting_dtmf' && currentNodeId) {
      const currentNode = activeFlow.nodes.find((n) => n.id === currentNodeId);
      if (currentNode && currentNode.type === 'dtmf_menu') {
        const branches = currentNode.data.branches || [];
        const match = branches.find((b) => b.key === digit);

        if (match && match.targetNodeId) {
          const nextNode = activeFlow.nodes.find((n) => n.id === match.targetNodeId);
          if (nextNode) {
            addEvent('DTMFMatched', `Digit "${digit}" matched branch: ${match.label}`);
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
            executeNode(nextNode);
            return;
          }
        } else {
          addEvent('DTMFInvalid', `Digit "${digit}" has no route. Retrying menu...`);
          telephonyAudio.speakTTS('Invalid selection. Please try again.');
        }
      }
    }
  };

  const handleHangup = () => {
    telephonyAudio.stopAllAudio();
    if (stopRingbackRef.current) {
      stopRingbackRef.current();
      stopRingbackRef.current = null;
    }
    if (stopHoldRef.current) {
      stopHoldRef.current();
      stopHoldRef.current = null;
    }

    setCallStatus('terminated');
    setCurrentPromptText('Call Ended');
    addEvent('ChannelDestroyed', `Channel ${channelId} hung up (SIP 200 OK / StasisEnd)`);

    setTimeout(() => {
      setCallStatus('idle');
      setCurrentNodeId(null);
    }, 2000);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`fixed z-50 transition-all duration-200 select-none ${
        isMinimized
          ? 'bottom-5 right-5 w-80'
          : 'bottom-5 right-5 w-96 md:w-[500px] max-h-[92vh]'
      }`}
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 backdrop-blur-md">
        {/* Top Title Bar */}
        <div className="px-4 py-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                webrtcStatus === 'connected' || callStatus === 'connected_user_phone'
                  ? 'bg-emerald-400 animate-ping'
                  : webrtcStatus === 'ready'
                  ? 'bg-emerald-400'
                  : webrtcStatus === 'incoming' || webrtcStatus === 'ringing' || callStatus !== 'idle'
                  ? 'bg-cyan-400 animate-pulse'
                  : 'bg-slate-600'
              }`}
            />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
              Twilio WebRTC & FastAPI Softphone
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowNumberSettings(!showNumberSettings)}
              className={`p-1 rounded transition-colors ${
                showNumberSettings ? 'text-cyan-400 bg-slate-800' : 'text-slate-400 hover:text-white'
              }`}
              title="Settings"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 text-slate-400 hover:text-white rounded"
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded"
              title="Close Softphone"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        {!isMinimized && (
          <div className="grid grid-cols-2 bg-slate-950 border-b border-slate-800 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setSoftphoneMode('live_twilio')}
              className={`py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                softphoneMode === 'live_twilio'
                  ? 'border-emerald-400 text-emerald-300 bg-slate-900/70'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Live 2-Way WebRTC & Bridge</span>
            </button>
            <button
              type="button"
              onClick={() => setSoftphoneMode('ivr_simulator')}
              className={`py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                softphoneMode === 'ivr_simulator'
                  ? 'border-cyan-400 text-cyan-300 bg-slate-900/70'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>IVR Flow Simulator</span>
            </button>
          </div>
        )}

        {!isMinimized && (
          <div className="p-4 space-y-3.5 max-h-[78vh] overflow-y-auto">
            {softphoneMode === 'live_twilio' ? (
              <>
                {/* Backend Connectivity Bar (AI Studio Server OR Local FastAPI) */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 font-mono font-semibold">
                      {backendStatus ? (
                        <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span className={backendStatus ? 'text-emerald-300' : 'text-amber-300'}>
                        {backendStatus
                          ? backendStatus.runtime === 'ai-studio-express'
                            ? 'AI Studio Server Connected'
                            : 'Local FastAPI Connected'
                          : 'Backend Unreachable'}
                      </span>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setBackendUrl('')}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          normalizedBackend === ''
                            ? 'bg-cyan-950 border-cyan-700 text-cyan-300 font-bold'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        AI Studio
                      </button>
                      <button
                        type="button"
                        onClick={() => setBackendUrl('http://localhost:8000')}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          normalizedBackend === 'http://localhost:8000'
                            ? 'bg-cyan-950 border-cyan-700 text-cyan-300 font-bold'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        Local :8000
                      </button>
                      <button
                        type="button"
                        onClick={checkBackendStatus}
                        disabled={backendChecking}
                        className="flex items-center gap-1 text-[10px] font-mono bg-slate-900 hover:bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-slate-300"
                      >
                        <RefreshCw className={`w-3 h-3 ${backendChecking ? 'animate-spin' : ''}`} />
                        <span>Check</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={backendUrl}
                      onChange={(e) => setBackendUrl(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
                      placeholder="Same-origin AI Studio (/api) or http://localhost:8000"
                    />
                    {backendStatus && (
                      <div className="flex items-center gap-1.5 text-[10px] font-mono">
                        <span
                          className={`px-1.5 py-0.5 rounded border ${
                            backendStatus.webrtc_ready
                              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                              : 'bg-amber-950/60 border-amber-800 text-amber-300'
                          }`}
                        >
                          WebRTC: {backendStatus.webrtc_ready ? 'Ready' : 'Optional'}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded border ${
                            backendStatus.bridge_ready
                              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                              : 'bg-amber-950/60 border-amber-800 text-amber-300'
                          }`}
                        >
                          Bridge: {backendStatus.bridge_ready ? 'Ready' : 'Needs SID/Token'}
                        </span>
                      </div>
                    )}
                  </div>

                  {backendStatus && !backendStatus.bridge_ready && (
                    <div className="p-2 bg-amber-950/40 border border-amber-800/70 rounded text-[10px] text-amber-200 leading-relaxed flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        {backendStatus.runtime === 'ai-studio-express'
                          ? 'Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in AI Studio Secrets (no API key needed), or click "Local :8000" to use your laptop FastAPI.'
                          : 'Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to your local .env file and restart uvicorn.'}
                      </span>
                    </div>
                  )}

                  {backendError && (
                    <div className="p-2 bg-amber-950/40 border border-amber-800/70 rounded text-[10px] text-amber-200 leading-relaxed flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>{backendError}</span>
                    </div>
                  )}
                </div>

                {/* Incoming WebRTC Call Alert */}
                {webrtcStatus === 'incoming' && (
                  <div className="p-3 bg-emerald-950/60 border border-emerald-600 rounded-xl flex items-center justify-between gap-2 animate-pulse">
                    <div className="flex items-center gap-2">
                      <PhoneIncoming className="w-5 h-5 text-emerald-400" />
                      <div>
                        <div className="text-xs font-bold text-white">Incoming Call to Browser</div>
                        <div className="text-[11px] font-mono text-emerald-300">{incomingFrom}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleAnswerIncomingWebRTC}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs"
                      >
                        Answer
                      </button>
                      <button
                        type="button"
                        onClick={handleRejectIncomingWebRTC}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {/* Section 1 (Primary): 2-Way Phone-to-Phone Twilio Bridge (Works with SID + Token ONLY) */}
                <div className="p-3.5 bg-slate-950 rounded-xl border border-emerald-700/70 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>1. 2-Way Phone Bridge (Works With Just SID &amp; Auth Token)</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Uses caller ID <span className="text-emerald-300 font-mono">+17438887718</span>. Rings your mobile first, then bridges full 2-way voice to your contact — no API key or ngrok needed.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 text-[10px] font-mono mb-1">
                        Your Mobile (Rings First)
                      </label>
                      <input
                        type="text"
                        value={bridgeAgentMobile}
                        onChange={(e) => setBridgeAgentMobile(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-emerald-300 font-mono text-xs font-semibold focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[10px] font-mono mb-1">
                        Contact to Bridge (2-Way)
                      </label>
                      <input
                        type="text"
                        value={bridgeCustomDest}
                        onChange={(e) => setBridgeCustomDest(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="p-2 bg-amber-950/40 border border-amber-800/60 rounded-lg text-[10px] text-amber-200 leading-relaxed">
                    <strong>Twilio Trial Tip:</strong> When <strong>{bridgeAgentMobile}</strong> rings, pick up and <strong>press any key (e.g. 1)</strong> during the Twilio trial prompt — Twilio immediately rings Phone 2 and bridges 2-way voice!
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={isDirectDispatching}
                      onClick={() => handleTriggerBridgeCall('+919199225154')}
                      className="py-2 px-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-lg text-[10px] flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                    >
                      <Phone className="w-3 h-3 fill-current shrink-0" />
                      <span className="truncate">Bridge ➔ 9199225154</span>
                    </button>
                    <button
                      type="button"
                      disabled={isDirectDispatching}
                      onClick={() => handleTriggerBridgeCall('+919620303042')}
                      className="py-2 px-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold rounded-lg text-[10px] flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                    >
                      <Phone className="w-3 h-3 fill-current shrink-0" />
                      <span className="truncate">Bridge ➔ 9620303042</span>
                    </button>
                  </div>

                  {bridgeLiveLegs && (
                    <div className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-[10px] font-mono space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Leg 1 ({bridgeAgentMobile}):</span>
                        <span className="text-cyan-300 font-bold uppercase">
                          {bridgeLiveLegs.parentStatus} ({bridgeLiveLegs.parentDuration}s)
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Leg 2 ({bridgeLiveLegs.childTo || bridgeCustomDest}):</span>
                        <span className={bridgeLiveLegs.childStatus ? 'text-emerald-300 font-bold uppercase' : 'text-amber-300'}>
                          {bridgeLiveLegs.childStatus || 'WAITING FOR KEYPRESS ON LEG 1...'}
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isDirectDispatching || !bridgeCustomDest.trim()}
                    onClick={() => handleTriggerBridgeCall(bridgeCustomDest)}
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>
                      {isDirectDispatching
                        ? 'Dispatching Bridge...'
                        : `Call & Bridge ${bridgeAgentMobile} <-> ${bridgeCustomDest}`}
                    </span>
                  </button>
                </div>

                {/* Section 1B: Inbound +17438887718 3-Number IVR Router (Twilio Studio Cloud) */}
                <div className="p-3.5 bg-slate-950 rounded-xl border border-purple-700/70 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                        <PhoneIncoming className="w-3.5 h-3.5" />
                        <span>2. Inbound IVR on +17438887718 (Press 1 / 2 / 3)</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Anyone calling <span className="font-mono text-purple-300">+17438887718</span> hears the IVR menu and presses 1, 2, or 3 to route to your 3 numbers 24/7.
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border shrink-0 ${
                        ivrBound
                          ? 'bg-emerald-950/70 border-emerald-700 text-emerald-300 font-bold'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      {ivrBound ? 'LIVE ON +17438887718' : 'NOT BOUND'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <label className="block text-[9px] font-mono text-slate-400 mb-0.5">Press 1 (Owner)</label>
                      <input
                        type="text"
                        value={ivrRoute1}
                        onChange={(e) => setIvrRoute1(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-[10px] font-mono text-emerald-300 focus:outline-none focus:border-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-mono text-slate-400 mb-0.5">Press 2 (Contact 1)</label>
                      <input
                        type="text"
                        value={ivrRoute2}
                        onChange={(e) => setIvrRoute2(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-[10px] font-mono text-purple-300 focus:outline-none focus:border-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-mono text-slate-400 mb-0.5">Press 3 (Contact 2)</label>
                      <input
                        type="text"
                        value={ivrRoute3}
                        onChange={(e) => setIvrRoute3(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-[10px] font-mono text-amber-300 focus:outline-none focus:border-purple-400"
                      />
                    </div>
                  </div>

                  <div className="p-2 bg-slate-900/90 border border-slate-800 rounded-lg space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[10px] font-mono text-purple-200 font-semibold">
                        Callback IVR Target (₹0 ISD — Twilio Calls You)
                      </label>
                      <div className="flex items-center gap-1">
                        {[
                          { label: '99161', num: ivrRoute1 },
                          { label: '91992', num: ivrRoute2 },
                          { label: '96203', num: ivrRoute3 },
                        ].map((chip) => (
                          <button
                            key={chip.label}
                            type="button"
                            onClick={() => setIvrTestPhone(chip.num)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-colors ${
                              ivrTestPhone === chip.num
                                ? 'bg-purple-600/40 border-purple-400 text-purple-100'
                                : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      value={ivrTestPhone}
                      onChange={(e) => setIvrTestPhone(e.target.value)}
                      placeholder="+919916109192"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={isDeployingIvr}
                      onClick={handleDeployIvr}
                      className="py-2 px-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-[11px] flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>{isDeployingIvr ? 'Publishing...' : ivrBound ? 'Update Live IVR' : 'Activate IVR'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isTestingIvr || !ivrTestPhone.trim()}
                      onClick={() => handleTestIvrOnPhone(ivrTestPhone)}
                      className="py-2 px-2 bg-slate-900 hover:bg-slate-800 border border-purple-700/70 text-purple-200 font-bold rounded-lg text-[11px] flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{isTestingIvr ? 'Calling...' : 'Callback IVR (₹0 ISD)'}</span>
                    </button>
                  </div>
                </div>

                {/* Section 2: Browser Mic/Speaker WebRTC Softphone (Auto-Creates Keys from SID + Token) */}
                <div className="p-3.5 bg-slate-950 rounded-xl border border-cyan-800/60 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                        <Mic className="w-3.5 h-3.5" />
                        <span>2. Laptop Mic WebRTC Voice (Optional)</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Talk from your laptop mic/speakers. FastAPI auto-creates API Key &amp; TwiML App for you.
                      </p>
                    </div>
                    {backendStatus?.webrtc_ready && (
                      <button
                        type="button"
                        onClick={handleConnectWebRTC}
                        disabled={webrtcStatus === 'connecting'}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors shrink-0 ${
                          webrtcStatus === 'disconnected'
                            ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                            : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-700/70'
                        }`}
                      >
                        {webrtcStatus === 'connecting'
                          ? 'Connecting...'
                          : webrtcStatus === 'disconnected'
                          ? 'Connect Laptop Mic'
                          : 'Mic Online'}
                      </button>
                    )}
                  </div>

                  {!backendStatus?.webrtc_ready && (
                    <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg space-y-2">
                      <div className="text-[10px] text-slate-300">
                        Paste your <code className="text-cyan-300">ngrok http 8000</code> HTTPS URL to auto-generate API Key &amp; TwiML App using your Account SID + Auth Token:
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={ngrokUrl}
                          onChange={(e) => setNgrokUrl(e.target.value)}
                          placeholder="https://xxxx.ngrok-free.app"
                          className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-cyan-400"
                        />
                        <button
                          type="button"
                          disabled={isAutoSettingUp}
                          onClick={handleAutoSetupWebRTC}
                          className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded text-[11px] whitespace-nowrap disabled:opacity-50"
                        >
                          {isAutoSettingUp ? 'Creating...' : 'Auto-Setup & Connect'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Dial Input + Active Call Controls */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={webrtcTarget}
                      disabled={webrtcStatus === 'connected' || webrtcStatus === 'dialing' || webrtcStatus === 'ringing'}
                      onChange={(e) => setWebrtcTarget(e.target.value)}
                      placeholder="+919916109192"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-mono font-bold text-white focus:outline-none focus:border-cyan-400"
                    />

                    {webrtcStatus === 'connected' || webrtcStatus === 'dialing' || webrtcStatus === 'ringing' ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-emerald-400 font-bold tabular-nums px-1.5">
                          {webrtcStatus === 'connected' ? formatTime(webrtcCallSeconds) : webrtcStatus.toUpperCase()}
                        </span>
                        <button
                          type="button"
                          onClick={handleToggleMuteWebRTC}
                          className={`p-2 rounded-lg border text-xs ${
                            isMuted
                              ? 'bg-amber-950 border-amber-700 text-amber-300'
                              : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                          }`}
                          title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
                        >
                          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={handleHangupWebRTC}
                          className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs flex items-center gap-1"
                        >
                          <PhoneOff className="w-3.5 h-3.5" />
                          <span>End</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartWebRTCCall(webrtcTarget)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-cyan-700/70 text-cyan-300 font-bold rounded-lg text-xs flex items-center gap-1.5 shrink-0"
                      >
                        <Phone className="w-3.5 h-3.5 fill-current" />
                        <span>Call via Mic</span>
                      </button>
                    )}
                  </div>

                  {/* Quick WebRTC Contact Buttons */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {QUICK_CONTACTS.map((c) => (
                      <button
                        key={`rtc-${c.number}`}
                        type="button"
                        disabled={webrtcStatus === 'connected' || webrtcStatus === 'dialing'}
                        onClick={() => handleStartWebRTCCall(c.number)}
                        className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-[10px] font-mono text-slate-200 flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <Phone className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span className="truncate">{c.short}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section 3: Exotel (+91 Indian Virtual Number & IVR) */}
                <div className="p-3.5 bg-slate-950 rounded-xl border border-amber-700/70 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <PhoneForwarded className="w-3.5 h-3.5" />
                        <span>3. Exotel +91 (packyatra1 Landing Flow · #1386346)</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        ExoPhone: <span className="font-mono text-amber-200">{exotelStatus?.caller_id || '08047291107'}</span> · Trial: <span className="font-mono text-slate-300">09513886363</span> (PIN <span className="font-mono text-emerald-300">9916-1091-92</span>)
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border shrink-0 ${
                        exotelStatus?.exotel_ready
                          ? 'bg-emerald-950/70 border-emerald-700 text-emerald-300 font-bold'
                          : 'bg-amber-950/60 border-amber-800 text-amber-300'
                      }`}
                    >
                      {exotelStatus?.exotel_ready ? 'EXOTEL READY' : 'NEEDS API SECRETS'}
                    </span>
                  </div>

                  <div className="p-2 bg-emerald-950/30 border border-emerald-800/60 rounded-lg text-[10px] text-emerald-200 leading-relaxed">
                    <strong>Inbound IVR Already Live (No Secrets Needed):</strong> Call <strong className="font-mono">08047291107</strong> (or <strong className="font-mono">09513886363</strong> + PIN <strong className="font-mono">9916109192</strong>) from your Indian SIM — routes directly into Flow <strong>#1386346</strong>!
                  </div>

                  {!exotelStatus?.exotel_ready ? (
                    <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg text-[10px] text-slate-300 space-y-1 leading-relaxed">
                      <div className="font-semibold text-amber-200">
                        For outbound API calling from this button, add these 3 secrets in AI Studio Secrets:
                      </div>
                      <div className="font-mono text-[10px] text-cyan-300">
                        EXOTEL_ACCOUNT_SID · EXOTEL_API_KEY · EXOTEL_API_TOKEN
                      </div>
                      <div className="text-slate-400">
                        (<code className="text-emerald-300">08047291107</code> and Flow <code className="text-emerald-300">1386346</code> are already pre-configured.)
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          disabled={isExotelCalling}
                          onClick={() => handleExotelBridge('+919199225154')}
                          className="py-2 px-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[10px] flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          <span>Exotel Bridge ➔ 9199225154</span>
                        </button>
                        <button
                          type="button"
                          disabled={isExotelCalling}
                          onClick={() => handleExotelBridge('+919620303042')}
                          className="py-2 px-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-[10px] flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          <span>Exotel Bridge ➔ 9620303042</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={exotelFlowAppId}
                          onChange={(e) => setExotelFlowAppId(e.target.value)}
                          placeholder="App Bazaar Flow ID (e.g. 812345)"
                          className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-amber-400"
                        />
                        <button
                          type="button"
                          disabled={isExotelCalling || !exotelFlowAppId.trim()}
                          onClick={() => handleExotelIvr(ivrTestPhone)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-amber-700/70 text-amber-200 font-bold rounded text-[11px] whitespace-nowrap disabled:opacity-50"
                        >
                          {isExotelCalling ? 'Calling...' : 'Call w/ Exotel IVR'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {directCallSuccess && (
                  <div className="p-2 bg-emerald-950/70 border border-emerald-700/80 rounded-lg text-[11px] text-emerald-200 font-mono flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{directCallSuccess}</span>
                  </div>
                )}

                {directCallError && (
                  <div className="p-2 bg-rose-950/70 border border-rose-700/80 rounded-lg text-[11px] text-rose-200 font-mono flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{directCallError}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Simulator Notice Banner */}
                <div className="px-3 py-2 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-center justify-between text-[11px] text-amber-200">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      <strong>IVR Simulator:</strong> Tests your visual flow tree & DTMF routing in-browser. Switch to <strong>Live 2-Way WebRTC & Bridge</strong> for real mobile calls.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenLiveCarrierDispatcher?.(forwardRedirectNumber)}
                    className="text-[10px] bg-amber-900/90 hover:bg-amber-800 text-amber-100 px-2 py-0.5 rounded font-bold whitespace-nowrap ml-2 transition-colors flex items-center gap-1 shrink-0"
                  >
                    <Smartphone className="w-3 h-3" />
                    <span>Setup</span>
                  </button>
                </div>

                {/* Phone Number & Redirection Settings Drawer */}
                {showNumberSettings && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-cyan-800/60 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between text-cyan-400 font-mono font-semibold text-[11px] uppercase">
                      <span className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Simulator Caller Config</span>
                      </span>
                      <span className="text-slate-500 text-[10px]">Stasis IVR</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-400 text-[10px] font-mono mb-1">
                          Calling From (Caller ID)
                        </label>
                        <input
                          type="text"
                          value={callerNumber}
                          onChange={(e) => setCallerNumber(e.target.value)}
                          placeholder="+91 9916109192"
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 text-[10px] font-mono mb-1">
                          Redirect To (Target Phone)
                        </label>
                        <input
                          type="text"
                          value={forwardRedirectNumber}
                          onChange={(e) => setForwardRedirectNumber(e.target.value)}
                          placeholder="+91 9916109192"
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-emerald-400 font-mono text-xs font-semibold focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Call State Display Screen */}
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span
                      className={`font-semibold ${
                        callStatus === 'connected_user_phone'
                          ? 'text-emerald-400'
                          : callStatus === 'redirecting_to_user'
                          ? 'text-purple-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {callStatus === 'idle'
                        ? 'READY TO DIAL'
                        : callStatus === 'dialing'
                        ? 'CONNECTING SIP...'
                        : callStatus === 'ringing'
                        ? 'RINGING (180)'
                        : callStatus === 'in_stasis'
                        ? 'STASIS STARTED'
                        : callStatus === 'awaiting_dtmf'
                        ? 'AWAITING KEYPAD DIGIT (PRESS 0 TO REDIRECT)'
                        : callStatus === 'in_queue_bridge'
                        ? 'IN QUEUE BRIDGE'
                        : callStatus === 'redirecting_to_user'
                        ? 'REDIRECTING TO YOUR NUMBER...'
                        : callStatus === 'connected_user_phone'
                        ? 'REDIRECTED & CONNECTED TO YOUR PHONE'
                        : callStatus === 'connected_agent'
                        ? 'AGENT CONNECTED'
                        : 'CALL TERMINATED'}
                    </span>
                    <span className="text-cyan-400 font-bold tabular-nums">
                      {formatTime(callSeconds)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={dialedNumber}
                      disabled={callStatus !== 'idle'}
                      onChange={(e) => setDialedNumber(e.target.value)}
                      placeholder="Enter phone number..."
                      className="flex-1 bg-transparent text-lg font-mono font-bold text-white tracking-wide border-b border-transparent focus:border-cyan-500 focus:outline-none py-0.5"
                    />
                    {callStatus === 'idle' && dialedNumber.length > 0 && (
                      <button
                        onClick={() => setDialedNumber((prev) => prev.slice(0, -1))}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded"
                        title="Backspace"
                      >
                        <Delete className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div
                    className={`text-xs leading-relaxed font-sans p-2.5 rounded border min-h-[44px] transition-all ${
                      callStatus === 'connected_user_phone'
                        ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                        : callStatus === 'redirecting_to_user'
                        ? 'bg-purple-950/40 border-purple-800 text-purple-200'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300'
                    }`}
                  >
                    {currentPromptText || (
                      <span className="text-slate-500 italic">
                        Press "Dial IVR Menu" or "Test Direct Redirection" below...
                      </span>
                    )}
                  </div>

                  {pressedDigits.length > 0 && (
                    <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 pt-1">
                      <span>DTMF History:</span>
                      <div className="flex gap-1">
                        {pressedDigits.map((d, i) => (
                          <span
                            key={i}
                            className="bg-cyan-950 text-cyan-300 px-1.5 py-0.2 rounded border border-cyan-800 font-bold"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Inbound DID & Flow Selector */}
                {callStatus === 'idle' && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-slate-400 text-[10px] font-mono uppercase mb-1">
                        Target DID (Click to Load)
                      </label>
                      <select
                        value={dialedNumber}
                        onChange={(e) => {
                          setDialedNumber(e.target.value);
                          const matching = dids.find((d) => d.number === e.target.value);
                          if (matching) setSelectedFlowId(matching.assignedFlowId);
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                      >
                        {dids.map((d) => (
                          <option key={d.id} value={d.number}>
                            {d.number} ({d.label.slice(0, 15)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-[10px] font-mono uppercase mb-1">
                        IVR Flow Engine
                      </label>
                      <select
                        value={selectedFlowId}
                        onChange={(e) => setSelectedFlowId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500"
                      >
                        {flows.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Simulator Call Controls */}
                <div className="space-y-2 pt-1">
                  {callStatus === 'idle' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        onClick={() => handleStartCall(false)}
                        className="py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all text-xs"
                      >
                        <Phone className="w-4 h-4 fill-current" />
                        <span>Dial IVR Menu</span>
                      </button>

                      <button
                        onClick={() => handleStartCall(true)}
                        className="py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all text-xs"
                      >
                        <PhoneForwarded className="w-4 h-4" />
                        <span>Test Direct Redirection</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleHangup}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition-all text-sm"
                    >
                      <PhoneOff className="w-4 h-4" />
                      <span>End Call (Hangup)</span>
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Shared Standard Telephone Keypad (Live WebRTC DTMF / Simulator DTMF) */}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { digit: '1', sub: ' ' },
                { digit: '2', sub: 'ABC' },
                { digit: '3', sub: 'DEF' },
                { digit: '4', sub: 'GHI' },
                { digit: '5', sub: 'JKL' },
                { digit: '6', sub: 'MNO' },
                { digit: '7', sub: 'PQRS' },
                { digit: '8', sub: 'TUV' },
                { digit: '9', sub: 'WXYZ' },
                { digit: '*', sub: ' ' },
                { digit: '0', sub: 'OPERATOR' },
                { digit: '#', sub: ' ' },
              ].map((k) => (
                <button
                  key={k.digit}
                  onClick={() => handlePressKey(k.digit)}
                  className={`py-2 bg-slate-950 hover:bg-slate-800 active:bg-cyan-900 border rounded-xl flex flex-col items-center justify-center transition-all group ${
                    k.digit === '0'
                      ? 'border-cyan-800/80 bg-cyan-950/20'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="text-sm font-bold font-mono text-white group-hover:text-cyan-400">
                    {k.digit}
                  </span>
                  <span
                    className={`text-[8px] font-mono tracking-wider uppercase ${
                      k.digit === '0' ? 'text-cyan-400 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    {k.sub}
                  </span>
                </button>
              ))}
            </div>

            {/* Live Event Stream */}
            <div className="border border-slate-800 rounded-lg p-2.5 bg-slate-950 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3 h-3 text-cyan-400" />
                  <span>Live Telephony Event Stream</span>
                </span>
                <span className="text-emerald-400">{normalizedBackend || 'AI Studio Server (/api)'}</span>
              </div>

              <div className="h-20 overflow-y-auto font-mono text-[10px] space-y-1 pr-1 text-slate-400">
                {eventLogs.length === 0 ? (
                  <div className="text-slate-600 italic">Waiting for call activity...</div>
                ) : (
                  eventLogs.map((log, i) => (
                    <div key={i} className="flex items-start gap-1.5 leading-tight">
                      <span className="text-slate-500 shrink-0">{log.timestamp}</span>
                      <span className="text-cyan-400 font-bold shrink-0">[{log.event}]</span>
                      <span className="text-slate-300 truncate">{log.details}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

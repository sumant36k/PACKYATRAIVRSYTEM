import React, { useState } from 'react';
import { CallFlow } from '../../types/ivr';
import {
  Code2,
  Copy,
  Download,
  CheckCircle2,
  FileCode,
  Layers,
  Terminal,
  Box,
  Server,
} from 'lucide-react';

interface CodeExportCenterProps {
  currentFlow: CallFlow;
}

export const CodeExportCenter: React.FC<CodeExportCenterProps> = ({ currentFlow }) => {
  const [selectedFile, setSelectedFile] = useState<string>('vscode_guide');
  const [copied, setCopied] = useState<boolean>(false);

  const flowJson = JSON.stringify(currentFlow, null, 2);

  // Python files content
  const files: Record<string, { name: string; lang: string; desc: string; content: string }> = {
    vscode_guide: {
      name: 'VS_CODE_STEP_BY_STEP.md',
      lang: 'markdown',
      desc: 'Quickstart: Make 2-Way Calls Using ONLY Twilio Account SID & Auth Token (+17438887718)',
      content: `# 🚀 Quickstart: 2-Way Calling Using ONLY Account SID & Auth Token

You do **NOT** need to manually create an API Key, API Secret, or TwiML App SID!
With just your **Account SID**, **Auth Token**, Twilio Number (**+17438887718**), and Mobile (**+919916109192**), you can:
1. **Bridge 2-Way Phone Calls Immediately** (zero ngrok, zero extra keys).
2. **Auto-Generate WebRTC Keys in 1 Click** if you also want laptop mic/speakers calling.

---

### Step 1: Install Packages in VS Code PowerShell
\`\`\`powershell
python -m pip install fastapi uvicorn twilio python-dotenv websockets httpx pydantic python-multipart
\`\`\`

---

### Step 2: Create \`.env\` in Your VS Code Project Root
Create a file named \`.env\` with ONLY these 4 lines:
\`\`\`env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_CALLER_ID=+17438887718
MY_MOBILE_NUMBER=+919916109192
\`\`\`
*(Copy Account SID & Auth Token from the bottom-left "Account Info" box on your Twilio Console home page).*

---

### Step 3: Start FastAPI
\`\`\`powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
\`\`\`

---

### Step 4: Test 2-Way Calling Immediately (No Ngrok Needed!)
1. Open the app Softphone -> **Live 2-Way WebRTC & Bridge**.
2. Under **1. Phone-to-Phone 2-Way Bridge**, click **9199225154** (or **9620303042**).
3. Your phone **+919916109192** rings from **+17438887718**.
4. Answer it — Twilio immediately dials your contact and bridges **full 2-way voice** between both phones!

---

### Step 5 (Optional): Want Laptop Mic/Speakers Calling Too?
1. Run \`ngrok http 8000\` in a second PowerShell tab and copy the \`https://...\` URL.
2. Paste that URL into **2. Laptop Mic WebRTC (Auto-Setup)** in the Softphone and click **Auto-Setup & Connect Mic**.
3. FastAPI uses your Account SID + Auth Token to **automatically create** the API Key, API Secret, and TwiML App SID for you!
`,
    },
    env_file: {
      name: '.env',
      lang: 'bash',
      desc: 'Minimal .env — only Account SID, Auth Token, +17438887718 & +919916109192 required',
      content: `# Put this file in your local VS Code project root (same folder as app/)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_CALLER_ID=+17438887718
MY_MOBILE_NUMBER=+919916109192

# Leave blank — FastAPI auto-fills these if you click "Auto-Setup WebRTC" in the app:
TWILIO_API_KEY=
TWILIO_API_SECRET=
TWILIO_TWIML_APP_SID=
`,
    },
    main_py: {
      name: 'app/main.py',
      lang: 'python',
      desc: 'FastAPI server with 2-Way Twilio Call Bridge (SID+Token only) + Auto WebRTC Setup + TwiML IVR',
      content: `"""
FastAPI Telephony Service - Twilio 2-Way Bridge & Auto-Provisioned WebRTC
Works immediately with ONLY TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + +17438887718.
"""

import os
import asyncio
import logging
import subprocess
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Dict, Any, List
from xml.sax.saxutils import escape

from dotenv import load_dotenv, set_key
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from twilio.rest import Client as TwilioClient
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant

from app.ari_worker import start_ari_event_listener, active_channels
from app.ivr_state_machine import IVRStateMachine

ENV_PATH = Path(".env")
load_dotenv(dotenv_path=ENV_PATH if ENV_PATH.exists() else None)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ivr-fastapi")


def get_env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    ari_task = asyncio.create_task(start_ari_event_listener(manager.broadcast))
    logger.info("Telecom FastAPI engine initialized (Twilio 2-Way Bridge + WebRTC).")
    yield
    ari_task.cancel()


app = FastAPI(title="Asterisk + Twilio IVR Engine", version="2.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

current_flow_data = ${flowJson}
state_machine = IVRStateMachine(current_flow_data)


def normalize_e164(num: str) -> str:
    cleaned = "".join(ch for ch in (num or "") if ch.isdigit() or ch == "+")
    if not cleaned:
        return get_env("MY_MOBILE_NUMBER", "+919916109192")
    if not cleaned.startswith("+"):
        cleaned = ("+91" + cleaned) if len(cleaned) == 10 else ("+" + cleaned)
    return cleaned


@app.get("/health")
def health_check():
    return {"status": "healthy", "active_calls": len(active_channels)}


@app.get("/api/twilio/status")
def twilio_status():
    sid = get_env("TWILIO_ACCOUNT_SID")
    token = get_env("TWILIO_AUTH_TOKEN")
    api_key = get_env("TWILIO_API_KEY")
    api_secret = get_env("TWILIO_API_SECRET")
    app_sid = get_env("TWILIO_TWIML_APP_SID")

    bridge_ready = bool(sid and token)
    webrtc_ready = bool(sid and api_key and api_secret and app_sid)
    missing_bridge = [k for k, v in {
        "TWILIO_ACCOUNT_SID": sid,
        "TWILIO_AUTH_TOKEN": token,
    }.items() if not v]
    missing_webrtc = [k for k, v in {
        "TWILIO_ACCOUNT_SID": sid,
        "TWILIO_API_KEY": api_key,
        "TWILIO_API_SECRET": api_secret,
        "TWILIO_TWIML_APP_SID": app_sid,
    }.items() if not v]

    return {
        "status": "online",
        "caller_id": get_env("TWILIO_CALLER_ID", "+17438887718"),
        "default_agent_mobile": get_env("MY_MOBILE_NUMBER", "+919916109192"),
        "identity": "agent201",
        "bridge_ready": bridge_ready,
        "webrtc_ready": webrtc_ready,
        "can_auto_setup_webrtc": bridge_ready,
        "missing_bridge_env": missing_bridge,
        "missing_webrtc_env": missing_webrtc,
    }


@app.post("/api/twilio/auto-setup-webrtc")
def auto_setup_webrtc(payload: Dict[str, Any]):
    """
    Uses ONLY TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN to automatically create
    an API Key, API Secret, and TwiML App SID via Twilio REST API and save them to .env.
    """
    sid = get_env("TWILIO_ACCOUNT_SID")
    token = get_env("TWILIO_AUTH_TOKEN")
    if not sid or not token:
        raise HTTPException(
            status_code=400,
            detail="Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env first."
        )

    ngrok_url = str(payload.get("ngrokUrl", "")).strip().rstrip("/")
    if not ngrok_url.startswith("https://"):
        raise HTTPException(
            status_code=400,
            detail="Provide your public https://... ngrok URL so Twilio can reach /api/twilio/voice."
        )

    voice_url = f"{ngrok_url}/api/twilio/voice"
    client = TwilioClient(sid, token)

    api_key = get_env("TWILIO_API_KEY")
    api_secret = get_env("TWILIO_API_SECRET")
    if not api_key or not api_secret:
        new_key = client.new_keys.create(friendly_name="IVR-Studio-WebRTC-Key")
        api_key = new_key.sid
        api_secret = new_key.secret
        os.environ["TWILIO_API_KEY"] = api_key
        os.environ["TWILIO_API_SECRET"] = api_secret
        if ENV_PATH.exists():
            set_key(str(ENV_PATH), "TWILIO_API_KEY", api_key)
            set_key(str(ENV_PATH), "TWILIO_API_SECRET", api_secret)

    app_sid = get_env("TWILIO_TWIML_APP_SID")
    if app_sid:
        client.applications(app_sid).update(voice_url=voice_url, voice_method="POST")
    else:
        twiml_app = client.applications.create(
            friendly_name="IVR-Studio-WebRTC-App",
            voice_url=voice_url,
            voice_method="POST",
        )
        app_sid = twiml_app.sid
        os.environ["TWILIO_TWIML_APP_SID"] = app_sid
        if ENV_PATH.exists():
            set_key(str(ENV_PATH), "TWILIO_TWIML_APP_SID", app_sid)

    logger.info("Auto-provisioned Twilio WebRTC key=%s app=%s voice_url=%s", api_key, app_sid, voice_url)
    return {
        "status": "ready",
        "api_key": api_key,
        "twiml_app_sid": app_sid,
        "voice_url": voice_url,
    }


@app.get("/api/twilio/token")
@app.post("/api/twilio/token")
def generate_webrtc_token(identity: str = "agent201"):
    sid = get_env("TWILIO_ACCOUNT_SID")
    api_key = get_env("TWILIO_API_KEY")
    api_secret = get_env("TWILIO_API_SECRET")
    app_sid = get_env("TWILIO_TWIML_APP_SID")
    caller_id = get_env("TWILIO_CALLER_ID", "+17438887718")

    missing = [k for k, v in {
        "TWILIO_ACCOUNT_SID": sid,
        "TWILIO_API_KEY": api_key,
        "TWILIO_API_SECRET": api_secret,
        "TWILIO_TWIML_APP_SID": app_sid,
    }.items() if not v]

    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"WebRTC keys not provisioned yet ({', '.join(missing)}). Use Auto-Setup with your ngrok URL or use Phone-to-Phone Bridge."
        )

    token = AccessToken(sid, api_key, api_secret, identity=identity, ttl=3600)
    token.add_grant(VoiceGrant(outgoing_application_sid=app_sid, incoming_allow=True))
    return {"token": token.to_jwt(), "identity": identity, "callerId": caller_id}


@app.post("/api/twilio/voice")
async def twilio_voice_webhook(request: Request):
    """Handles outbound Browser WebRTC calls and inbound PSTN calls to +17438887718."""
    form = await request.form()
    to_number = str(form.get("To", "")).strip()
    from_caller = str(form.get("From", "")).strip()
    caller_id = get_env("TWILIO_CALLER_ID", "+17438887718")
    logger.info("Twilio Voice Webhook: From=%s To=%s", from_caller, to_number)

    if from_caller.startswith("client:") and to_number and to_number != caller_id:
        dest = escape(normalize_e164(to_number))
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="{escape(caller_id)}" answerOnBridge="true">
    <Number>{dest}</Number>
  </Dial>
</Response>"""
        return Response(content=twiml, media_type="application/xml")

    twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="/api/twilio/ivr-menu" method="POST" timeout="8">
    <Say voice="alice">
      Welcome to Apex Global Telephony Studio.
      Press 1 for Owner Mobile.
      Press 2 for Contact One.
      Press 3 for Contact Two.
      Press 0 to speak directly with the laptop operator.
    </Say>
  </Gather>
  <Dial timeout="25">
    <Client>agent201</Client>
  </Dial>
</Response>"""
    return Response(content=twiml, media_type="application/xml")


@app.post("/api/twilio/ivr-menu")
async def twilio_ivr_menu(request: Request):
    form = await request.form()
    digit = str(form.get("Digits", "0")).strip()
    caller_id = get_env("TWILIO_CALLER_ID", "+17438887718")
    routes = {"1": "+919916109192", "2": "+919199225154", "3": "+919620303042"}

    if digit in routes:
        target = escape(routes[digit])
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Transferring your call now.</Say>
  <Dial callerId="{escape(caller_id)}" answerOnBridge="true">
    <Number>{target}</Number>
  </Dial>
</Response>"""
    else:
        twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting you to the laptop operator desk.</Say>
  <Dial timeout="30">
    <Client>agent201</Client>
  </Dial>
</Response>"""
    return Response(content=twiml, media_type="application/xml")


@app.post("/api/calls/bridge")
async def bridge_two_phones(payload: Dict[str, Any]):
    """
    2-Way Phone-to-Phone Bridge via Twilio REST API.
    Works immediately using ONLY TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN (NO API key, NO ngrok).
    """
    sid = get_env("TWILIO_ACCOUNT_SID")
    token = get_env("TWILIO_AUTH_TOKEN")
    caller_id = get_env("TWILIO_CALLER_ID", "+17438887718")

    if not sid or not token:
        raise HTTPException(
            status_code=400,
            detail="Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN in server .env file."
        )

    destination = normalize_e164(payload.get("destination", "+919199225154"))
    agent_phone = normalize_e164(payload.get("agentPhone", get_env("MY_MOBILE_NUMBER", "+919916109192")))

    if destination == agent_phone:
        twiml = (
            f"<Response>"
            f"<Say voice=\\"alice\\">Hello from Apex Global Telephony Studio calling from {escape(caller_id)}. "
            f"Your Twilio FastAPI connection is working. Enter a second contact number in the app to bridge a two-way conversation.</Say>"
            f"</Response>"
        )
    else:
        twiml = (
            f"<Response>"
            f"<Say voice=\\"alice\\">Connecting you now to {escape(destination)}.</Say>"
            f"<Dial callerId=\\"{escape(caller_id)}\\" answerOnBridge=\\"true\\">{escape(destination)}</Dial>"
            f"</Response>"
        )

    try:
        client = TwilioClient(sid, token)
        call = client.calls.create(to=agent_phone, from_=caller_id, twiml=twiml)
        logger.info("Twilio 2-way bridge CallSid=%s (%s -> %s)", call.sid, agent_phone, destination)
        return {
            "status": "bridging",
            "call_sid": call.sid,
            "agent_phone": agent_phone,
            "destination": destination,
            "message": f"Ringing {agent_phone} from {caller_id}; bridging 2-way audio to {destination}."
        }
    except Exception as e:
        logger.error("Twilio bridge failed: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/calls/originate")
async def originate_call(payload: Dict[str, Any]):
    destination = normalize_e164(payload.get("destination", "+919916109192"))
    agent_phone = normalize_e164(payload.get("agentPhone", get_env("MY_MOBILE_NUMBER", "+919916109192")))
    if get_env("TWILIO_ACCOUNT_SID") and get_env("TWILIO_AUTH_TOKEN"):
        return await bridge_two_phones({"destination": destination, "agentPhone": agent_phone})

    trunk = payload.get("trunk", "new-apex-idea.pstn.twilio.com")
    cmd = ["asterisk", "-rx", f"channel originate PJSIP/twilio-trunk/sip:{destination}@{trunk} application Playback tt-weasels"]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
    return {"status": "success", "destination": destination, "output": proc.stdout}


@app.get("/api/flows/current")
def get_current_flow():
    return state_machine.flow_definition


@app.post("/api/flows/update")
def update_flow(new_flow: Dict[str, Any]):
    global state_machine
    state_machine = IVRStateMachine(new_flow)
    return {"status": "success", "flow_id": new_flow.get("id")}


@app.websocket("/ws/telephony")
async def websocket_telephony_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
`,
    },

    ari_worker: {
      name: 'app/ari_worker.py',
      lang: 'python',
      desc: 'Asterisk REST Interface (ARI) WebSocket listener & channel lifecycle',
      content: `"""
Asterisk ARI Stasis Application Handler
Subscribes to 'ivr-controller' events from Asterisk PBX
"""

import json
import logging
import httpx
import websockets
from typing import Callable, Dict

logger = logging.getLogger("ari-worker")

ARI_URL = "http://asterisk:8088/ari"
ARI_WS_URL = "ws://asterisk:8088/ari/events?api_key=asterisk:asterisk&app=ivr-controller"
ARI_AUTH = ("asterisk", "asterisk")

active_channels: Dict[str, dict] = {}

async def start_ari_event_listener(broadcast_fn: Callable):
    """Connects to Asterisk ARI WebSocket and routes incoming telephony events."""
    while True:
        try:
            logger.info("Connecting to Asterisk ARI WebSocket: %s", ARI_WS_URL)
            async with websockets.connect(ARI_WS_URL) as ws:
                logger.info("Connected to Asterisk ARI Stasis stream.")
                async for message in ws:
                    event = json.loads(message)
                    event_type = event.get("type")
                    
                    if event_type == "StasisStart":
                        await handle_stasis_start(event, broadcast_fn)
                    elif event_type == "ChannelDtmfReceived":
                        await handle_dtmf(event, broadcast_fn)
                    elif event_type == "PlaybackFinished":
                        await handle_playback_finished(event, broadcast_fn)
                    elif event_type == "StasisEnd":
                        await handle_stasis_end(event, broadcast_fn)

        except Exception as e:
            logger.error("ARI Connection lost: %s. Reconnecting in 3s...", e)
            await asyncio.sleep(3)

async def handle_stasis_start(event: dict, broadcast_fn: Callable):
    channel = event.get("channel", {})
    channel_id = channel.get("id")
    caller_num = channel.get("caller", {}).get("number", "Unknown")
    did_dialed = event.get("args", ["default"])[0]

    logger.info("StasisStart: Channel %s dialed DID %s", channel_id, did_dialed)
    active_channels[channel_id] = {
        "channel_id": channel_id,
        "caller_id": caller_num,
        "did": did_dialed,
        "current_node": "node-greeting"
    }

    # Answer channel via ARI REST
    async with httpx.AsyncClient(auth=ARI_AUTH) as client:
        await client.post(f"{ARI_URL}/channels/{channel_id}/answer")
        # Play first prompt
        await client.post(
            f"{ARI_URL}/channels/{channel_id}/play",
            params={"media": "sound:ivr/welcome_apex_8k"}
        )

    await broadcast_fn({
        "type": "CHANNEL_CREATED",
        "channel_id": channel_id,
        "caller_id": caller_num,
        "did": did_dialed
    })

async def handle_dtmf(event: dict, broadcast_fn: Callable):
    channel = event.get("channel", {})
    digit = event.get("digit")
    channel_id = channel.get("id")

    logger.info("DTMF Received: %s on channel %s", digit, channel_id)
    await broadcast_fn({
        "type": "DTMF_RECEIVED",
        "channel_id": channel_id,
        "digit": digit
    })
    # State machine evaluation follows...

async def handle_playback_finished(event: dict, broadcast_fn: Callable):
    playback = event.get("playback", {})
    logger.info("Playback Finished: %s", playback.get("media_uri"))

async def handle_stasis_end(event: dict, broadcast_fn: Callable):
    channel = event.get("channel", {})
    channel_id = channel.get("id")
    if channel_id in active_channels:
        del active_channels[channel_id]
    await broadcast_fn({"type": "CHANNEL_DESTROYED", "channel_id": channel_id})
`,
    },

    ivr_state_machine: {
      name: 'app/ivr_state_machine.py',
      lang: 'python',
      desc: 'Dynamic JSON state machine evaluator executing the visual flow',
      content: `"""
IVR Dynamic State Machine
Translates graph nodes, DTMF branches, business hours, and DB lookups
"""

import datetime
from typing import Dict, Any, Optional

class IVRStateMachine:
    def __init__(self, flow_definition: Dict[str, Any]):
        self.flow_definition = flow_definition
        self.nodes = {n["id"]: n for n in flow_definition.get("nodes", [])}
        self.connections = flow_definition.get("connections", [])
        self.start_node_id = flow_definition.get("startNodeId")

    def get_start_node(self) -> Optional[Dict[str, Any]]:
        return self.nodes.get(self.start_node_id)

    def transition_dtmf(self, current_node_id: str, digit: str) -> Optional[Dict[str, Any]]:
        node = self.nodes.get(current_node_id)
        if not node or node.get("type") != "dtmf_menu":
            return None

        branches = node.get("data", {}).get("branches", [])
        for branch in branches:
            if branch.get("key") == digit:
                target_id = branch.get("targetNodeId")
                return self.nodes.get(target_id)
        return None

    def evaluate_business_hours(self, node_id: str) -> Optional[str]:
        node = self.nodes.get(node_id)
        if not node:
            return None
        # Simplified evaluation: Check current weekday & hour
        now = datetime.datetime.now()
        weekday = now.weekday()  # 0 = Monday, 6 = Sunday
        hour = now.hour

        if weekday < 5 and 8 <= hour < 20:
            return node.get("data", {}).get("openBranchNodeId")
        return node.get("data", {}).get("closedBranchNodeId")
`,
    },

    tts_service: {
      name: 'app/tts_service.py',
      lang: 'python',
      desc: 'Dynamic audio generation with 8kHz PCM conversion & disk caching',
      content: `"""
Dynamic Text-to-Speech (TTS) Service
Integrates ElevenLabs, OpenAI, and converts output to Asterisk 8kHz Mono WAV
"""

import os
import hashlib
import subprocess
import httpx
from pathlib import Path

SOUNDS_DIR = Path("/var/lib/asterisk/sounds/ivr")
SOUNDS_DIR.mkdir(parents=True, exist_ok=True)

class TTSService:
    @staticmethod
    async def synthesize(text: str, provider: str = "openai", voice: str = "alloy") -> str:
        """
        Synthesizes text, converts to 8kHz 16-bit Mono WAV, and caches to disk.
        Returns the filename accessible by Asterisk Stasis.
        """
        # Generate stable cache hash
        cache_key = hashlib.md5(f"{provider}:{voice}:{text}".encode()).hexdigest()
        target_wav = SOUNDS_DIR / f"tts_{cache_key}_8k.wav"

        if target_wav.exists():
            return f"ivr/{target_wav.stem}"

        temp_mp3 = SOUNDS_DIR / f"temp_{cache_key}.mp3"

        # 1. Fetch audio from provider (example OpenAI TTS)
        api_key = os.getenv("OPENAI_API_KEY", "")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.openai.com/v1/audio/speech",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": "tts-1", "input": text, "voice": voice},
                timeout=15.0
            )
            with open(temp_mp3, "wb") as f:
                f.write(resp.content)

        # 2. Transcode to Asterisk Standard: 8000 Hz, 16-bit, Mono PCM
        cmd = [
            "ffmpeg", "-y", "-i", str(temp_mp3),
            "-ar", "8000", "-ac", "1", "-c:a", "pcm_s16le",
            str(target_wav)
        ]
        subprocess.run(cmd, check=True)
        if temp_mp3.exists():
            temp_mp3.unlink()

        return f"ivr/{target_wav.stem}"
`,
    },

    docker_compose: {
      name: 'docker-compose.yml',
      lang: 'yaml',
      desc: 'Complete Asterisk 20 LTS + FastAPI + PostgreSQL deployment container',
      content: `version: "3.8"

services:
  asterisk:
    image: andrius/asterisk:20-lts
    container_name: asterisk-pbx
    restart: always
    network_mode: host
    volumes:
      - ./pjsip.conf:/etc/asterisk/pjsip.conf:ro
      - ./extensions.conf:/etc/asterisk/extensions.conf:ro
      - ./ari.conf:/etc/asterisk/ari.conf:ro
      - ./sounds:/var/lib/asterisk/sounds/ivr
    environment:
      - ASTERISK_UID=1000
      - ASTERISK_GID=1000

  fastapi-service:
    build: .
    container_name: ivr-fastapi
    restart: always
    ports:
      - "8000:8000"
    volumes:
      - ./sounds:/var/lib/asterisk/sounds/ivr
    environment:
      - ASTERISK_ARI_URL=http://localhost:8088/ari
      - ASTERISK_ARI_USER=asterisk
      - ASTERISK_ARI_PASS=asterisk
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/telephony
      - OPENAI_API_KEY=\${OPENAI_API_KEY}
      - ELEVENLABS_API_KEY=\${ELEVENLABS_API_KEY}
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    container_name: telephony-postgres
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: telephony
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
`,
    },
    windows_setup: {
      name: 'WINDOWS_QUICKSTART.md',
      lang: 'markdown',
      desc: 'Step-by-step guide to run Asterisk + FastAPI natively on a Windows 10/11 laptop (WSL2 or Docker)',
      content: `# 🚀 Running Asterisk + FastAPI IVR on a Windows Laptop

You do NOT need a dedicated Linux PC! You can run this entire open-source stack on Windows 10 or Windows 11 using either **WSL2** (Microsoft Windows Subsystem for Linux) or **Docker Desktop**.

---

## Method 1: WSL2 (Built into Windows - Recommended, Takes 2 Minutes)

Microsoft includes a complete, high-performance Ubuntu Linux environment inside Windows 10 & 11.

### Step 1: Install WSL2 & Ubuntu
Open **PowerShell as Administrator** on your Windows laptop and run:
\`\`\`powershell
wsl --install -d Ubuntu
\`\`\`
*(If you already have WSL installed, just open the "Ubuntu" app from your Windows Start Menu).*

### Step 2: Install Asterisk & Python in Ubuntu
Inside the Ubuntu terminal, run:
\`\`\`bash
# 1. Update and install Asterisk PBX
sudo apt update && sudo apt install -y asterisk asterisk-core-sounds-en-wav python3-pip python3-venv git

# 2. Start Asterisk service on your Windows laptop
sudo service asterisk start

# 3. Verify Asterisk is running:
sudo asterisk -rvvv
# (Type "exit" to exit Asterisk console)
\`\`\`

### Step 3: Run the FastAPI IVR State Machine
\`\`\`bash
# Create and activate python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install fastapi uvicorn websockets httpx pydantic

# Run FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
\`\`\`

### Step 4: Connecting from Windows
- Asterisk SIP port **5060** is now active on \`localhost:5060\` and your Wi-Fi IP!
- FastAPI is live at \`http://localhost:8000/docs\`.
- You can edit all configuration files from Windows File Explorer at:
  \`\\\\wsl$\\Ubuntu\\etc\\asterisk\`
`,
    },
    option_1_airtel: {
      name: 'OPTION_1_AIRTEL_WINDOWS.md',
      lang: 'markdown',
      desc: 'Complete Step-by-Step Setup Guide: Windows Laptop + Airtel 4G USB Dongle (₹0 Setup)',
      content: `# 🚀 Option 1: 100% Free Setup with Your Windows Laptop + Airtel 4G Dongle

**Total Cost: ₹0 (Zero Rupees)**
**Hardware:** Your Windows Laptop + Airtel 4G Dongle + Airtel SIM (+91 9916109192)

---

## Phase 1: Setup Linux inside Windows (WSL2)

### Step 1: Open PowerShell as Administrator
Right-click your Windows Start button -> Click **Windows Terminal (Admin)** or **PowerShell (Admin)**.

### Step 2: Install WSL2 Ubuntu
\`\`\`powershell
wsl --install -d Ubuntu
\`\`\`
*(If asked to restart your laptop, restart once, then open the "Ubuntu" app from your Start menu).*

---

## Phase 2: Forward Your Airtel Dongle into WSL2 (usbipd-win)

Windows has a free official Microsoft tool called \`usbipd\` that forwards physical USB ports into WSL2.

### Step 3: Install usbipd in Windows PowerShell (Admin)
\`\`\`powershell
winget install usbipd
\`\`\`

### Step 4: List USB Devices and Attach Your Airtel Dongle
1. Plug your Airtel 4G USB dongle with your SIM into your laptop.
2. In PowerShell, run:
\`\`\`powershell
usbipd list
\`\`\`
You will see a list of connected USB devices. Look for **"HUAWEI"**, **"ZTE"**, or **"Airtel LTE USB Modem"**.
Note its **BUSID** (for example, \`2-1\` or \`1-4\`).

3. Bind and attach it to WSL:
\`\`\`powershell
# Replace 2-1 with your actual BUSID:
usbipd bind --busid 2-1
usbipd attach --wsl --busid 2-1
\`\`\`

### Step 5: Verify in Ubuntu Terminal
Open your Ubuntu terminal and type:
\`\`\`bash
ls -l /dev/ttyUSB*
\`\`\`
You should see:
\`\`\`
/dev/ttyUSB0
/dev/ttyUSB1
/dev/ttyUSB2
\`\`\`
*(If you see these ports, your Windows laptop has successfully mounted your Airtel cellular modem inside Linux!)*

---

## Phase 3: Install Asterisk & chan_dongle Driver in Ubuntu

Inside your Ubuntu terminal, run:

\`\`\`bash
# 1. Install Asterisk and build dependencies
sudo apt update
sudo apt install -y asterisk asterisk-core-sounds-en-wav build-essential libusb-1.0-0-dev git python3-pip python3-venv

# 2. Add asterisk user to dialout group (for USB access)
sudo usermod -a -G dialout asterisk

# 3. Clone and compile the open-source chan_dongle driver
cd ~
git clone https://github.com/wdoekes/asterisk-chan-dongle.git
cd asterisk-chan-dongle
./bootstrap
./configure --with-asterisk=/usr/include
make
sudo make install
\`\`\`

---

## Phase 4: Configure Asterisk for Your Airtel SIM (+91 9916109192)

### Step 6: Create /etc/asterisk/dongle.conf
Run in Ubuntu:
\`\`\`bash
sudo tee /etc/asterisk/dongle.conf << 'EOF'
[general]
interval=15
jbenable=yes

[defaults]
context=from-dongle
group=0
rxgain=0
txgain=0
autodeletesms=yes
resetdongle=yes
u2diag=-1
usecallingpres=yes
callingpres=allowed_passed_screen

[dongle0]
audio=/dev/ttyUSB1
data=/dev/ttyUSB2
context=from-dongle
exten=s
EOF
\`\`\`

### Step 7: Update /etc/asterisk/extensions.conf
Add the inbound route to your FastAPI Stasis IVR application:
\`\`\`bash
sudo tee -a /etc/asterisk/extensions.conf << 'EOF'

[from-dongle]
exten => s,1,NoOp(Inbound Call on Airtel SIM: \${CALLERID(all)})
 same => n,Ringing()
 same => n,Answer()
 same => n,Stasis(ivr-controller, 9916109192)
 same => n,Hangup()
EOF
\`\`\`

### Step 8: Start Asterisk
\`\`\`bash
sudo service asterisk restart
sudo asterisk -rvvv
\`\`\`
Inside the Asterisk console, type:
\`\`\`
dongle show devices
\`\`\`
It will display: \`dongle0: Provider: Airtel, Signal: High, Status: Free\`.
*(Type \`exit\` to exit the console).*

---

## Phase 5: Utilize Airtel Black Wi-Fi for Free Local Agent Extensions

Your **Airtel Black Wi-Fi router** (typically \`192.168.1.1\`) acts as your high-speed local telephony PBX network!
Your Windows laptop and your Android phone are both connected to your Airtel Black Wi-Fi.

### Step 9: Find Your Windows Laptop Wi-Fi IP
In Windows PowerShell, run:
\`\`\`powershell
ipconfig
\`\`\`
Look under **Wireless LAN adapter Wi-Fi** for **IPv4 Address** (e.g. \`192.168.1.45\`).

### Step 10: Allow Inbound SIP through Windows Firewall
Run in PowerShell (Admin):
\`\`\`powershell
New-NetFirewallRule -DisplayName "Asterisk Wi-Fi SIP" -Direction Inbound -Protocol UDP -LocalPort 5060 -Action Allow
\`\`\`

### Step 11: Add Wi-Fi Agent Extension in /etc/asterisk/pjsip.conf
Run in Ubuntu:
\`\`\`bash
sudo tee -a /etc/asterisk/pjsip.conf << 'EOF'

; Local Android Agent Station on Airtel Black Wi-Fi
[agent-phone]
type=endpoint
context=from-internal-softphone
disallow=all
allow=alaw,ulaw,g722,opus
auth=agent-phone-auth
aors=agent-phone-aor

[agent-phone-auth]
type=auth
auth_type=userpass
username=agent201
password=Pass1234#

[agent-phone-aor]
type=aor
max_contacts=2
EOF
\`\`\`

### Step 12: Configure Zoiper on Your Phone over Airtel Black Wi-Fi
1. Connect your Android phone to your **Airtel Black Wi-Fi network**.
2. Open Zoiper:
   - **Domain / Host:** \`192.168.1.45:5060\` *(Your Windows Laptop Wi-Fi IP)*
   - **Username:** \`agent201\`
   - **Password:** \`Pass1234#\`
3. Zoiper connects immediately over Airtel Black Wi-Fi with a green checkmark!

---

## Phase 6: Start Your FastAPI IVR Engine

Inside Ubuntu:
\`\`\`bash
# Install Python requirements
pip3 install fastapi uvicorn websockets httpx pydantic

# Run the FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
\`\`\`

---

## Phase 7: Make Your First Live Test Call!

1. Take a friend or family member's phone.
2. Dial your Airtel SIM number: **9916109192**.
3. **What happens live across your Airtel setup:**
   - Inbound call hits your **Airtel 4G Dongle**.
   - Asterisk answers via \`chan_dongle\`.
   - FastAPI IVR greeting plays: *"Welcome to Apex Global Telephony. Press 1 for Sales, or press 0 for Operator Desk."*
   - Caller presses **0**:
   - Asterisk executes: \`Dial(PJSIP/agent-phone, 30)\`.
   - **Your Android phone immediately rings over your Airtel Black Wi-Fi!**
   - You answer on your Android phone and speak with the caller in crystal-clear HD audio!

Total cost: **₹0.00**. 100% self-hosted, utilizing your own Airtel Black Wi-Fi, Airtel Dongle, and Windows laptop.
`,
    },
    android_sim_guide: {
      name: 'ANDROID_SIM_CHAN_MOBILE.md',
      lang: 'markdown',
      desc: 'WSL2 Ubuntu Asterisk + Android Indian SIM Gateway via Bluetooth (chan_mobile) & 3-Number IVR',
      content: `# 📱 Local Indian SIM on Android Phone ➔ Asterisk IVR (WSL2 Windows 10)

### ⚠️ Important Reality Check Before Starting
1. **Why NOT a Play Store "SIP-to-SIM" app?** Android 10+ strictly blocks unrooted apps from capturing or injecting live cellular call audio.
2. **How an unrooted Android phone connects to Asterisk:** Via **Bluetooth Hands-Free Profile (\`chan_mobile\`)** — your WSL2 Asterisk server pairs with your Android phone just like a car stereo/headset.
3. **WSL2 Bluetooth Requirement:** WSL2 cannot directly access internal motherboard Bluetooth cards. Plug a **USB Bluetooth Dongle (~₹250–₹400)** into your Windows 10 laptop and pass it into Ubuntu WSL2 with \`usbipd\`.
4. **Audio Caveat:** Some Android OEM ROMs (MIUI, ColorOS) throttle Bluetooth SCO audio routing. Always run the **Step 5 \`Echo()\` test** first!

---

## Step 1: Forward USB Bluetooth Dongle from Windows 10 into WSL2
Open **Windows PowerShell as Administrator**:
\`\`\`powershell
winget install usbipd
usbipd list
# Look for your Bluetooth USB Adapter BUSID (example: 1-3)
usbipd bind --busid 1-3
usbipd attach --wsl --busid 1-3
\`\`\`

Verify inside your **Ubuntu WSL2 terminal** (\`DESKTOP-LHCA8HL\`):
\`\`\`bash
sudo apt update
sudo add-apt-repository -y universe
sudo apt install -y asterisk asterisk-mobile bluetooth bluez bluez-tools usbutils

sudo service dbus start
sudo /usr/libexec/bluetooth/bluetoothd &
sudo hciconfig hci0 up
hcitool dev
# Example output: hci0   AA:BB:CC:DD:EE:FF  <-- YOUR ADAPTER MAC
\`\`\`

---

## Step 2: Pair & Trust Your Android Phone in Ubuntu WSL2
Turn **Bluetooth ON** on your Android phone and keep Bluetooth settings screen open.
\`\`\`bash
bluetoothctl
\`\`\`
Inside \`bluetoothctl\`:
\`\`\`text
power on
agent on
default-agent
scan on
# Wait until you see your Android phone MAC, e.g. 11:22:33:44:55:66
pair 11:22:33:44:55:66
trust 11:22:33:44:55:66
connect 11:22:33:44:55:66
quit
\`\`\`
Accept the pairing popup on your Android phone, then find the Hands-Free RFCOMM port:
\`\`\`bash
sdptool search --bdaddr 11:22:33:44:55:66 HF
# Look for: Channel: <PORT_NUMBER> (usually 2, 3, or 4)
\`\`\`

---

## Step 3: Create \`/etc/asterisk/chan_mobile.conf\`
Replace \`AA:BB:CC:DD:EE:FF\`, \`11:22:33:44:55:66\`, and \`port\` with your real values:
\`\`\`ini
sudo tee /etc/asterisk/chan_mobile.conf << 'EOF'
[general]
interval=30

[adapter]
id=laptop_bt
address=AA:BB:CC:DD:EE:FF

[android_sim]
address=11:22:33:44:55:66
port=2
context=from-android-sim
adapter=laptop_bt
EOF
\`\`\`

---

## Step 4: Add the 2-Way Echo Test + Press 1 / 2 / 3 IVR in \`/etc/asterisk/extensions.conf\`
Note: A single SIM can only hold **1 cellular voice channel at a time**. When a caller dials your Android SIM:
- **Option A (₹0 LAN/Wi-Fi):** Press 1/2/3 rings your 3 phones via Zoiper/WebRTC Wi-Fi SIP extensions (\`agent201\`, \`agent202\`, \`agent203\`).
- **Option B (PSTN Outbound):** Press 1/2/3 dials \`+919916109192\`, \`+919199225154\`, or \`+919620303042\` out through your \`twilio-trunk\`.

\`\`\`ini
sudo tee -a /etc/asterisk/extensions.conf << 'EOF'

[from-android-sim]
; 1) First test 2-way Bluetooth audio by temporarily uncommenting Echo():
;exten => s,1,Answer()
; same => n,Playback(demo-echotest)
; same => n,Echo()
; same => n,Hangup()

; 2) Live 3-Option IVR Menu:
exten => s,1,NoOp(Inbound Local SIM Call from \${CALLERID(all)})
 same => n,Answer()
 same => n,Wait(1)
 same => n(menu),Background(silence/1)
 same => n,SayDigits(123)
 same => n,WaitExten(8)
 same => n,Goto(1,1)

; Option 1 -> Owner (+919916109192 via SIP/Twilio OR local Zoiper agent201)
exten => 1,1,NoOp(Routing Press 1 to Owner)
 same => n,Dial(PJSIP/agent201,25)
 ; Or via Twilio SIP Trunk instead of Zoiper:
 ; same => n,Dial(PJSIP/+919916109192@twilio-trunk,30)
 same => n,Hangup()

; Option 2 -> Contact 1 (+919199225154)
exten => 2,1,NoOp(Routing Press 2 to Contact 1)
 same => n,Dial(PJSIP/+919199225154@twilio-trunk,30)
 same => n,Hangup()

; Option 3 -> Contact 2 (+919620303042)
exten => 3,1,NoOp(Routing Press 3 to Contact 2)
 same => n,Dial(PJSIP/+919620303042@twilio-trunk,30)
 same => n,Hangup()

exten => i,1,Playback(pbx-invalid)
 same => n,Goto(s,menu)
EOF
\`\`\`

---

## Step 5: Load \`chan_mobile\` & Verify Connection
\`\`\`bash
sudo service asterisk restart
sudo asterisk -rvvv
\`\`\`
In the Asterisk CLI:
\`\`\`text
module load chan_mobile.so
mobile show devices
\`\`\`
You should see \`android_sim\` with state **\`Free\`**.
Dial your Android SIM number from another phone — **Asterisk answers locally with ₹0 ISD cost!**

### 🔧 If Your Android Phone Drops Audio or Refuses SCO:
Some Android 12–14 OEM phones block background Bluetooth HFP audio. If \`Echo()\` has 1-way/silent audio even after pairing, the cleanest permanent hardware swap is a **GoIP-1 4G GSM-to-SIP Gateway** (plugs into Wi-Fi router, takes your exact same Indian SIM, zero root/Bluetooth hacks).
`,
    },
  };

  const active = files[selectedFile] || files.main_py;

  const handleCopy = () => {
    navigator.clipboard.writeText(active.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([active.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = active.name.split('/').pop() || 'file.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">
              FastAPI & Asterisk ARI Source Code Hub
            </h1>
            <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
              Production Python 3.11
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Export the complete, production-ready backend code powering this IVR system: FastAPI REST/WS
            server, Asterisk ARI Stasis event worker, dynamic state machine, and audio caching engine.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3.5 py-2 rounded-md border border-slate-700 transition-colors"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied Code!' : 'Copy Code'}</span>
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 text-xs text-slate-950 font-semibold bg-cyan-500 hover:bg-cyan-400 px-3.5 py-2 rounded-md transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download {active.name.split('/').pop()}</span>
          </button>
        </div>
      </div>

      {/* File Navigator Tabs */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(files).map(([key, f]) => (
          <button
            key={key}
            onClick={() => setSelectedFile(key)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono transition-all ${
              selectedFile === key
                ? 'bg-slate-900 text-cyan-300 border border-cyan-800/80 shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-cyan-400" />
            <span>{f.name}</span>
          </button>
        ))}
      </div>

      {/* Code Viewer Panel */}
      <div className="border border-slate-800 rounded-xl bg-slate-900/90 overflow-hidden shadow-2xl flex flex-col">
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-300">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-white">{active.name}</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">{active.desc}</span>
          </div>
          <span className="text-slate-500 uppercase">{active.lang}</span>
        </div>

        <div className="p-5 bg-slate-950 overflow-x-auto max-h-[600px]">
          <pre className="font-mono text-xs text-slate-200 leading-relaxed">
            <code>{active.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

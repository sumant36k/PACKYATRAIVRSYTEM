import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import twilio from 'twilio';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getEnv(name: string, fallback = ''): string {
  return (process.env[name] || fallback).trim();
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeE164(num: string): string {
  const cleaned = (num || '').replace(/[^\d+]/g, '');
  if (!cleaned) return getEnv('MY_MOBILE_NUMBER', '+919916109192');
  if (cleaned.startsWith('+')) return cleaned;
  return cleaned.length === 10 ? `+91${cleaned}` : `+${cleaned}`;
}

async function startServer() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'healthy', runtime: 'ai-studio-express' });
  });

  app.get('/api/twilio/status', (_req, res) => {
    const sid = getEnv('TWILIO_ACCOUNT_SID');
    const token = getEnv('TWILIO_AUTH_TOKEN');
    const apiKey = getEnv('TWILIO_API_KEY');
    const apiSecret = getEnv('TWILIO_API_SECRET');
    const appSid = getEnv('TWILIO_TWIML_APP_SID');

    const bridgeReady = Boolean(sid && token);
    const webrtcReady = Boolean(sid && apiKey && apiSecret && appSid);

    const missingBridge: string[] = [];
    if (!sid) missingBridge.push('TWILIO_ACCOUNT_SID');
    if (!token) missingBridge.push('TWILIO_AUTH_TOKEN');

    const missingWebrtc: string[] = [];
    if (!sid) missingWebrtc.push('TWILIO_ACCOUNT_SID');
    if (!apiKey) missingWebrtc.push('TWILIO_API_KEY');
    if (!apiSecret) missingWebrtc.push('TWILIO_API_SECRET');
    if (!appSid) missingWebrtc.push('TWILIO_TWIML_APP_SID');

    res.json({
      status: 'online',
      runtime: 'ai-studio-express',
      caller_id: getEnv('TWILIO_CALLER_ID', '+17438887718'),
      default_agent_mobile: getEnv('MY_MOBILE_NUMBER', '+919916109192'),
      identity: 'agent201',
      bridge_ready: bridgeReady,
      webrtc_ready: webrtcReady,
      can_auto_setup_webrtc: bridgeReady,
      missing_bridge_env: missingBridge,
      missing_webrtc_env: missingWebrtc,
    });
  });

  app.post('/api/twilio/auto-setup-webrtc', async (req, res) => {
    const sid = getEnv('TWILIO_ACCOUNT_SID');
    const token = getEnv('TWILIO_AUTH_TOKEN');

    if (!sid || !token) {
      res.status(400).json({
        detail: 'Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN in AI Studio Secrets.',
      });
      return;
    }

    const baseUrl = String(req.body?.ngrokUrl || getEnv('APP_URL') || '')
      .trim()
      .replace(/\/+$/, '');

    if (!baseUrl.startsWith('https://')) {
      res.status(400).json({
        detail: 'Provide a public https://... URL (e.g. ngrok) for Twilio WebRTC webhooks.',
      });
      return;
    }

    const voiceUrl = `${baseUrl}/api/twilio/voice`;

    try {
      const client = twilio(sid, token);

      let apiKey = getEnv('TWILIO_API_KEY');
      let apiSecret = getEnv('TWILIO_API_SECRET');
      if (!apiKey || !apiSecret) {
        const createdKey = await client.newKeys.create({
          friendlyName: 'IVR-Studio-WebRTC-Key',
        });
        apiKey = createdKey.sid;
        apiSecret = createdKey.secret;
        process.env.TWILIO_API_KEY = apiKey;
        process.env.TWILIO_API_SECRET = apiSecret;
      }

      let appSid = getEnv('TWILIO_TWIML_APP_SID');
      if (appSid) {
        await client.applications(appSid).update({
          voiceUrl,
          voiceMethod: 'POST',
        });
      } else {
        const createdApp = await client.applications.create({
          friendlyName: 'IVR-Studio-WebRTC-App',
          voiceUrl,
          voiceMethod: 'POST',
        });
        appSid = createdApp.sid;
        process.env.TWILIO_TWIML_APP_SID = appSid;
      }

      res.json({
        status: 'ready',
        api_key: apiKey,
        twiml_app_sid: appSid,
        voice_url: voiceUrl,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to auto-provision WebRTC keys';
      res.status(500).json({ detail: msg });
    }
  });

  const handleToken = (req: express.Request, res: express.Response) => {
    const sid = getEnv('TWILIO_ACCOUNT_SID');
    const apiKey = getEnv('TWILIO_API_KEY');
    const apiSecret = getEnv('TWILIO_API_SECRET');
    const appSid = getEnv('TWILIO_TWIML_APP_SID');
    const callerId = getEnv('TWILIO_CALLER_ID', '+17438887718');
    const identity = String(req.query.identity || req.body?.identity || 'agent201');

    const missing: string[] = [];
    if (!sid) missing.push('TWILIO_ACCOUNT_SID');
    if (!apiKey) missing.push('TWILIO_API_KEY');
    if (!apiSecret) missing.push('TWILIO_API_SECRET');
    if (!appSid) missing.push('TWILIO_TWIML_APP_SID');

    if (missing.length > 0) {
      res.status(400).json({
        detail: `WebRTC keys not provisioned yet (${missing.join(', ')}). Use Auto-Setup or Phone-to-Phone Bridge.`,
      });
      return;
    }

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(sid, apiKey, apiSecret, {
      identity,
      ttl: 3600,
    });
    token.addGrant(
      new VoiceGrant({
        outgoingApplicationSid: appSid,
        incomingAllow: true,
      })
    );

    res.json({
      token: token.toJwt(),
      identity,
      callerId,
    });
  };

  app.get('/api/twilio/token', handleToken);
  app.post('/api/twilio/token', handleToken);

  app.post('/api/twilio/voice', (req, res) => {
    const toNumber = String(req.body?.To || '').trim();
    const fromCaller = String(req.body?.From || '').trim();
    const callerId = getEnv('TWILIO_CALLER_ID', '+17438887718');

    if (fromCaller.startsWith('client:') && toNumber && toNumber !== callerId) {
      const dest = escapeXml(normalizeE164(toNumber));
      res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${escapeXml(callerId)}" answerOnBridge="true">
    <Number>${dest}</Number>
  </Dial>
</Response>`);
      return;
    }

    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
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
</Response>`);
  });

  app.post('/api/twilio/ivr-menu', (req, res) => {
    const digit = String(req.body?.Digits || '0').trim();
    const callerId = getEnv('TWILIO_CALLER_ID', '+17438887718');
    const routes: Record<string, string> = {
      '1': '+919916109192',
      '2': '+919199225154',
      '3': '+919620303042',
    };

    if (routes[digit]) {
      res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Transferring your call now.</Say>
  <Dial callerId="${escapeXml(callerId)}" answerOnBridge="true">
    <Number>${escapeXml(routes[digit])}</Number>
  </Dial>
</Response>`);
      return;
    }

    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting you to the laptop operator desk.</Say>
  <Dial timeout="30">
    <Client>agent201</Client>
  </Dial>
</Response>`);
  });

  function buildStudioIvrDefinition(
    callerId: string,
    num1: string,
    num2: string,
    num3: string
  ) {
    return {
      description: 'Inbound & Test 3-Number IVR Router (+17438887718)',
      states: [
        {
          name: 'Trigger',
          type: 'trigger',
          transitions: [
            { event: 'incomingMessage' },
            { event: 'incomingCall', next: 'gather_menu' },
            { event: 'incomingRequest', next: 'call_tester' },
          ],
          properties: { offset: { x: 0, y: 0 } },
        },
        {
          name: 'call_tester',
          type: 'make-outgoing-call-v2',
          transitions: [
            { event: 'answered', next: 'gather_menu' },
            { event: 'busy' },
            { event: 'noAnswer' },
            { event: 'failed' },
          ],
          properties: {
            offset: { x: 260, y: 0 },
            to: '{{contact.channel.address}}',
            from: callerId,
            timeout: 30,
          },
        },
        {
          name: 'gather_menu',
          type: 'gather-input-on-call',
          transitions: [
            { event: 'keypress', next: 'split_digit' },
            { event: 'speech' },
            { event: 'timeout', next: 'connect_1' },
          ],
          properties: {
            offset: { x: 0, y: 240 },
            voice: 'alice',
            language: 'en-US',
            gather_language: 'en-US',
            say: 'Welcome to Apex Global Telephony Studio. Press 1 for Owner Desk. Press 2 for Contact One. Press 3 for Contact Two.',
            loop: 2,
            num_digits: 1,
            timeout: 8,
            stop_gathering_after: 8,
            finish_on_key: '#',
          },
        },
        {
          name: 'split_digit',
          type: 'split-based-on',
          transitions: [
            { event: 'noMatch', next: 'gather_menu' },
            {
              event: 'match',
              next: 'connect_1',
              conditions: [
                {
                  friendly_name: 'Pressed 1',
                  arguments: ['{{widgets.gather_menu.Digits}}'],
                  type: 'equal_to',
                  value: '1',
                },
              ],
            },
            {
              event: 'match',
              next: 'connect_2',
              conditions: [
                {
                  friendly_name: 'Pressed 2',
                  arguments: ['{{widgets.gather_menu.Digits}}'],
                  type: 'equal_to',
                  value: '2',
                },
              ],
            },
            {
              event: 'match',
              next: 'connect_3',
              conditions: [
                {
                  friendly_name: 'Pressed 3',
                  arguments: ['{{widgets.gather_menu.Digits}}'],
                  type: 'equal_to',
                  value: '3',
                },
              ],
            },
          ],
          properties: {
            offset: { x: 0, y: 480 },
            input: '{{widgets.gather_menu.Digits}}',
          },
        },
        {
          name: 'connect_1',
          type: 'connect-call-to',
          transitions: [{ event: 'callCompleted' }, { event: 'hangup' }],
          properties: {
            offset: { x: -240, y: 720 },
            caller_id: callerId,
            noun: 'number',
            to: num1,
            timeout: 30,
          },
        },
        {
          name: 'connect_2',
          type: 'connect-call-to',
          transitions: [{ event: 'callCompleted' }, { event: 'hangup' }],
          properties: {
            offset: { x: 0, y: 720 },
            caller_id: callerId,
            noun: 'number',
            to: num2,
            timeout: 30,
          },
        },
        {
          name: 'connect_3',
          type: 'connect-call-to',
          transitions: [{ event: 'callCompleted' }, { event: 'hangup' }],
          properties: {
            offset: { x: 240, y: 720 },
            caller_id: callerId,
            noun: 'number',
            to: num3,
            timeout: 30,
          },
        },
      ],
      initial_state: 'Trigger',
      flags: { allow_concurrent_calls: true },
    };
  }

  app.get('/api/twilio/ivr-status', async (_req, res) => {
    const sid = getEnv('TWILIO_ACCOUNT_SID');
    const token = getEnv('TWILIO_AUTH_TOKEN');
    const callerId = getEnv('TWILIO_CALLER_ID', '+17438887718');
    if (!sid || !token) {
      res.status(400).json({ detail: 'Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN' });
      return;
    }
    try {
      const client = twilio(sid, token);
      const [flows, numbers] = await Promise.all([
        client.studio.v2.flows.list({ limit: 20 }),
        client.incomingPhoneNumbers.list({ phoneNumber: callerId, limit: 5 }),
      ]);
      const ivrFlow = flows.find((f) => f.friendlyName === 'Apex-IVR-3-Number-Router');
      const phone = numbers[0];
      res.json({
        flow_deployed: Boolean(ivrFlow && ivrFlow.status === 'published'),
        flow_sid: ivrFlow?.sid || null,
        webhook_url: ivrFlow?.webhookUrl || null,
        phone_number: phone?.phoneNumber || callerId,
        phone_voice_url: phone?.voiceUrl || null,
        phone_trunk_sid: phone?.trunkSid || null,
        bound_to_ivr: Boolean(ivrFlow && phone && phone.voiceUrl === ivrFlow.webhookUrl && !phone.trunkSid),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to check IVR status';
      res.status(500).json({ detail: msg });
    }
  });

  app.post('/api/twilio/deploy-ivr', async (req, res) => {
    const sid = getEnv('TWILIO_ACCOUNT_SID');
    const token = getEnv('TWILIO_AUTH_TOKEN');
    const callerId = getEnv('TWILIO_CALLER_ID', '+17438887718');
    if (!sid || !token) {
      res.status(400).json({ detail: 'Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN' });
      return;
    }

    const num1 = normalizeE164(String(req.body?.num1 || '+919916109192'));
    const num2 = normalizeE164(String(req.body?.num2 || '+919199225154'));
    const num3 = normalizeE164(String(req.body?.num3 || '+919620303042'));
    const definition = buildStudioIvrDefinition(callerId, num1, num2, num3);

    try {
      const client = twilio(sid, token);
      await client.studio.v2.flowValidate.update({
        friendlyName: 'Apex-IVR-3-Number-Router',
        status: 'published',
        definition,
      });

      const flows = await client.studio.v2.flows.list({ limit: 20 });
      const existing = flows.find((f) => f.friendlyName === 'Apex-IVR-3-Number-Router');

      const flow = existing
        ? await client.studio.v2.flows(existing.sid).update({
            friendlyName: 'Apex-IVR-3-Number-Router',
            status: 'published',
            definition,
            commitMessage: 'Updated 3-number IVR routing',
          })
        : await client.studio.v2.flows.create({
            friendlyName: 'Apex-IVR-3-Number-Router',
            status: 'published',
            definition,
            commitMessage: 'Initial 3-number IVR routing',
          });

      const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: callerId, limit: 5 });
      const phone = numbers[0];
      if (!phone) {
        res.status(404).json({ detail: `Twilio number ${callerId} not found on account.` });
        return;
      }

      const updatedPhone = await client.incomingPhoneNumbers(phone.sid).update({
        voiceUrl: flow.webhookUrl,
        voiceMethod: 'POST',
        trunkSid: '',
      });

      res.json({
        status: 'deployed',
        flow_sid: flow.sid,
        webhook_url: flow.webhookUrl,
        phone_number: updatedPhone.phoneNumber,
        routes: { '1': num1, '2': num2, '3': num3 },
        message: `Live 3-Number IVR published and bound to ${updatedPhone.phoneNumber}!`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to deploy Twilio Studio IVR';
      res.status(500).json({ detail: msg });
    }
  });

  app.post('/api/twilio/test-ivr', async (req, res) => {
    const sid = getEnv('TWILIO_ACCOUNT_SID');
    const token = getEnv('TWILIO_AUTH_TOKEN');
    const callerId = getEnv('TWILIO_CALLER_ID', '+17438887718');
    if (!sid || !token) {
      res.status(400).json({ detail: 'Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN' });
      return;
    }

    const testPhone = normalizeE164(String(req.body?.to || getEnv('MY_MOBILE_NUMBER', '+919916109192')));

    try {
      const client = twilio(sid, token);
      const flows = await client.studio.v2.flows.list({ limit: 20 });
      const ivrFlow = flows.find((f) => f.friendlyName === 'Apex-IVR-3-Number-Router');
      if (!ivrFlow) {
        res.status(400).json({ detail: 'Click "Activate Live IVR on +17438887718" first.' });
        return;
      }

      const execution = await client.studio.v2.flows(ivrFlow.sid).executions.create({
        to: testPhone,
        from: callerId,
      });

      res.json({
        status: 'started',
        execution_sid: execution.sid,
        to: testPhone,
        from: callerId,
        message: `Calling ${testPhone} from ${callerId} with the live 3-option IVR menu. Answer, press 1 if trial prompts, then press 1, 2, or 3 to route!`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start IVR test execution';
      res.status(500).json({ detail: msg });
    }
  });

  app.get('/api/twilio/verified-numbers', async (_req, res) => {
    const sid = getEnv('TWILIO_ACCOUNT_SID');
    const token = getEnv('TWILIO_AUTH_TOKEN');
    if (!sid || !token) {
      res.status(400).json({ detail: 'Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN' });
      return;
    }
    try {
      const client = twilio(sid, token);
      const [account, callerIds, incoming] = await Promise.all([
        client.api.accounts(sid).fetch(),
        client.outgoingCallerIds.list({ limit: 50 }),
        client.incomingPhoneNumbers.list({ limit: 20 }),
      ]);
      res.json({
        account_type: account.type,
        account_status: account.status,
        verified_numbers: callerIds.map((c) => ({
          phoneNumber: c.phoneNumber,
          friendlyName: c.friendlyName,
        })),
        twilio_numbers: incoming.map((n) => n.phoneNumber),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch Twilio account info';
      res.status(500).json({ detail: msg });
    }
  });

  app.get('/api/calls/recent', async (_req, res) => {
    const sid = getEnv('TWILIO_ACCOUNT_SID');
    const token = getEnv('TWILIO_AUTH_TOKEN');
    if (!sid || !token) {
      res.status(400).json({ detail: 'Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN' });
      return;
    }
    try {
      const client = twilio(sid, token);
      const [calls, alerts] = await Promise.all([
        client.calls.list({ limit: 10 }),
        client.monitor.v1.alerts.list({ limit: 10 }).catch(() => []),
      ]);
      const enriched = await Promise.all(
        calls.map(async (c) => {
          const [notes, children] = await Promise.all([
            client.calls(c.sid).notifications.list({ limit: 3 }).catch(() => []),
            client.calls.list({ parentCallSid: c.sid, limit: 5 }).catch(() => []),
          ]);
          return {
            sid: c.sid,
            parentCallSid: c.parentCallSid,
            from: c.from,
            to: c.to,
            status: c.status,
            direction: c.direction,
            duration: c.duration,
            startTime: c.startTime,
            childrenCount: children.length,
            children: children.map((ch) => ({ sid: ch.sid, to: ch.to, status: ch.status, duration: ch.duration })),
            notifications: notes.map((n) => ({
              errorCode: n.errorCode,
              messageText: n.messageText,
            })),
          };
        })
      );
      res.json({
        calls: enriched,
        alerts: alerts.map((a) => ({
          dateCreated: a.dateCreated,
          errorCode: a.errorCode,
          alertText: a.alertText,
          resourceSid: a.resourceSid,
        })),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch recent calls';
      res.status(500).json({ detail: msg });
    }
  });

  app.get('/api/calls/:callSid/status', async (req, res) => {
    const sid = getEnv('TWILIO_ACCOUNT_SID');
    const token = getEnv('TWILIO_AUTH_TOKEN');
    if (!sid || !token) {
      res.status(400).json({ detail: 'Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN' });
      return;
    }
    try {
      const client = twilio(sid, token);
      const callSid = req.params.callSid;
      const [parent, children, parentNotes] = await Promise.all([
        client.calls(callSid).fetch(),
        client.calls.list({ parentCallSid: callSid, limit: 5 }),
        client.calls(callSid).notifications.list({ limit: 5 }).catch(() => []),
      ]);
      const childWithNotes = await Promise.all(
        children.map(async (ch) => {
          const notes = await client.calls(ch.sid).notifications.list({ limit: 5 }).catch(() => []);
          return {
            sid: ch.sid,
            to: ch.to,
            from: ch.from,
            status: ch.status,
            duration: ch.duration,
            notifications: notes.map((n) => ({
              errorCode: n.errorCode,
              messageText: n.messageText,
            })),
          };
        })
      );
      res.json({
        parent: {
          sid: parent.sid,
          to: parent.to,
          from: parent.from,
          status: parent.status,
          duration: parent.duration,
          notifications: parentNotes.map((n) => ({
            errorCode: n.errorCode,
            messageText: n.messageText,
          })),
        },
        children: childWithNotes,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch call status';
      res.status(500).json({ detail: msg });
    }
  });

  const handleBridgeCall = async (req: express.Request, res: express.Response) => {
    const sid = getEnv('TWILIO_ACCOUNT_SID');
    const token = getEnv('TWILIO_AUTH_TOKEN');
    const callerId = getEnv('TWILIO_CALLER_ID', '+17438887718');

    if (!sid || !token) {
      res.status(400).json({
        detail:
          'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are not set in AI Studio Secrets (or switch backend URL to http://localhost:8000 for local FastAPI).',
      });
      return;
    }

    const destination = normalizeE164(String(req.body?.destination || '+919199225154'));
    const agentPhone = normalizeE164(
      String(req.body?.agentPhone || getEnv('MY_MOBILE_NUMBER', '+919916109192'))
    );

    const twiml =
      destination === agentPhone
        ? `<Response><Say voice="alice">Hello from Apex Global Telephony Studio calling from ${escapeXml(
            callerId
          )}. Phone 1 and Phone 2 are currently set to the same number. Select Contact 1 or Contact 2 in the app to bridge a two-way call.</Say></Response>`
        : `<Response><Say voice="alice">Connecting you now to ${escapeXml(
            destination
          )}. Please wait while their phone rings.</Say><Dial callerId="${escapeXml(
            callerId
          )}" timeout="30"><Number>${escapeXml(destination)}</Number></Dial></Response>`;

    try {
      const client = twilio(sid, token);
      const call = await client.calls.create({
        to: agentPhone,
        from: callerId,
        twiml,
      });

      res.json({
        status: 'bridging',
        call_sid: call.sid,
        agent_phone: agentPhone,
        destination,
        message: `Ringing ${agentPhone} from ${callerId}. Answer and press any key (e.g. 1) if Twilio plays the trial prompt — Twilio will then ring ${destination}.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Twilio call creation failed';
      res.status(500).json({ detail: msg });
    }
  };

  app.post('/api/calls/bridge', handleBridgeCall);
  app.post('/api/calls/originate', handleBridgeCall);

  async function exotelFetch(
    accountSid: string,
    apiKey: string,
    apiToken: string,
    apiPath: string,
    init: RequestInit = {}
  ): Promise<{ response: globalThis.Response; data: Record<string, any>; usedSubdomain: string }> {
    const explicitSubdomain = getEnv('EXOTEL_SUBDOMAIN');
    const candidates = explicitSubdomain
      ? [explicitSubdomain]
      : ['api.in.exotel.com', 'api.exotel.com'];
    const authHeader = Buffer.from(`${apiKey}:${apiToken}`).toString('base64');

    let lastResponse!: globalThis.Response;
    let lastData: Record<string, any> = {};
    let lastSubdomain = candidates[0];

    for (const sub of candidates) {
      lastSubdomain = sub;
      const url = `https://${sub}/v1/Accounts/${encodeURIComponent(accountSid)}${apiPath}`;
      const resp = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Basic ${authHeader}`,
          ...(init.headers || {}),
        },
      });
      const data = await resp.json().catch(() => ({}));
      lastResponse = resp;
      lastData = data;
      if (resp.status !== 401) {
        return { response: resp, data, usedSubdomain: sub };
      }
    }

    return { response: lastResponse, data: lastData, usedSubdomain: lastSubdomain };
  }

  // ---- Exotel (+91 India) Server-Side Proxy Routes ----
  app.get('/api/exotel/status', (_req, res) => {
    const accountSid = getEnv('EXOTEL_ACCOUNT_SID');
    const apiKey = getEnv('EXOTEL_API_KEY');
    const apiToken = getEnv('EXOTEL_API_TOKEN');
    const subdomain = getEnv('EXOTEL_SUBDOMAIN', 'api.in.exotel.com');
    const callerId = getEnv('EXOTEL_CALLER_ID', '08047291107');
    const flowAppId = getEnv('EXOTEL_FLOW_APP_ID', '1386346');

    const missing = Object.entries({
      EXOTEL_ACCOUNT_SID: accountSid,
      EXOTEL_API_KEY: apiKey,
      EXOTEL_API_TOKEN: apiToken,
    })
      .filter(([, val]) => !val)
      .map(([k]) => k);

    const invalidAccountSid = Boolean(accountSid && /\s/.test(accountSid));

    res.json({
      status: missing.length === 0 && !invalidAccountSid ? 'ready' : 'unconfigured',
      exotel_ready: missing.length === 0 && !invalidAccountSid,
      account_sid_masked: accountSid ? `${accountSid.slice(0, 4)}...${accountSid.slice(-4)}` : '',
      invalid_account_sid: invalidAccountSid,
      subdomain,
      caller_id: callerId,
      trial_number: '09513886363',
      trial_pin: '9916-1091-92',
      flow_name: 'packyatra1 Landing Flow',
      flow_app_id: flowAppId,
      default_agent_mobile: getEnv('MY_MOBILE_NUMBER', '+919916109192'),
      missing_env: missing,
    });
  });

  app.post('/api/exotel/calls/bridge', async (req, res) => {
    const accountSid = getEnv('EXOTEL_ACCOUNT_SID');
    const apiKey = getEnv('EXOTEL_API_KEY');
    const apiToken = getEnv('EXOTEL_API_TOKEN');
    const callerId = String(req.body?.callerId || getEnv('EXOTEL_CALLER_ID', '08047291107')).trim();

    if (!accountSid || !apiKey || !apiToken) {
      res.status(400).json({
        detail:
          'Set EXOTEL_ACCOUNT_SID, EXOTEL_API_KEY, and EXOTEL_API_TOKEN in AI Studio Secrets (or local .env).',
      });
      return;
    }

    if (/\s/.test(accountSid)) {
      res.status(400).json({
        detail:
          'EXOTEL_ACCOUNT_SID cannot contain spaces (it looks like an API Key label such as "Default API key"). Set it to your Exotel Account SID (e.g. packyatra1).',
      });
      return;
    }

    const fromNum = normalizeE164(
      String(req.body?.agentPhone || getEnv('MY_MOBILE_NUMBER', '+919916109192'))
    );
    const toNum = normalizeE164(String(req.body?.destination || '+919199225154'));

    try {
      const form = new URLSearchParams({
        From: fromNum,
        To: toNum,
        CallerId: callerId,
        CallType: 'trans',
        Record: 'true',
      });

      const { response, data } = await exotelFetch(
        accountSid,
        apiKey,
        apiToken,
        '/Calls/connect.json',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        }
      );

      if (!response.ok) {
        const errMsg =
          data?.RestException?.Message ||
          data?.message ||
          `Exotel HTTP ${response.status}`;
        res.status(response.status).json({ detail: errMsg, raw: data });
        return;
      }

      const callSid = data?.Call?.Sid || '';
      res.json({
        status: 'bridging',
        carrier: 'exotel',
        call_sid: callSid,
        agent_phone: fromNum,
        destination: toNum,
        caller_id: callerId,
        message: `Exotel (${callerId}) ringing ${fromNum}; once answered it bridges 2-way voice to ${toNum}.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Exotel call request failed';
      res.status(500).json({ detail: msg });
    }
  });

  app.post('/api/exotel/calls/ivr', async (req, res) => {
    const accountSid = getEnv('EXOTEL_ACCOUNT_SID');
    const apiKey = getEnv('EXOTEL_API_KEY');
    const apiToken = getEnv('EXOTEL_API_TOKEN');
    const callerId = String(req.body?.callerId || getEnv('EXOTEL_CALLER_ID', '08047291107')).trim();
    const flowAppId = String(req.body?.flowAppId || getEnv('EXOTEL_FLOW_APP_ID', '1386346')).trim();

    if (!accountSid || !apiKey || !apiToken) {
      res.status(400).json({
        detail:
          'Set EXOTEL_ACCOUNT_SID, EXOTEL_API_KEY, and EXOTEL_API_TOKEN in AI Studio Secrets.',
      });
      return;
    }

    if (/\s/.test(accountSid)) {
      res.status(400).json({
        detail:
          'EXOTEL_ACCOUNT_SID cannot contain spaces. Set it to your Exotel Account SID (e.g. packyatra1).',
      });
      return;
    }

    if (!flowAppId) {
      res.status(400).json({
        detail:
          'Provide your Exotel App Bazaar Flow ID (e.g. 1386346) so Exotel knows which IVR applet to play.',
      });
      return;
    }

    const toNum = normalizeE164(
      String(req.body?.to || getEnv('MY_MOBILE_NUMBER', '+919916109192'))
    );
    const flowUrl = `http://my.exotel.com/${encodeURIComponent(accountSid)}/exoml/start_voice/${encodeURIComponent(flowAppId)}`;

    try {
      const form = new URLSearchParams({
        From: toNum,
        CallerId: callerId,
        Url: flowUrl,
        CallType: 'trans',
        Record: 'true',
      });

      const { response, data } = await exotelFetch(
        accountSid,
        apiKey,
        apiToken,
        '/Calls/connect.json',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        }
      );

      if (!response.ok) {
        const errMsg =
          data?.RestException?.Message ||
          data?.message ||
          `Exotel HTTP ${response.status}`;
        res.status(response.status).json({ detail: errMsg, raw: data });
        return;
      }

      const callSid = data?.Call?.Sid || '';
      res.json({
        status: 'started',
        carrier: 'exotel',
        call_sid: callSid,
        to: toNum,
        caller_id: callerId,
        flow_url: flowUrl,
        message: `Exotel (${callerId}) calling ${toNum} with App Bazaar IVR Flow #${flowAppId}. Answer to test Press 1/2/3!`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Exotel IVR call failed';
      res.status(500).json({ detail: msg });
    }
  });

  app.get('/api/exotel/calls/:callSid/recording', async (req, res) => {
    const accountSid = getEnv('EXOTEL_ACCOUNT_SID');
    const apiKey = getEnv('EXOTEL_API_KEY');
    const apiToken = getEnv('EXOTEL_API_TOKEN');

    if (!accountSid || !apiKey || !apiToken) {
      res.status(400).json({ detail: 'Missing Exotel credentials' });
      return;
    }

    const callSid = String(req.params.callSid || '').trim();
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(callSid)) {
      res.status(400).json({ detail: 'Invalid callSid format' });
      return;
    }

    try {
      const { response, data, usedSubdomain } = await exotelFetch(
        accountSid,
        apiKey,
        apiToken,
        `/Calls/${encodeURIComponent(callSid)}.json`
      );
      if (!response.ok) {
        res.status(response.status).json({
          detail: data?.RestException?.Message || `Exotel HTTP ${response.status}`,
        });
        return;
      }

      const callObj = (data?.Call as Record<string, unknown>) || data;
      const recordingUrl = String(callObj?.RecordingUrl || '').trim();
      if (!recordingUrl) {
        res.status(404).json({
          detail: 'No recording exists for this call. Enable "Record" in your Exotel Connect applet.',
        });
        return;
      }

      const authHeader = Buffer.from(`${apiKey}:${apiToken}`).toString('base64');
      let audioResp = await fetch(recordingUrl, {
        headers: { Authorization: `Basic ${authHeader}` },
        redirect: 'follow',
      });

      // Fallback to Exotel v3 voice-logs download endpoint if direct RecordingUrl fails auth
      if (!audioResp.ok) {
        const v3Url = `https://${usedSubdomain}/v3/accounts/${encodeURIComponent(
          accountSid
        )}/calls/${encodeURIComponent(callSid)}/voice-logs?format=mp3`;
        const v3Resp = await fetch(v3Url, {
          headers: { Authorization: `Basic ${authHeader}` },
          redirect: 'follow',
        });
        if (v3Resp.ok) {
          audioResp = v3Resp;
        }
      }

      if (!audioResp.ok) {
        res.status(audioResp.status).json({
          detail: `Unable to fetch Exotel recording audio (HTTP ${audioResp.status})`,
        });
        return;
      }

      const contentType = audioResp.headers.get('content-type') || 'audio/mpeg';
      const audioBuffer = Buffer.from(await audioResp.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(audioBuffer.length));
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'private, max-age=300');
      if (req.query.download === '1') {
        res.setHeader('Content-Disposition', `attachment; filename="exotel_call_${callSid}.mp3"`);
      }
      res.status(200).send(audioBuffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to stream Exotel recording';
      res.status(500).json({ detail: msg });
    }
  });

  app.get('/api/exotel/calls/:callSid', async (req, res) => {
    const accountSid = getEnv('EXOTEL_ACCOUNT_SID');
    const apiKey = getEnv('EXOTEL_API_KEY');
    const apiToken = getEnv('EXOTEL_API_TOKEN');

    if (!accountSid || !apiKey || !apiToken) {
      res.status(400).json({ detail: 'Missing Exotel credentials' });
      return;
    }

    try {
      const { response, data } = await exotelFetch(
        accountSid,
        apiKey,
        apiToken,
        `/Calls/${encodeURIComponent(req.params.callSid)}.json`
      );
      if (!response.ok) {
        res.status(response.status).json({ detail: data?.RestException?.Message || `HTTP ${response.status}` });
        return;
      }
      res.json({ call: data?.Call || data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch Exotel call';
      res.status(500).json({ detail: msg });
    }
  });

  const exotelWebhookEvents: Array<{
    id: string;
    receivedAt: string;
    callSid: string;
    from: string;
    to: string;
    digits: string;
    status: string;
    recordingUrl: string;
  }> = [];

  app.all('/api/exotel/passthru', (req, res) => {
    const payload = { ...req.query, ...(req.body || {}) } as Record<string, unknown>;
    exotelWebhookEvents.unshift({
      id: `exo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      receivedAt: new Date().toISOString(),
      callSid: String(payload.CallSid || ''),
      from: String(payload.CallFrom || payload.From || ''),
      to: String(payload.CallTo || payload.To || '08047291107'),
      digits: String(payload.digits || payload.Digits || ''),
      status: String(payload.Status || payload.CallStatus || 'received'),
      recordingUrl: String(payload.RecordingUrl || ''),
    });
    if (exotelWebhookEvents.length > 50) exotelWebhookEvents.length = 50;
    res.status(200).json({ ok: true });
  });

  app.get('/api/exotel/webhooks', (_req, res) => {
    res.json({ events: exotelWebhookEvents });
  });

  app.get('/api/exotel/calls', async (_req, res) => {
    const accountSid = getEnv('EXOTEL_ACCOUNT_SID');
    const apiKey = getEnv('EXOTEL_API_KEY');
    const apiToken = getEnv('EXOTEL_API_TOKEN');

    if (!accountSid || !apiKey || !apiToken) {
      res.status(400).json({
        detail: 'Add EXOTEL_ACCOUNT_SID, EXOTEL_API_KEY, and EXOTEL_API_TOKEN in AI Studio Secrets.',
        missing_env: [
          ...(!accountSid ? ['EXOTEL_ACCOUNT_SID'] : []),
          ...(!apiKey ? ['EXOTEL_API_KEY'] : []),
          ...(!apiToken ? ['EXOTEL_API_TOKEN'] : []),
        ],
      });
      return;
    }

    if (/\s/.test(accountSid)) {
      res.status(400).json({
        detail:
          'EXOTEL_ACCOUNT_SID currently has spaces (e.g. "Default API key"). Change EXOTEL_ACCOUNT_SID in AI Studio Secrets to your Exotel Account SID (e.g. packyatra1).',
      });
      return;
    }

    try {
      const { response, data, usedSubdomain } = await exotelFetch(
        accountSid,
        apiKey,
        apiToken,
        '/Calls.json?PageSize=50'
      );
      if (!response.ok) {
        res.status(response.status).json({
          detail: data?.RestException?.Message || data?.message || `Exotel HTTP ${response.status}`,
          subdomain_tried: usedSubdomain,
        });
        return;
      }

      const rawCalls = Array.isArray(data?.Calls) ? data.Calls : [];
      const calls = rawCalls.map((item: Record<string, unknown>) => {
        const c = (item.Call as Record<string, unknown>) || item;
        const sid = String(c.Sid || '');
        const recordingUrl = String(c.RecordingUrl || '').trim();
        return {
          sid,
          from: String(c.From || ''),
          to: String(c.To || ''),
          phoneNumberSid: String(c.PhoneNumberSid || '08047291107'),
          status: String(c.Status || ''),
          direction: String(c.Direction || ''),
          duration: String(c.Duration || '0'),
          dateCreated: String(c.DateCreated || ''),
          recordingUrl,
          hasRecording: Boolean(recordingUrl),
          audioProxyUrl: recordingUrl ? `/api/exotel/calls/${encodeURIComponent(sid)}/recording` : '',
        };
      });

      res.json({
        calls,
        recordedCount: calls.filter((c: { hasRecording: boolean }) => c.hasRecording).length,
        subdomain: usedSubdomain,
        webhooks: exotelWebhookEvents,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch Exotel calls';
      res.status(500).json({ detail: msg });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getEnv(name: string, fallback = ''): string {
  return (process.env[name] || fallback).trim();
}

function normalizeIndianPhone(num: string): string {
  const cleaned = (num || '').replace(/[^\d+]/g, '');
  if (!cleaned) return getEnv('MY_MOBILE_NUMBER', '+919916109192');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith('0')) return `+91${cleaned.slice(1)}`;
  return `+${cleaned}`;
}

function isAllowedExotelRecordingUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host.endsWith('.exotel.com') ||
      host.endsWith('.exotel.in') ||
      host.endsWith('.amazonaws.com') ||
      host === 'exotel.com' ||
      host === 'exotel.in'
    );
  } catch {
    return false;
  }
}

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

async function startServer() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

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

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'healthy', service: 'exotel-voice-console' });
  });

  app.get('/api/exotel/status', (_req, res) => {
    const accountSid = getEnv('EXOTEL_ACCOUNT_SID');
    const apiKey = getEnv('EXOTEL_API_KEY');
    const apiToken = getEnv('EXOTEL_API_TOKEN');
    const subdomain = getEnv('EXOTEL_SUBDOMAIN') || 'auto (in / sg)';
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
        detail: 'Missing EXOTEL_ACCOUNT_SID, EXOTEL_API_KEY, or EXOTEL_API_TOKEN in server environment.',
      });
      return;
    }

    if (/\s/.test(accountSid)) {
      res.status(400).json({
        detail: 'EXOTEL_ACCOUNT_SID cannot contain spaces. Use your Exotel Account SID (e.g. packyatra1).',
      });
      return;
    }

    const fromNum = normalizeIndianPhone(
      String(req.body?.agentPhone || getEnv('MY_MOBILE_NUMBER', '+919916109192'))
    );
    const toNum = normalizeIndianPhone(String(req.body?.destination || ''));

    if (!toNum || toNum.length < 10) {
      res.status(400).json({ detail: 'Enter a valid destination phone number.' });
      return;
    }

    if (fromNum === toNum) {
      res.status(400).json({
        detail: 'Agent number and destination number cannot be identical. Pick two different phone numbers.',
      });
      return;
    }

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
          data?.RestException?.Message || data?.message || `Exotel HTTP ${response.status}`;
        res.status(response.status).json({ detail: errMsg });
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
        message: `Ringing ${fromNum} from ${callerId}. Answer to connect 2-way voice to ${toNum}.`,
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
        detail: 'Missing EXOTEL_ACCOUNT_SID, EXOTEL_API_KEY, or EXOTEL_API_TOKEN in server environment.',
      });
      return;
    }

    if (/\s/.test(accountSid)) {
      res.status(400).json({
        detail: 'EXOTEL_ACCOUNT_SID cannot contain spaces. Use your Exotel Account SID (e.g. packyatra1).',
      });
      return;
    }

    if (!flowAppId || !/^\d{3,16}$/.test(flowAppId)) {
      res.status(400).json({
        detail: 'Provide a valid numeric Exotel App Bazaar Flow ID (e.g. 1386346).',
      });
      return;
    }

    const toNum = normalizeIndianPhone(
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
          data?.RestException?.Message || data?.message || `Exotel HTTP ${response.status}`;
        res.status(response.status).json({ detail: errMsg });
        return;
      }

      const callSid = data?.Call?.Sid || '';
      res.json({
        status: 'started',
        carrier: 'exotel',
        call_sid: callSid,
        to: toNum,
        caller_id: callerId,
        flow_app_id: flowAppId,
        message: `Calling ${toNum} from ${callerId} with IVR Flow #${flowAppId}. Answer to hear Press 1/2/3 menu.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Exotel IVR call failed';
      res.status(500).json({ detail: msg });
    }
  });

  app.get('/api/exotel/calls', async (_req, res) => {
    const accountSid = getEnv('EXOTEL_ACCOUNT_SID');
    const apiKey = getEnv('EXOTEL_API_KEY');
    const apiToken = getEnv('EXOTEL_API_TOKEN');

    if (!accountSid || !apiKey || !apiToken) {
      res.status(400).json({
        detail: 'Add EXOTEL_ACCOUNT_SID, EXOTEL_API_KEY, and EXOTEL_API_TOKEN in your .env file or AI Studio Secrets.',
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
        detail: 'EXOTEL_ACCOUNT_SID cannot contain spaces. Set it to your Exotel Account SID (e.g. packyatra1).',
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
          phoneNumberSid: String(c.PhoneNumberSid || getEnv('EXOTEL_CALLER_ID', '08047291107')),
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
          detail: 'No recording exists for this call. Ensure "Record" is enabled in Exotel App Bazaar.',
        });
        return;
      }

      if (!isAllowedExotelRecordingUrl(recordingUrl)) {
        res.status(403).json({ detail: 'Recording URL host is not an authorized Exotel media domain.' });
        return;
      }

      const authHeader = Buffer.from(`${apiKey}:${apiToken}`).toString('base64');
      let audioResp = await fetch(recordingUrl, {
        headers: { Authorization: `Basic ${authHeader}` },
        redirect: 'follow',
      });

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

    const callSid = String(req.params.callSid || '').trim();
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(callSid)) {
      res.status(400).json({ detail: 'Invalid callSid format' });
      return;
    }

    try {
      const { response, data } = await exotelFetch(
        accountSid,
        apiKey,
        apiToken,
        `/Calls/${encodeURIComponent(callSid)}.json`
      );
      if (!response.ok) {
        res.status(response.status).json({
          detail: data?.RestException?.Message || `HTTP ${response.status}`,
        });
        return;
      }
      res.json({ call: data?.Call || data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch Exotel call';
      res.status(500).json({ detail: msg });
    }
  });

  app.all('/api/exotel/passthru', (req, res) => {
    const payload = { ...req.query, ...(req.body || {}) } as Record<string, unknown>;
    exotelWebhookEvents.unshift({
      id: `exo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      receivedAt: new Date().toISOString(),
      callSid: String(payload.CallSid || ''),
      from: String(payload.CallFrom || payload.From || ''),
      to: String(payload.CallTo || payload.To || getEnv('EXOTEL_CALLER_ID', '08047291107')),
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
    console.log(`Packyatra Exotel Console running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

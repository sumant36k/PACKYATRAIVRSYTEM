import React, { useState } from 'react';
import {
  Phone,
  PhoneCall,
  Smartphone,
  Server,
  Key,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  X,
  Play,
  Terminal,
  Globe,
  Radio,
  ArrowRight,
  Zap,
  HelpCircle,
  Layers,
  Cpu,
  Usb,
  Wifi,
  HardDrive,
  Check,
  Monitor,
} from 'lucide-react';

interface LiveCarrierDispatcherModalProps {
  userPhoneNumber: string;
  onClose: () => void;
}

type DispatchTab = 'windows' | 'android_sim' | 'gsm_gateway' | 'usb_dongle' | 'webrtc' | 'zoiper' | 'cloud_trial';

export const LiveCarrierDispatcherModal: React.FC<LiveCarrierDispatcherModalProps> = ({
  userPhoneNumber,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<DispatchTab>('windows');
  const [targetNumber, setTargetNumber] = useState(userPhoneNumber || '+91 9916109192');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const cleanNum = targetNumber.replace(/\D/g, '');

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[94vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-700 flex items-center justify-center text-emerald-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>100% Self-Hosted & Open Source IVR Architecture</span>
              </h2>
              <span className="text-[11px] text-slate-400">
                Zero Subscriptions · Zero Cloud Lock-In · You Own the Entire Stack
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Essential Architecture Notice */}
        <div className="px-5 py-2.5 bg-emerald-950/30 border-b border-emerald-800/60 flex items-start gap-2.5 text-xs text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <strong className="text-emerald-300">You do not need Twilio or Exotel:</strong> To run an IVR without any monthly subscription fees or third-party cloud dependence, companies and developers use <strong>Hardware GSM Gateways</strong> or <strong>USB 4G modems</strong> with their own local SIM cards, or <strong>Direct WebRTC</strong>. You own the hardware and software completely.
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 overflow-x-auto text-xs px-2">
          <button
            onClick={() => setActiveTab('windows')}
            className={`py-3 px-3.5 font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'windows'
                ? 'border-cyan-500 text-cyan-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>💻 Windows Laptop (WSL2 / Docker)</span>
          </button>

          <button
            onClick={() => setActiveTab('android_sim')}
            className={`py-3 px-3.5 font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'android_sim'
                ? 'border-emerald-400 text-emerald-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Android SIM (chan_mobile)</span>
          </button>

          <button
            onClick={() => setActiveTab('gsm_gateway')}
            className={`py-3 px-3.5 font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'gsm_gateway'
                ? 'border-emerald-500 text-emerald-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>1. 4G GSM Gateway (Your SIM)</span>
          </button>

          <button
            onClick={() => setActiveTab('usb_dongle')}
            className={`py-3 px-3.5 font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'usb_dongle'
                ? 'border-cyan-500 text-cyan-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>2. Hotspots (JioFi / Airtel) ($0)</span>
          </button>

          <button
            onClick={() => setActiveTab('webrtc')}
            className={`py-3 px-3.5 font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'webrtc'
                ? 'border-purple-500 text-purple-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>3. WebRTC Click-to-Call ($0)</span>
          </button>

          <button
            onClick={() => setActiveTab('zoiper')}
            className={`py-3 px-3.5 font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'zoiper'
                ? 'border-blue-500 text-blue-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>4. Free SIP App (Sipdroid / Zoiper)</span>
          </button>

          <button
            onClick={() => setActiveTab('cloud_trial')}
            className={`py-3 px-3.5 font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'cloud_trial'
                ? 'border-amber-500 text-amber-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>5. Cloud Trials (Optional)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          {/* TAB 0: Windows Laptop (WSL2 / Docker) */}
          {activeTab === 'windows' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-cyan-950/30 border border-cyan-800/60 rounded-xl space-y-2 text-cyan-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-cyan-300">
                    <Monitor className="w-4 h-4 shrink-0" />
                    <span>Good News: You Do NOT Need a Linux PC!</span>
                  </div>
                  <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded font-semibold">
                    Windows 10 / 11 Native
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-cyan-200/90">
                  You can run Asterisk PBX and FastAPI completely on your <strong>Windows laptop</strong>! Microsoft built <strong>WSL2 (Windows Subsystem for Linux)</strong> directly into Windows 10 & 11, giving you a full, native Ubuntu Linux terminal that runs side-by-side with your Windows apps.
                </p>
              </div>

              {/* Step by Step WSL2 */}
              <div className="space-y-3">
                <h4 className="font-bold text-white text-xs uppercase font-mono tracking-wider text-cyan-400 flex items-center justify-between">
                  <span>How to Set Up on Windows (Takes 3 Minutes):</span>
                  <span className="text-slate-400 text-[10px] font-normal">Method 1: WSL2 (Recommended)</span>
                </h4>

                <div className="space-y-2.5">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-semibold flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 font-bold flex items-center justify-center text-xs">
                          1
                        </span>
                        <span>Open PowerShell on Windows as Administrator:</span>
                      </span>
                      <button
                        onClick={() => handleCopy('wsl --install -d Ubuntu', 'wsl_install')}
                        className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded text-[10px]"
                      >
                        {copiedKey === 'wsl_install' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>Copy</span>
                      </button>
                    </div>
                    <pre className="p-2 bg-slate-900 rounded font-mono text-[11px] text-cyan-300">
                      wsl --install -d Ubuntu
                    </pre>
                    <span className="text-[10px] text-slate-400 block">
                      This installs Ubuntu Linux inside Windows. Once finished, open "Ubuntu" from your Windows Start Menu.
                    </span>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-semibold flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 font-bold flex items-center justify-center text-xs">
                          2
                        </span>
                        <span>In the Ubuntu terminal, install Asterisk & Python:</span>
                      </span>
                      <button
                        onClick={() =>
                          handleCopy(
                            'sudo apt update && sudo apt install -y asterisk python3-pip python3-venv\nsudo service asterisk start',
                            'wsl_asterisk'
                          )
                        }
                        className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded text-[10px]"
                      >
                        {copiedKey === 'wsl_asterisk' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>Copy</span>
                      </button>
                    </div>
                    <pre className="p-2 bg-slate-900 rounded font-mono text-[11px] text-cyan-300">
                      sudo apt update && sudo apt install -y asterisk python3-pip{'\n'}sudo service asterisk start
                    </pre>
                    <span className="text-[10px] text-slate-400 block">
                      Asterisk is now actively listening on <strong>port 5060</strong> on your Windows laptop!
                    </span>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-semibold flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 font-bold flex items-center justify-center text-xs">
                          3
                        </span>
                        <span>Run the FastAPI IVR Service:</span>
                      </span>
                      <button
                        onClick={() =>
                          handleCopy(
                            'pip install fastapi uvicorn websockets httpx pydantic\nuvicorn app.main:app --host 0.0.0.0 --port 8000',
                            'wsl_fastapi'
                          )
                        }
                        className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded text-[10px]"
                      >
                        {copiedKey === 'wsl_fastapi' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>Copy</span>
                      </button>
                    </div>
                    <pre className="p-2 bg-slate-900 rounded font-mono text-[11px] text-cyan-300">
                      uvicorn app.main:app --host 0.0.0.0 --port 8000
                    </pre>
                  </div>
                </div>
              </div>

              {/* How GSM Gateway works with Windows */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-emerald-800/80 space-y-2">
                <span className="font-bold text-white text-xs flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  <span>How Your Physical SIM Card Connects to Your Windows Laptop:</span>
                </span>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  A hardware GSM Gateway (like GoIP or Dinstar) plugs into your <strong>home Wi-Fi router</strong> via Ethernet. It doesn't care whether your laptop is Windows or Linux! It sends the incoming call over your home Wi-Fi directly to your Windows laptop's IP address (e.g. <code>192.168.1.15:5060</code>).
                </p>
                <div className="text-[10px] text-emerald-300 bg-emerald-950/40 p-2 rounded border border-emerald-800/40">
                  ✓ You do not need to buy a Linux computer. Your current Windows laptop is completely sufficient.
                </div>
              </div>
            </div>
          )}

          {/* TAB: Android Phone + Local Indian SIM via Bluetooth (chan_mobile) */}
          {activeTab === 'android_sim' && (
            <div className="space-y-3.5">
              <div className="p-3.5 bg-emerald-950/30 border border-emerald-800/60 rounded-xl space-y-2 text-emerald-200">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-300">
                    <Smartphone className="w-4 h-4 shrink-0" />
                    <span>Android Phone + Indian SIM ➔ Asterisk (chan_mobile)</span>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-semibold shrink-0">
                    Bluetooth HFP · No Root
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-emerald-100/90">
                  Android 10+ blocks unrooted Play Store apps from accessing raw cellular voice, so the real way to bridge an unrooted Android SIM into Asterisk is <strong>Bluetooth Hands-Free Profile (<code>chan_mobile</code>)</strong>: your laptop connects to your Android phone just like a car Bluetooth kit.
                </p>
              </div>

              <div className="p-3 bg-amber-950/30 border border-amber-800/60 rounded-xl text-[11px] text-amber-200 space-y-1">
                <strong className="text-amber-300 block">Requirements &amp; Real-World Limits on Windows 10 WSL2:</strong>
                <ul className="list-disc list-inside space-y-0.5 text-amber-100/90">
                  <li><strong>USB Bluetooth Dongle (~₹250–₹400):</strong> WSL2 cannot access your laptop&apos;s internal motherboard Bluetooth directly; plug in a USB Bluetooth adapter and pass it into Ubuntu via <code>usbipd</code>.</li>
                  <li><strong>1 Simultaneous Cellular Line:</strong> A single SIM handles 1 cellular call at a time. Press 1/2/3 can ring <strong>Wi-Fi SIP extensions</strong> (<code>agent201..203</code> on Zoiper/WebRTC for ₹0) or dial out via your Twilio trunk.</li>
                  <li><strong>Audio Check First:</strong> Some Android OEM ROMs (MIUI/ColorOS) throttle background Bluetooth SCO audio—run a quick <code>Echo()</code> test before going live.</li>
                </ul>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-white">1. Forward USB Bluetooth Adapter into WSL2 (Windows PowerShell Admin)</span>
                  <button
                    onClick={() =>
                      handleCopy(
                        'usbipd list\n# Replace <BUSID> with your USB Bluetooth Dongle BUSID (e.g. 1-3)\nusbipd bind --busid <BUSID>\nusbipd attach --wsl --busid <BUSID>',
                        'android_usbipd'
                      )
                    }
                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded text-[10px]"
                  >
                    {copiedKey === 'android_usbipd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy</span>
                  </button>
                </div>
                <pre className="p-2.5 bg-slate-900 rounded font-mono text-[10px] text-cyan-300 overflow-x-auto">
{`usbipd list
usbipd bind --busid <BUSID>
usbipd attach --wsl --busid <BUSID>`}
                </pre>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-white">2. Install asterisk-mobile &amp; BlueZ + Pair Phone (Ubuntu WSL2)</span>
                  <button
                    onClick={() =>
                      handleCopy(
                        'sudo add-apt-repository -y universe\nsudo apt update\nsudo apt install -y asterisk asterisk-mobile bluetooth bluez bluez-tools usbutils\nsudo service dbus start\nsudo /usr/libexec/bluetooth/bluetoothd &\nsudo hciconfig hci0 up\nbluetoothctl\n# Inside bluetoothctl: power on -> agent on -> scan on -> pair <PHONE_MAC> -> trust <PHONE_MAC> -> connect <PHONE_MAC>',
                        'android_bluez'
                      )
                    }
                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded text-[10px]"
                  >
                    {copiedKey === 'android_bluez' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy</span>
                  </button>
                </div>
                <pre className="p-2.5 bg-slate-900 rounded font-mono text-[10px] text-slate-300 overflow-x-auto">
{`sudo add-apt-repository -y universe && sudo apt update
sudo apt install -y asterisk-mobile bluetooth bluez bluez-tools usbutils
sudo service dbus start && sudo /usr/libexec/bluetooth/bluetoothd &
sudo hciconfig hci0 up
hcitool dev          # Note adapter MAC (AA:BB:CC:DD:EE:FF)
bluetoothctl         # pair / trust / connect your Android MAC`}
                </pre>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-white">3. /etc/asterisk/chan_mobile.conf + Inbound 3-Option IVR</span>
                  <button
                    onClick={() =>
                      handleCopy(
                        `; /etc/asterisk/chan_mobile.conf\n[general]\ninterval=30\n\n[adapter]\nid=laptop_bt\naddress=AA:BB:CC:DD:EE:FF  ; Output of hcitool dev\n\n[android_sim]\naddress=11:22:33:44:55:66  ; Your Android Bluetooth MAC\nport=2                     ; Verify HFP port via: sdptool search HF\ncontext=from-android-sim\nadapter=laptop_bt`,
                        'android_chan_mobile'
                      )
                    }
                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded text-[10px]"
                  >
                    {copiedKey === 'android_chan_mobile' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Config</span>
                  </button>
                </div>
                <pre className="p-2.5 bg-slate-900 rounded font-mono text-[10px] text-emerald-300 overflow-x-auto">
{`; /etc/asterisk/chan_mobile.conf
[adapter]
id=laptop_bt
address=AA:BB:CC:DD:EE:FF  ; Output of hcitool dev

[android_sim]
address=11:22:33:44:55:66  ; Android phone Bluetooth MAC
port=2                     ; Check via: sdptool search HF
context=from-android-sim
adapter=laptop_bt`}
                </pre>
                <span className="text-[10px] text-slate-400 block">
                  Open <strong>Code Hub → ANDROID_SIM_CHAN_MOBILE.md</strong> for the complete <code>extensions.conf</code> 3-number IVR dialplan and audio test command.
                </span>
              </div>
            </div>
          )}

          {/* TAB 1: Hardware 4G GSM Gateway */}
          {activeTab === 'gsm_gateway' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-emerald-950/30 border border-emerald-800/60 rounded-xl space-y-2 text-emerald-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-emerald-300">
                    <Radio className="w-4 h-4 shrink-0" />
                    <span>Approach 1: Physical GSM / 4G VoIP Gateway Appliance</span>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-semibold">
                    Enterprise Grade · 0 Subscriptions
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-emerald-200/90">
                  A hardware GSM Gateway (popular models: <strong>GoIP-1 / GoIP-4</strong>, <strong>Dinstar UC2000</strong>, or <strong>OpenVox</strong>) is a physical device you buy once (~₹5,000 to ₹9,000 INR). You insert your own normal mobile SIM card (Airtel, Jio, or Vi) with a standard ₹299/month unlimited voice pack.
                </p>
              </div>

              {/* Architecture Diagram */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block">
                  Signal Flow (Physical Hardware):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center font-mono text-[11px]">
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <div className="text-slate-400 text-[10px]">1. CALLER DIALS</div>
                    <div className="text-white font-bold">{targetNumber}</div>
                    <div className="text-[9px] text-slate-500">Cellular Towers</div>
                  </div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <div className="text-slate-400 text-[10px]">2. GSM GATEWAY</div>
                    <div className="text-emerald-400 font-bold">Your SIM Card</div>
                    <div className="text-[9px] text-slate-500">Hardware Box (LAN)</div>
                  </div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <div className="text-slate-400 text-[10px]">3. LOCAL ASTERISK</div>
                    <div className="text-cyan-400 font-bold">SIP UDP 5060</div>
                    <div className="text-[9px] text-slate-500">Your Linux Server</div>
                  </div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <div className="text-slate-400 text-[10px]">4. FASTAPI ENGINE</div>
                    <div className="text-purple-400 font-bold">Stasis IVR</div>
                    <div className="text-[9px] text-slate-500">Plays Audio & Menus</div>
                  </div>
                </div>
              </div>

              {/* Asterisk Configuration */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Asterisk PJSIP Configuration for GSM Gateway:</span>
                  <button
                    onClick={() =>
                      handleCopy(
                        `; /etc/asterisk/pjsip.conf - Local Hardware GSM Gateway\n[gsm-gateway]\ntype=endpoint\ncontext=from-gsm-sim\ndisallow=all\nallow=alaw,ulaw,g722\naors=gsm-gateway-aor\n\n[gsm-gateway-aor]\ntype=aor\ncontact=sip:192.168.1.120:5060\n\n[gsm-gateway-identify]\ntype=identify\nendpoint=gsm-gateway\nmatch=192.168.1.120`,
                        'gsm_pjsip'
                      )
                    }
                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded text-[10px]"
                  >
                    {copiedKey === 'gsm_pjsip' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Config</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[10px] text-slate-300 overflow-x-auto">
{`; /etc/asterisk/pjsip.conf - Local Hardware GSM Gateway (No Subscriptions)
[gsm-gateway]
type=endpoint
context=from-gsm-sim
disallow=all
allow=alaw,ulaw,g722
aors=gsm-gateway-aor

[gsm-gateway-aor]
type=aor
contact=sip:192.168.1.120:5060   ; IP of your hardware GSM Gateway on your LAN

[gsm-gateway-identify]
type=identify
endpoint=gsm-gateway
match=192.168.1.120`}
                </pre>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-300 space-y-1">
                <strong className="text-white block">Key Advantages:</strong>
                <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                  <li><strong>Zero API billing:</strong> You only pay your monthly SIM recharge (e.g. Jio/Airtel unlimited voice).</li>
                  <li><strong>Complete privacy:</strong> All caller voice audio stays strictly inside your office or local network.</li>
                  <li><strong>Never blocked:</strong> You own the physical SIM slot and physical hardware.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: JioFi / Airtel Hotspots & USB */}
          {activeTab === 'usb_dongle' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-cyan-950/30 border border-cyan-800/60 rounded-xl space-y-2 text-cyan-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-cyan-300">
                    <Wifi className="w-4 h-4 shrink-0" />
                    <span>Approach 2: Using Your JioFi / Airtel Hotspot Device ($0 Cost)</span>
                  </div>
                  <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded font-semibold">
                    100% Free · Hardware You Already Own
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-cyan-200/90">
                  Having a <strong>JioFi or Airtel Hotspot (pocket Wi-Fi)</strong> instead of a USB dongle is great news! Both devices contain standard Qualcomm / Marvell cellular modem chipsets and support VoLTE voice calls.
                </p>
              </div>

              {/* 3 Hotspot Approaches */}
              <div className="space-y-3">
                <h4 className="font-bold text-white text-xs uppercase font-mono tracking-wider text-cyan-400">
                  3 Ways to Use Your JioFi / Airtel Hotspot with Asterisk:
                </h4>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-white font-semibold flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 font-bold flex items-center justify-center text-xs">
                      1
                    </span>
                    <span>Tether Hotspot via USB Cable into Windows Laptop:</span>
                  </span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Plug your Airtel Hotspot or JioFi directly into your Windows laptop using a micro-USB / Type-C cable. In Windows, it exposes the USB cellular modem interface. Forward it into WSL2 with <code>usbipd</code> just like a dongle!
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-white font-semibold flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 font-bold flex items-center justify-center text-xs">
                      2
                    </span>
                    <span>JioFi VoLTE / Wi-Fi SIP (Built-in SIP Client):</span>
                  </span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Reliance JioFi was engineered specifically for VoLTE voice calls (used by the official JioCall app). JioFi runs a local SIP proxy over Wi-Fi on <code>192.168.225.1:5060</code>. Asterisk in WSL2 can register to the JioFi over Wi-Fi directly!
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-emerald-800/80 space-y-2">
                  <span className="text-white font-semibold flex items-center gap-2 text-emerald-300">
                    <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 font-bold flex items-center justify-center text-xs">
                      3
                    </span>
                    <span>Android Smartphone via Bluetooth HFP (chan_mobile):</span>
                  </span>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Because Android 10+ blocks unrooted Play Store apps from tapping cellular audio directly, connect your Android SIM phone to WSL2 Asterisk via <strong>Bluetooth Hands-Free Profile (<code>chan_mobile</code>)</strong>. See the dedicated <strong>Android SIM (chan_mobile)</strong> tab for exact WSL2 + <code>usbipd</code> steps.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-300 font-mono">1. Install Asterisk & chan_dongle on Ubuntu/Debian:</span>
                    <button
                      onClick={() =>
                        handleCopy(
                          `sudo apt-get update\nsudo apt-get install -y asterisk build-essential libusb-1.0-0-dev\n\n# Clone open-source chan_dongle driver\ngit clone https://github.com/wdoekes/asterisk-chan-dongle.git\ncd asterisk-chan-dongle\n./bootstrap\n./configure\nmake\nsudo make install`,
                          'dongle_install'
                        )
                      }
                      className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded text-[10px]"
                    >
                      {copiedKey === 'dongle_install' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copy Shell Commands</span>
                    </button>
                  </div>
                  <pre className="p-2.5 bg-slate-900 rounded font-mono text-[10px] text-slate-300 overflow-x-auto">
{`sudo apt-get update
sudo apt-get install -y asterisk build-essential libusb-1.0-0-dev
git clone https://github.com/wdoekes/asterisk-chan-dongle.git
cd asterisk-chan-dongle && ./bootstrap && ./configure && make && sudo make install`}
                  </pre>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-300 font-mono">2. Configure /etc/asterisk/dongle.conf:</span>
                    <button
                      onClick={() =>
                        handleCopy(
                          `[general]\ninterval=15\njbenable=yes\n\n[defaults]\ncontext=from-dongle\ngroup=0\nrxgain=0\ntxgain=0\nautodeletesms=yes\nresetdongle=yes\n\n[dongle0]\naudio=/dev/ttyUSB1\ndata=/dev/ttyUSB2\nimei=123456789012345\nimsi=404451234567890\ncontext=from-dongle\nexten=s`,
                          'dongle_conf'
                        )
                      }
                      className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded text-[10px]"
                    >
                      {copiedKey === 'dongle_conf' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copy dongle.conf</span>
                    </button>
                  </div>
                  <pre className="p-2.5 bg-slate-900 rounded font-mono text-[10px] text-slate-300 overflow-x-auto">
{`[general]
interval=15

[dongle0]
audio=/dev/ttyUSB1
data=/dev/ttyUSB2
context=from-dongle
exten=s`}
                  </pre>
                </div>

                <div className="p-2.5 bg-cyan-950/20 rounded border border-cyan-800/40 text-[11px] text-cyan-300">
                  Whenever someone dials your SIM number ({targetNumber}), Asterisk answers directly from the USB dongle and hands the live call to your FastAPI IVR state machine!
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WebRTC & FastAPI Bridge */}
          {activeTab === 'webrtc' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-purple-950/30 border border-purple-800/60 rounded-xl space-y-2 text-purple-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-purple-300">
                    <Globe className="w-4 h-4 shrink-0" />
                    <span>Built-In: Twilio WebRTC + FastAPI 2-Way Bridge</span>
                  </div>
                  <span className="text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded font-semibold">
                    Works Behind Windows 10 NAT
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-purple-200/90">
                  Unlike WSL2 SIP (blocked by double NAT on incoming UDP RTP), <strong>@twilio/voice-sdk</strong> negotiates ICE/TURN over HTTPS directly in your Chrome/Edge browser — delivering immediate <strong>2-way HD audio</strong> between your Windows 10 laptop and Indian mobile numbers.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-semibold text-white block text-xs">
                    How the Built-In Softphone Connects:
                  </span>
                  <pre className="p-3 bg-slate-900 rounded font-mono text-[10px] text-slate-300 overflow-x-auto leading-relaxed">
{`1. FastAPI GET /api/twilio/token   -> Mints JWT VoiceGrant for client:agent201
2. Browser Device.register()       -> Ready for 2-way WebRTC calls + inbound ring
3. FastAPI POST /api/twilio/voice  -> TwiML <Dial> or Interactive <Gather> IVR
4. FastAPI POST /api/calls/bridge  -> Instant 2-way mobile-to-mobile bridge`}
                  </pre>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 text-[11px]">
                  <strong className="text-white block">Included Capabilities:</strong>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                    <li><strong>2-Way Browser Voice:</strong> Talk &amp; listen directly from your laptop mic/speakers.</li>
                    <li><strong>Phone-to-Phone Bridge:</strong> Trigger a call that rings <code>+919916109192</code> and bridges to any contact using only SID + Auth Token.</li>
                    <li><strong>Inbound IVR:</strong> Callers dialing <code>+17438887718</code> hear the voice menu and can press <code>0</code> to ring your browser.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Free SIP App (Sipdroid / Zoiper) */}
          {activeTab === 'zoiper' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-950/30 border border-blue-800/60 rounded-xl space-y-2 text-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-blue-300">
                    <Smartphone className="w-4 h-4 shrink-0" />
                    <span>Approach 4: Free SIP Softphone App (Sipdroid / Zoiper on Android)</span>
                  </div>
                  <span className="text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded font-semibold">
                    Install on Phone, NOT on Laptop
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-blue-200/90">
                  <strong>Important:</strong> <strong>Sipdroid is an Android app (.apk)</strong> that runs on your <strong>Android Smartphone</strong>, NOT on your Windows laptop! Your <strong>Windows laptop</strong> runs the Asterisk PBX and FastAPI backend inside WSL2.
                </p>
              </div>

              {/* Sipdroid Step by Step */}
              <div className="space-y-3">
                <h4 className="font-bold text-white text-xs uppercase font-mono tracking-wider text-cyan-400">
                  How to Configure Sipdroid on Your Android Phone:
                </h4>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-[11px]">
                  <div className="font-semibold text-white">1. Install Sipdroid on your Android phone</div>
                  <p className="text-slate-400">
                    Search <strong>"Sipdroid"</strong> or <strong>"Zoiper"</strong> in the Google Play Store on your Android phone and install it for free.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="font-semibold text-white text-[11px]">2. Enter Account Settings in Sipdroid:</div>
                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px] bg-slate-900 p-2.5 rounded border border-slate-800">
                    <div>
                      <span className="text-slate-500 block text-[10px]">SERVER / DOMAIN</span>
                      <span className="text-emerald-400 font-bold">192.168.1.X:5060</span>
                      <span className="text-slate-500 block text-[9px]">(Your Windows Laptop Wi-Fi IP)</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">USERNAME / EXTENSION</span>
                      <span className="text-cyan-300 font-bold">agent201</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">PASSWORD</span>
                      <span className="text-slate-200">Pass1234#</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">PROTOCOL</span>
                      <span className="text-purple-300 font-bold">UDP (Port 5060)</span>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 bg-emerald-950/20 rounded border border-emerald-800/40 text-[11px] text-emerald-300 flex items-center justify-between">
                  <span>When connected to Airtel Black Wi-Fi:</span>
                  <span className="font-bold">Green icon lights up in Sipdroid!</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Cloud Trials (Optional) */}
          {activeTab === 'cloud_trial' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-950/30 border border-amber-800/60 rounded-xl space-y-2 text-amber-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <Zap className="w-4 h-4 shrink-0" />
                    <span>Approach 5: Cloud Telecom Trials (Exotel / Twilio)</span>
                  </div>
                  <span className="text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-semibold">
                    Optional SaaS
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-200/90">
                  If you ever do not want to manage physical hardware (no GSM gateway or USB dongle), you can use commercial cloud carriers. Both offer free developer trials to test on your Indian mobile phone:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <strong className="text-white block font-bold text-cyan-400">Exotel (Bangalore, India)</strong>
                  <p className="text-[11px] text-slate-400">
                    15-day free developer trial built specifically for Indian numbers (+91). Directly makes test calls to your mobile {targetNumber}.
                  </p>
                  <a
                    href="https://exotel.com/signup/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-cyan-400 hover:underline font-semibold text-[11px] pt-1"
                  >
                    <span>Sign up at exotel.com</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <strong className="text-white block font-bold text-purple-400">Twilio Free Trial ($15.50 Credit)</strong>
                  <p className="text-[11px] text-slate-400">
                    Verify your phone {targetNumber} under "Verified Caller IDs" via free SMS OTP. Enable India Geo-Permissions to test for $0.
                  </p>
                  <a
                    href="https://www.twilio.com/try-twilio"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-purple-400 hover:underline font-semibold text-[11px] pt-1"
                  >
                    <span>Sign up at twilio.com</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            Target Physical Number: <strong className="text-emerald-400 font-mono">{targetNumber}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

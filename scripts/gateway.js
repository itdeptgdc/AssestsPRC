/**
 * Asset PRC HTTPS gateway (no dependencies).
 * One port (default 3000) speaks BOTH protocols:
 *   https://<ip>:3000/...  → proxied to the Next.js app (127.0.0.1:3001)
 *   http://<ip>:3000/...   → redirected to https (camera + app install need HTTPS)
 *   http(s)://<ip>:3000/cert            → how to trust Asset PRC on a phone / PC
 *   http(s)://<ip>:3000/assetqr-ca.crt  → certificate download
 */
const fs = require('fs');
const net = require('net');
const http = require('http');
const https = require('https');
const path = require('path');

const PORT = Number(process.env.GATEWAY_PORT || 3000);
const TARGET = { host: '127.0.0.1', port: Number(process.env.NEXT_PORT || 3001) };
const CERTS = path.join(__dirname, '..', 'runtime', 'certs');
const read = (f) => fs.readFileSync(path.join(CERTS, f));

const tlsOptions = { key: read('server.key'), cert: read('server.crt'), minVersion: 'TLSv1.2' };
const caCrt = read('ca.crt');
const caCer = read('ca.cer');
const logo = (() => { try { return fs.readFileSync(path.join(__dirname, '..', 'frontend', 'public', 'icon-192.png')); } catch { return null; } })();

/* ---------- certificate help page (TH / EN / KM) ---------- */
function certPage(host) {
  const hostname = (host || '').split(':')[0];
  const httpsUrl = `https://${hostname}:${PORT}/`;
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Asset PRC — Secure connection setup</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai","Kantumruy Pro",sans-serif;background:#f4f6fb;color:#1e293b}
.wrap{max-width:720px;margin:0 auto;padding:20px 16px 48px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:20px;margin-top:16px;box-shadow:0 8px 24px -12px rgba(15,23,42,.15)}
.head{display:flex;gap:14px;align-items:center}.head img{width:56px;height:56px;border-radius:14px;border:1px solid #e9d8a6}
h1{font-size:20px;margin:0}h2{font-size:16px;margin:0 0 10px}.muted{color:#64748b;font-size:14px}
.btn{display:block;text-align:center;text-decoration:none;font-weight:700;padding:14px;border-radius:14px;margin-top:10px}
.primary{background:linear-gradient(90deg,#4f46e5,#7c3aed);color:#fff}.secondary{background:#eef2ff;color:#4338ca}
ol{margin:0;padding-left:20px}li{margin:7px 0;font-size:14px;line-height:1.5}.tabs{display:flex;gap:6px;flex-wrap:wrap}
.tabs button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:6px 12px;font-weight:600;cursor:pointer}.tabs button.on{background:#4f46e5;color:#fff;border-color:#4f46e5}
[data-l]{display:none}body.th [data-l=th],body.en [data-l=en],body.km [data-l=km]{display:block}code{background:#f1f5f9;padding:2px 6px;border-radius:6px;font-size:12px;word-break:break-all}
</style></head><body class="th"><div class="wrap">
<div class="head">${logo ? '<img src="/assetqr-logo.png" alt="">' : ''}<div><h1>Asset PRC</h1><div class="muted">Poipet Resort &amp; Casino</div></div></div>
<div class="card"><div class="tabs"><button class="on" onclick="L('th',this)">ไทย</button><button onclick="L('km',this)">ខ្មែរ</button><button onclick="L('en',this)">English</button></div>
<div data-l="th"><h2 style="margin-top:14px">ตั้งค่าการเชื่อมต่อปลอดภัย (ทำครั้งเดียว)</h2><p class="muted">เพื่อใช้กล้องสแกน QR และติดตั้งแอป มือถือต้องเชื่อถือใบรับรองของ Asset PRC</p></div>
<div data-l="en"><h2 style="margin-top:14px">Secure connection setup (one time)</h2><p class="muted">To use the QR camera and install the app, your device must trust the Asset PRC certificate.</p></div>
<div data-l="km"><h2 style="margin-top:14px">រៀបចំការតភ្ជាប់សុវត្ថិភាព (ម្តងគត់)</h2><p class="muted">ដើម្បីប្រើកាមេរ៉ាស្កេន QR និងដំឡើងកម្មវិធី ឧបករណ៍ត្រូវទុកចិត្តវិញ្ញាបនបត្រ Asset PRC</p></div>
<a class="btn primary" href="/assetqr-ca.crt">⬇ Download certificate (assetqr-ca.crt)</a>
<a class="btn secondary" href="${httpsUrl}">🔒 Open Asset PRC (https)</a></div>

<div class="card"><h2>🤖 Android</h2>
<ol data-l="th"><li>กด <b>Download certificate</b> ด้านบน</li><li>เปิด <b>ตั้งค่า → ความปลอดภัย → การเข้ารหัสและข้อมูลรับรอง → ติดตั้งใบรับรอง → ใบรับรอง CA</b> (บางรุ่น: ค้นหา "ติดตั้งใบรับรอง" ในตั้งค่า)</li><li>กด <b>ติดตั้งต่อไป</b> แล้วเลือกไฟล์ <code>assetqr-ca.crt</code> จากโฟลเดอร์ดาวน์โหลด</li><li>ปิดแล้วเปิด Chrome ใหม่ จากนั้นเปิด <code>${httpsUrl}</code></li></ol>
<ol data-l="en"><li>Tap <b>Download certificate</b> above</li><li>Open <b>Settings → Security → Encryption &amp; credentials → Install a certificate → CA certificate</b> (or search "install certificate" in Settings)</li><li>Tap <b>Install anyway</b> and choose <code>assetqr-ca.crt</code> from Downloads</li><li>Close and reopen Chrome, then open <code>${httpsUrl}</code></li></ol>
<ol data-l="km"><li>ចុច <b>Download certificate</b> ខាងលើ</li><li>បើក <b>Settings → Security → Encryption &amp; credentials → Install a certificate → CA certificate</b></li><li>ចុច <b>Install anyway</b> ហើយជ្រើស <code>assetqr-ca.crt</code></li><li>បិទ ហើយបើក Chrome ម្តងទៀត រួចបើក <code>${httpsUrl}</code></li></ol></div>

<div class="card"><h2>🍎 iPhone / iPad</h2>
<ol data-l="th"><li>เปิดหน้านี้ใน <b>Safari</b> แล้วกด <b>Download certificate</b> → <b>อนุญาต</b></li><li>ไปที่ <b>ตั้งค่า → ดาวน์โหลดโปรไฟล์แล้ว → ติดตั้ง</b></li><li>ไปที่ <b>ตั้งค่า → ทั่วไป → เกี่ยวกับ → การตั้งค่าความเชื่อถือใบรับรอง</b> แล้วเปิด <b>AssetQR Local CA</b></li><li>เปิด <code>${httpsUrl}</code></li></ol>
<ol data-l="en"><li>Open this page in <b>Safari</b>, tap <b>Download certificate</b> → <b>Allow</b></li><li>Go to <b>Settings → Profile Downloaded → Install</b></li><li>Go to <b>Settings → General → About → Certificate Trust Settings</b> and switch on <b>AssetQR Local CA</b></li><li>Open <code>${httpsUrl}</code></li></ol>
<ol data-l="km"><li>បើកទំព័រនេះក្នុង <b>Safari</b> ចុច <b>Download certificate</b> → <b>Allow</b></li><li><b>Settings → Profile Downloaded → Install</b></li><li><b>Settings → General → About → Certificate Trust Settings</b> ហើយបើក <b>AssetQR Local CA</b></li><li>បើក <code>${httpsUrl}</code></li></ol></div>

<div class="card"><h2>💻 Windows PC</h2>
<ol data-l="th"><li>ดาวน์โหลด <a href="/assetqr-ca.cer">assetqr-ca.cer</a> แล้วดับเบิลคลิก → <b>Install Certificate</b></li><li>เลือก <b>Local Machine</b> → <b>Place all certificates in the following store</b> → <b>Trusted Root Certification Authorities</b></li><li>รีสตาร์ทเบราว์เซอร์</li></ol>
<ol data-l="en"><li>Download <a href="/assetqr-ca.cer">assetqr-ca.cer</a>, double-click → <b>Install Certificate</b></li><li>Choose <b>Local Machine</b> → <b>Place all certificates in the following store</b> → <b>Trusted Root Certification Authorities</b></li><li>Restart the browser</li></ol>
<ol data-l="km"><li>ទាញយក <a href="/assetqr-ca.cer">assetqr-ca.cer</a> ចុចពីរដង → <b>Install Certificate</b></li><li><b>Local Machine</b> → <b>Trusted Root Certification Authorities</b></li><li>ចាប់ផ្តើមកម្មវិធីរុករកឡើងវិញ</li></ol></div>

<div class="card"><p class="muted" data-l="th">🛡️ ใบรับรองนี้ใช้ได้เฉพาะกับเซิร์ฟเวอร์ Asset PRC นี้เท่านั้น (จำกัดชื่อ/IP) ไม่สามารถใช้กับเว็บไซต์อื่นได้<br>ยังไม่ติดตั้งก็ใช้ได้: เปิดลิงก์ https แล้วกด <b>ขั้นสูง → ดำเนินการต่อ</b> (กล้องจะใช้งานได้ แต่ติดตั้งแอปไม่ได้)</p>
<p class="muted" data-l="en">🛡️ This certificate only works for this Asset PRC server (name/IP constrained) and cannot be used for any other website.<br>Without installing: open the https link and tap <b>Advanced → Proceed</b> (camera works; app install needs the certificate).</p>
<p class="muted" data-l="km">🛡️ វិញ្ញាបនបត្រនេះប្រើបានតែជាមួយម៉ាស៊ីនមេ Asset PRC នេះប៉ុណ្ណោះ<br>បើមិនដំឡើង៖ បើកតំណ https ហើយចុច <b>Advanced → Proceed</b> (កាមេរ៉ាដំណើរការ ប៉ុន្តែដំឡើងកម្មវិធីមិនបាន)</p></div>
</div><script>function L(l,b){document.body.className=l;document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('on'));b.classList.add('on')}</script></body></html>`;
}

/* ---------- routes served by the gateway itself (both protocols) ---------- */
function serveLocal(req, res) {
  const url = (req.url || '/').split('?')[0];
  if (url === '/assetqr-ca.crt') {
    res.writeHead(200, { 'Content-Type': 'application/x-x509-ca-cert', 'Content-Disposition': 'attachment; filename="assetqr-ca.crt"', 'Cache-Control': 'no-store' });
    res.end(caCrt); return true;
  }
  if (url === '/assetqr-ca.cer') {
    res.writeHead(200, { 'Content-Type': 'application/pkix-cert', 'Content-Disposition': 'attachment; filename="assetqr-ca.cer"', 'Cache-Control': 'no-store' });
    res.end(caCer); return true;
  }
  if (url === '/assetqr-logo.png' && logo) {
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=86400' }); res.end(logo); return true;
  }
  if (url === '/cert' || url === '/cert/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(certPage(req.headers.host)); return true;
  }
  return false;
}

/* ---------- reverse proxy to Next.js ---------- */
function proxy(req, res) {
  const headers = { ...req.headers, 'x-forwarded-proto': 'https', 'x-forwarded-host': req.headers.host || '', 'x-forwarded-for': req.socket.remoteAddress || '' };
  const upstream = http.request({ ...TARGET, method: req.method, path: req.url, headers }, (r) => {
    res.writeHead(r.statusCode || 502, r.headers);
    r.pipe(res);
  });
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<meta http-equiv="refresh" content="3"><p style="font-family:sans-serif">Asset PRC is starting… กำลังเริ่มระบบ…</p>');
  });
  req.pipe(upstream);
}

const httpsServer = https.createServer(tlsOptions, (req, res) => {
  if (serveLocal(req, res)) return;
  proxy(req, res);
});
// websocket / upgrade passthrough (not used in production, kept for completeness)
httpsServer.on('upgrade', (req, socket, head) => {
  const up = net.connect(TARGET.port, TARGET.host, () => {
    up.write(`${req.method} ${req.url} HTTP/1.1\r\n` + Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n');
    up.write(head); socket.pipe(up).pipe(socket);
  });
  up.on('error', () => socket.destroy()); socket.on('error', () => up.destroy());
});

const httpServer = http.createServer((req, res) => {
  if (serveLocal(req, res)) return;
  const host = (req.headers.host || `localhost:${PORT}`).split(':')[0];
  res.writeHead(302, { Location: `https://${host}:${PORT}${req.url || '/'}`, 'Cache-Control': 'no-store' });
  res.end();
});

// sniff the first byte: 0x16 = TLS handshake → https, anything else → plain http
net.createServer((socket) => {
  socket.on('error', () => {});
  socket.once('data', (buf) => {
    socket.pause();
    socket.unshift(buf);
    (buf[0] === 0x16 ? httpsServer : httpServer).emit('connection', socket);
    process.nextTick(() => socket.resume());
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Asset PRC gateway on :${PORT}  (https → 127.0.0.1:${TARGET.port}, http → redirect, /cert = setup page)`);
});

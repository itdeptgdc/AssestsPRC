/**
 * Real-time notifications (Server-Sent Events).
 * Every signed-in browser keeps GET /api/events open; broadcast() pushes a JSON event to all of them.
 * Used for: new department, new asset code, new asset.
 */
const express = require('express');

const clients = new Set();
let seq = 0;

function broadcast(event) {
  const data = { id: ++seq, at: new Date().toISOString(), ...event };
  const msg = `id: ${data.id}\nevent: notify\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(msg); } catch { clients.delete(res); }
  }
  return data;
}

const router = express.Router();
router.get('/', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    // no-transform: proxies / compression must not buffer the stream
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`retry: 3000\nevent: hello\ndata: ${JSON.stringify({ user: req.user.id })}\n\n`);
  clients.add(res);
  // heartbeat keeps the connection (and any proxy in between) alive
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* closed */ } }, 25000);
  req.on('close', () => { clearInterval(ping); clients.delete(res); });
});

module.exports = { router, broadcast, clientCount: () => clients.size };

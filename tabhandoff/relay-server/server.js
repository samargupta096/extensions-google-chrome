/**
 * Tab Handoff — WebSocket Relay Server
 * Rooms-based pairing: two clients join the same room code and can exchange messages.
 *
 * Usage:  npm install && node server.js
 * Env:    PORT (default 9090)
 */

const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 9090;
const wss = new WebSocketServer({ port: PORT });

// rooms: Map<roomCode, Set<ws>>
const rooms = new Map();

console.log(`📡 Tab Handoff relay running on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  ws._room = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      /* ── Join a room ── */
      case 'join': {
        const code = (msg.room || '').toUpperCase().trim();
        if (!code) return ws.send(JSON.stringify({ type: 'error', message: 'Missing room code' }));

        // Leave any previous room
        leaveRoom(ws);

        if (!rooms.has(code)) rooms.set(code, new Set());
        const room = rooms.get(code);

        if (room.size >= 2) {
          return ws.send(JSON.stringify({ type: 'error', message: 'Room is full (max 2 devices)' }));
        }

        room.add(ws);
        ws._room = code;

        ws.send(JSON.stringify({ type: 'joined', room: code, peers: room.size }));

        // Notify the other peer
        if (room.size === 2) {
          for (const peer of room) {
            peer.send(JSON.stringify({ type: 'peer_joined', room: code, peers: 2 }));
          }
        }
        break;
      }

      /* ── Leave room ── */
      case 'leave': {
        leaveRoom(ws);
        ws.send(JSON.stringify({ type: 'left' }));
        break;
      }

      /* ── Forward any other message to the peer ── */
      default: {
        if (!ws._room) return;
        const room = rooms.get(ws._room);
        if (!room) return;
        for (const peer of room) {
          if (peer !== ws && peer.readyState === 1) {
            peer.send(raw.toString());
          }
        }
      }
    }
  });

  ws.on('close', () => leaveRoom(ws));
  ws.on('error', () => leaveRoom(ws));
});

function leaveRoom(ws) {
  if (!ws._room) return;
  const room = rooms.get(ws._room);
  if (room) {
    room.delete(ws);
    // Notify remaining peer
    for (const peer of room) {
      peer.send(JSON.stringify({ type: 'peer_left', room: ws._room, peers: room.size }));
    }
    if (room.size === 0) rooms.delete(ws._room);
  }
  ws._room = null;
}

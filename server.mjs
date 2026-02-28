/**
 * Custom Next.js server with Socket.IO for multiplayer support.
 * 
 * Usage:
 *   node server.mjs        (production, after `next build`)
 *   node server.mjs --dev   (development, with Next.js dev mode)
 */
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { jwtVerify } from 'jose';

const dev = process.argv.includes('--dev');
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'your-secret-key-change-in-production'
);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Track connected players: Map<socketId, PlayerInfo>
const connectedPlayers = new Map();

// Track socket by userId for dedup: Map<userId, socketId>
const userSockets = new Map();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Initialize Socket.IO
  const io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    // Reduce latency
    pingInterval: 10000,
    pingTimeout: 5000,
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      // Get token from handshake auth or cookie
      let token = socket.handshake.auth?.token;
      
      if (!token) {
        // Try to parse from cookie header
        const cookieHeader = socket.handshake.headers.cookie || '';
        const cookies = Object.fromEntries(
          cookieHeader.split(';').map(c => {
            const [key, ...val] = c.trim().split('=');
            return [key, val.join('=')];
          })
        );
        token = cookies['auth-token'];
      }

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const { payload } = await jwtVerify(token, JWT_SECRET);
      socket.data.userId = payload.userId;
      socket.data.username = payload.username;
      next();
    } catch (err) {
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, username } = socket.data;
    console.log(`[Socket.IO] Player connected: ${username} (${userId}), socket: ${socket.id}`);

    // If user already has a connection, disconnect the old one
    const existingSocketId = userSockets.get(userId);
    if (existingSocketId && existingSocketId !== socket.id) {
      const existingSocket = io.sockets.sockets.get(existingSocketId);
      if (existingSocket) {
        console.log(`[Socket.IO] Disconnecting previous socket for ${username}`);
        existingSocket.disconnect(true);
      }
      connectedPlayers.delete(existingSocketId);
    }

    // Register player
    const playerInfo = {
      userId,
      username,
      x: 400,
      y: 300,
      direction: 'down',
      avatar: 'default',
    };
    connectedPlayers.set(socket.id, playerInfo);
    userSockets.set(userId, socket.id);

    // Send current player list to the newly connected player
    const otherPlayers = [];
    for (const [sid, info] of connectedPlayers.entries()) {
      if (sid !== socket.id) {
        otherPlayers.push(info);
      }
    }
    socket.emit('players:list', otherPlayers);

    // Broadcast to everyone else that a new player joined
    socket.broadcast.emit('player:joined', playerInfo);

    // Send online count to everyone
    io.emit('players:count', connectedPlayers.size);

    // Handle player movement
    socket.on('player:move', (data) => {
      const player = connectedPlayers.get(socket.id);
      if (!player) return;

      player.x = data.x;
      player.y = data.y;
      player.direction = data.direction;

      // Broadcast to all other players
      socket.broadcast.emit('player:moved', {
        userId: player.userId,
        username: player.username,
        x: data.x,
        y: data.y,
        direction: data.direction,
      });
    });

    // Handle player initial position (sent after player loads from DB)
    socket.on('player:init', (data) => {
      const player = connectedPlayers.get(socket.id);
      if (!player) return;

      player.x = data.x;
      player.y = data.y;
      player.direction = data.direction || 'down';
      player.avatar = data.avatar || 'default';

      // Re-broadcast updated position to everyone else
      socket.broadcast.emit('player:moved', {
        userId: player.userId,
        username: player.username,
        x: player.x,
        y: player.y,
        direction: player.direction,
      });
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Player disconnected: ${username} (${reason})`);
      
      const player = connectedPlayers.get(socket.id);
      connectedPlayers.delete(socket.id);

      // Only remove user->socket mapping if this was the current socket
      if (userSockets.get(userId) === socket.id) {
        userSockets.delete(userId);
      }

      if (player) {
        // Notify other players
        socket.broadcast.emit('player:left', { userId: player.userId });
        io.emit('players:count', connectedPlayers.size);

        // Persist player position to DB
        persistPlayerPosition(player.userId, player.x, player.y, player.direction);
      }
    });
  });

  // Persist player position to the database on disconnect
  async function persistPlayerPosition(userId, x, y, direction) {
    try {
      // Dynamic import to avoid issues with Prisma in ESM
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      await prisma.user.update({
        where: { id: userId },
        data: {
          x: Math.round(x),
          y: Math.round(y),
          direction: direction || 'down',
        },
      });
      await prisma.$disconnect();
    } catch (err) {
      console.error(`[Socket.IO] Failed to persist position for ${userId}:`, err.message);
    }
  }

  httpServer.listen(port, hostname, () => {
    console.log(`> Server ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO ready for multiplayer connections`);
    console.log(`> Mode: ${dev ? 'development' : 'production'}`);
  });
});

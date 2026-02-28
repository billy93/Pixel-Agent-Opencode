# OpenCode Server - Quick Start Guide

## ✅ Server is Running!

OpenCode server is now running on **http://localhost:4096**

You can verify it's working by running:
```bash
node test-connection.mjs
```

## How to Start OpenCode Server

### Method 1: Using OpenCode CLI (Recommended)

In a **new terminal window**, run:
```bash
opencode serve --port 4096
```

This starts a headless OpenCode server that your Pixel Agents app can connect to.

### Method 2: Already Running

OpenCode serve command is already running in the background! You should see:
- Port 4096 is listening
- Web UI available at http://localhost:4096
- API endpoints ready for SDK connections

## What is OpenCode Server?

OpenCode has two modes:

| Mode | Purpose | Usage |
|------|---------|-------|
| **Interactive CLI** | Chat interface (what you're using now) | `opencode` or `opencode chat` |
| **Server Mode** | Background API for programmatic control | `opencode serve` |

The **server mode** exposes an HTTP API that lets external apps (like Pixel Agents) create and control OpenCode sessions programmatically.

## Testing the Integration

Now that the server is running, you can test spawning agents:

1. **Open Pixel Agents**: http://localhost:3001
2. **Login** with your account
3. **Click "Agents (0)"** button (bottom-right)
4. **Create an agent**:
   - Name: `TestAgent`
   - Task: `List all TypeScript files`
5. **Click "Spawn Agent"**
6. **Watch it appear** as a green square on the canvas!

## Troubleshooting

### Port already in use?
```bash
# Check what's using port 4096
netstat -ano | findstr :4096

# Kill the process if needed
taskkill /PID <process_id> /F
```

### Server not responding?
```bash
# Restart the server
opencode serve --port 4096
```

### Test connection
```bash
# Quick test
node test-connection.mjs

# Should output:
# ✓ Server is healthy!
# ✓ Found 0 active session(s)
# 🎉 OpenCode server is ready!
```

## What Happens When You Spawn an Agent?

```
User clicks "Spawn Agent" in UI
    ↓
Next.js API: POST /api/agents
    ↓
Creates agent in database (status: SPAWNING)
    ↓
Calls OpenCode SDK: createSession()
    ↓
OpenCode server creates new session on port 4096
    ↓
Updates database with sessionId (status: IDLE)
    ↓
Agent appears on canvas as green square!
```

## Summary

✅ OpenCode server is running on port 4096  
✅ SDK can connect and create sessions  
✅ Pixel Agents app is ready to spawn agents  
✅ You can now test the full agent lifecycle!

**Next step**: Open http://localhost:3001 and spawn your first agent! 🚀

# Pixel Agents - OpenCode Integration Testing

## Prerequisites

Before testing OpenCode agent integration, you need to have an OpenCode server running.

### Start OpenCode Server

You have two options:

**Option 1: Use existing OpenCode CLI**
```bash
# If you have OpenCode installed globally
opencode server --port 4096
```

**Option 2: Start via the SDK (programmatic)**
The SDK can start a server automatically, but for testing it's easier to run it manually.

## Testing Steps

### 1. Start the Application

The dev server should already be running on http://localhost:3001

If not, run:
```bash
npm run dev
```

### 2. Login/Register

1. Open http://localhost:3001
2. Create a new account or login
3. You'll see the office environment with your character (blue square)

### 3. Spawn an OpenCode Agent

1. Click the **"Agents (0)"** button in the bottom-right corner
2. The agent panel will open
3. Fill in:
   - **Agent name**: e.g., "CodeHelper"
   - **Initial task** (optional): e.g., "List all TypeScript files in this project"
4. Click **"Spawn Agent"**

### 4. What Should Happen

1. The agent will be created in the database with status `SPAWNING`
2. An OpenCode session will be created via the SDK
3. The agent status will change to `IDLE`
4. You'll see a **green square** (agent character) appear on the canvas at position (100, 100)
5. The agent's name will be displayed above it
6. A colored **status dot** will appear above the name:
   - **Gray**: IDLE
   - **Yellow**: SPAWNING
   - **Blue**: TYPING
   - **Green**: READING
   - **Purple**: RUNNING
   - **Orange**: WAITING
   - **Red**: PERMISSION or ERROR

### 5. Send a Task to the Agent

1. In the agent panel, find your agent
2. Click **"Send Task"**
3. Enter a task like: "Create a simple hello.txt file with 'Hello World'"
4. The agent's status should change to **TYPING** (blue dot)
5. OpenCode will process the task in the background

### 6. Delete an Agent

1. Click the **"Delete"** button next to the agent
2. The agent will:
   - Be removed from the canvas
   - Have its OpenCode session terminated
   - Be deleted from the database

## Troubleshooting

### Error: "Failed to create OpenCode session"

This means the OpenCode server is not running or not accessible.

**Solution:**
```bash
# Start OpenCode server on port 4096
opencode server --port 4096
```

Or check your `.env` file:
```
OPENCODE_PORT=4096
OPENCODE_HOST=localhost
```

### Agents not appearing on canvas

- Check the browser console for errors
- Refresh the page
- Make sure the agent was created successfully (check the agent panel)

### Agent status not updating

Currently, agent status updates are manual. To see real-time status updates from OpenCode events, we need to implement the event handler (next step).

## Current Limitations

1. **No real-time event streaming**: Agent status updates are not yet connected to OpenCode's event stream
2. **Fixed spawn position**: All agents spawn at (100, 100) instead of walking from an entrance
3. **No pathfinding**: Agents don't move around yet
4. **No task output display**: You can send tasks but can't see the results in the UI

## Next Steps for Full Integration

1. Implement OpenCode event stream listener to update agent status in real-time
2. Add agent movement and pathfinding
3. Display agent task output/logs
4. Add permission approval UI
5. Implement WebSocket for multiplayer synchronization

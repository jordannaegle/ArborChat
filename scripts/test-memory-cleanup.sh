#!/bin/bash
# Phase 6.5 Memory Cleanup Testing Script
# Run from ArborChat root directory

echo "=== ArborChat Phase 6.5 Memory Cleanup Testing ==="
echo ""

# Start the dev server
echo "Starting development server..."
npm run dev &
DEV_PID=$!
sleep 5

echo ""
echo "=== Manual Testing Checklist ==="
echo ""
echo "1. BASIC CLEANUP TEST"
echo "   - Create a new agent"
echo "   - Let it run 2-3 tool calls"
echo "   - Close the agent (X button)"
echo "   - Check console for cleanup logs:"
echo "     '[AgentRunner agent-X] Performing cleanup...'"
echo "     '[AgentRunner agent-X] Cleared MCP pending approvals'"
echo "     '[AgentContext] Cleanup completed for agent agent-X'"
echo ""
echo "2. MEMORY LEAK TEST"
echo "   - Open DevTools → Memory tab"
echo "   - Take heap snapshot (baseline)"
echo "   - Repeat 10 times:"
echo "     * Create agent"
echo "     * Run it (let it do some work)"
echo "     * Close agent"
echo "   - Force GC (if available)"
echo "   - Take second heap snapshot"
echo "   - Compare: Look for retained Agent objects"
echo ""
echo "3. HISTORY TRIMMING TEST"
echo "   - Create an agent with many tool calls"
echo "   - Run it until 100+ steps"
echo "   - Watch for auto-trim log:"
echo "     '[AgentRunner agent-X] Auto-trimming history: X steps, Y messages'"
echo "   - Verify steps reduced to ~75"
echo ""
echo "4. MCP APPROVAL CLEANUP TEST"
echo "   - Create agent with tool permission: 'ask'"
echo "   - Let it request a tool (don't approve)"
echo "   - Close the agent while approval pending"
echo "   - Verify no orphaned approval cards"
echo ""
echo "5. STREAMING ABORT TEST"
echo "   - Create agent and let it start streaming"
echo "   - Close agent mid-stream"
echo "   - Verify no error messages"
echo "   - Verify streaming stops cleanly"
echo ""
echo "Press Ctrl+C to stop dev server when done testing."

# Wait for user to finish
wait $DEV_PID

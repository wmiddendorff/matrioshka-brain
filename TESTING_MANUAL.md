# Manual Testing Guide - Phase 1: Telegram Integration

This guide will walk you through testing the Telegram bot integration end-to-end.

## Prerequisites

1. **Create a Telegram Bot**
   - Open Telegram and search for `@BotFather`
   - Send `/newbot` and follow the prompts
   - Choose a name (e.g., "Mudpuppy Test")
   - Choose a username (e.g., "openclaw_clone_test_bot")
   - **Save the bot token** (looks like: `123456789:ABC-DEFgh...`)

2. **Get Your Telegram User ID**
   - Search for `@userinfobot` on Telegram
   - Send any message
   - It will reply with your user ID

## Testing Steps

### Step 1: Set Up Bot Token

```bash
# Set the bot token (replace with your actual token)
node dist/cli/index.js telegram set-token 123456789:ABC-DEFgh...

# Expected output:
# ✓ Telegram bot token saved to /home/user/.mudpuppy/secrets.env
#   Next: openclaw telegram enable
```

**Verify:**
- [ ] Token saved successfully
- [ ] File `~/.mudpuppy/secrets.env` exists
- [ ] Token is NOT in git (check `git status`)

### Step 2: Enable Telegram Integration

```bash
node dist/cli/index.js telegram enable

# Expected output:
# ✓ Telegram integration enabled
#   Next: openclaw start
```

**Verify:**
- [ ] Telegram enabled in config
- [ ] `mudpuppy status` shows Telegram: Enabled ✅

### Step 3: Check Status

```bash
node dist/cli/index.js status

# Expected output:
# 📊 Mudpuppy Status
#
# Version: 0.1.0
# Workspace: /home/user/.mudpuppy
#
# Telegram:
#   Enabled: ✅
#   Token set: ✅
#   Paired users: 0
# ...
```

**Verify:**
- [ ] Telegram enabled shows ✅
- [ ] Token set shows ✅
- [ ] Paired users: 0

### Step 4: Start the Bot

```bash
node dist/cli/index.js start

# Expected output:
# Starting Mudpuppy...
#
# 🤖 Starting Telegram bot...
# ✅ Bot started: @your_bot_username
#
# ✅ Bot is running. Press Ctrl+C to stop.
```

**Verify:**
- [ ] Bot starts without errors
- [ ] Shows bot username
- [ ] Process stays running

### Step 5: Pairing Flow

**On Telegram:**
1. Search for your bot by username (e.g., `@openclaw_clone_test_bot`)
2. Send `/start`
3. You should see: "⏳ Pairing request sent. Waiting for approval on the local machine..."

**In Terminal:**
1. You should see an approval prompt:
```
┌──────────────────────────────────────────────────┐
│ APPROVAL REQUIRED                                │
├──────────────────────────────────────────────────┤
│ Telegram Pairing Request                         │
├──────────────────────────────────────────────────┤
│ A user wants to pair with this agent             │
├──────────────────────────────────────────────────┤
│ User ID: 123456789                               │
│ Username: @youruser name                          │
├──────────────────────────────────────────────────┤
│ [A]pprove  [D]eny                                │
└──────────────────────────────────────────────────┘

Your choice (A/D):
```

2. Type `A` and press Enter

**On Telegram:**
3. You should see: "✅ Pairing approved! You can now chat with the agent."

**Verify:**
- [ ] Pairing request appears in terminal
- [ ] Approval UI is clear and formatted correctly
- [ ] After approval, Telegram shows success message
- [ ] After denial (test separately), Telegram shows "❌ Pairing was denied."

### Step 6: Test Commands

**On Telegram, send:**

1. `/help`
   - Expected: List of available commands

2. `/status`
   - Expected:
   ```
   🤖 Bot Status

   ✅ Online
   ⏱ Uptime: 30s
   👥 Paired users: 1
   ```

3. Send a regular message: "Hello bot!"
   - Expected: `🤖 Echo: Hello bot!`
   - Terminal should show: `📨 Message from 123456789: Hello bot!`

**Verify:**
- [ ] `/help` shows command list
- [ ] `/status` shows uptime and paired users
- [ ] Regular messages are echoed back
- [ ] Messages appear in terminal

### Step 7: Pairing Persistence

1. Stop the bot (Ctrl+C in terminal)
2. Start it again: `node dist/cli/index.js start`
3. Send a message from Telegram

**Verify:**
- [ ] No need to pair again
- [ ] Message works immediately
- [ ] Paired users persisted in config

### Step 8: Multiple Users (Optional)

If you have a second Telegram account:

1. Send `/start` from second account
2. Approve in terminal
3. Both users should be able to send messages

**Verify:**
- [ ] Multiple users can pair
- [ ] Each user receives their own responses
- [ ] `mudpuppy status` shows correct paired user count

### Step 9: Error Handling

Test error scenarios:

1. **Start without token:**
```bash
# Disable first
node dist/cli/index.js telegram disable
# Try to start
node dist/cli/index.js start
# Expected: Error message about Telegram not enabled
```

2. **Unpaired user:**
   - From a new Telegram account, send a message WITHOUT sending /start first
   - Expected: "❌ You are not paired. Send /start to begin pairing."

3. **Invalid token:**
   - Set an invalid token
   - Try to start
   - Expected: Error from Telegram API

**Verify:**
- [ ] Clear error messages
- [ ] No crashes
- [ ] Helpful next-step instructions

### Step 10: 24-Hour Stability Test

**IMPORTANT:** This test ensures the bot runs reliably.

1. Start the bot
2. Leave it running for 24 hours
3. Periodically send messages from Telegram
4. Check for any crashes or errors

**Verify:**
- [ ] Bot runs for 24+ hours without crashing
- [ ] Messages work consistently
- [ ] No memory leaks (monitor with `top` or `htop`)
- [ ] Graceful recovery from network issues

## Success Criteria

All of these must pass:

- [x] Bot starts successfully
- [x] Pairing flow works end-to-end
- [x] Approval UI is clear and user-friendly
- [x] Messages route correctly (Telegram → terminal → Telegram)
- [x] Commands (/help, /status) work
- [x] Paired users persist across restarts
- [x] Error handling is graceful
- [x] 24-hour stability test passes
- [x] Bot token NOT in git

## Common Issues

### "Bot token not found"
- Run: `node dist/cli/index.js telegram set-token <your-token>`

### "Telegram is not enabled"
- Run: `node dist/cli/index.js telegram enable`

### "Error: 401 Unauthorized"
- Invalid bot token
- Get a new token from @BotFather

### Messages not routing
- Check that you're paired (`/start` first)
- Check bot is running
- Check terminal for error messages

## Next Steps

After all tests pass:
- Update PROGRESS.md
- Mark Phase 1 complete
- Begin Phase 2 (Soul & Identity System)

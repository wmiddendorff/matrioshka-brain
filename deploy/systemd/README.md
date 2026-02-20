# systemd Deployment

## User Service Installation

```bash
# Copy unit files
mkdir -p ~/.config/systemd/user/
cp mb-orchestrator.service ~/.config/systemd/user/
cp mb-orchestrator.timer ~/.config/systemd/user/

# Edit paths in mb-orchestrator.service if needed
# (default assumes ~/Desktop/workspace/git/matrioshka-brain)

# Reload, enable, and start
systemctl --user daemon-reload
systemctl --user enable mb-orchestrator.timer
systemctl --user start mb-orchestrator.timer

# Check status
systemctl --user status mb-orchestrator.timer
systemctl --user list-timers

# View logs
journalctl --user -u mb-orchestrator -f

# Manual trigger
systemctl --user start mb-orchestrator.service
```

## Configuration

- Timer interval: edit `OnUnitActiveSec` in the .timer file (default: 10min)
- Session timeout: edit `TimeoutStartSec` in the .service file (default: 600s)
- Quiet hours: configure in `~/.matrioshka-brain/config.json` under `orchestrator.quietHours`

## Lingering (Required for non-login sessions)

To keep user services running after logout:

```bash
loginctl enable-linger $USER
```

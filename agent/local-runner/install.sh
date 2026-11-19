#!/bin/bash
# Installs two launchd jobs (local time, so no DST adjustments):
#   pro.time24.triage        — every hour 08:00–17:00, Monday–Friday
#   pro.time24.weekly-review — Friday 16:30
# Usage: install.sh            install or update
#        install.sh uninstall  remove both jobs
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
# macOS does not let launchd jobs read ~/Documents, so run from a copy.
APP="$HOME/.local/share/time24-agent"
RUNNER="$APP/run-triage.sh"
AGENTS="$HOME/Library/LaunchAgents"
LOGS="$HOME/Library/Logs/time24-agent"
UID_N="$(id -u)"
HOURLY=pro.time24.triage
WEEKLY=pro.time24.weekly-review

unload() { launchctl bootout "gui/$UID_N/$1" 2>/dev/null || true; rm -f "$AGENTS/$1.plist"; }

if [ "${1:-}" = "uninstall" ]; then
  unload "$HOURLY"; unload "$WEEKLY"; rm -rf "$HOME/.local/share/time24-agent"; echo "Removed $HOURLY and $WEEKLY."; exit 0
fi

mkdir -p "$APP" "$AGENTS" "$LOGS"
cp "$HERE/run-triage.sh" "$RUNNER"
cp "$HERE/../skills/gtd-triage/SKILL.md" "$APP/SKILL.md"
chmod +x "$RUNNER"

write_plist() { # label, mode, calendar-entries-xml
  cat >"$AGENTS/$1.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$1</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$RUNNER</string><string>$2</string></array>
  <key>StartCalendarInterval</key>
  <array>
$3
  </array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>StandardOutPath</key><string>$LOGS/launchd.out.log</string>
  <key>StandardErrorPath</key><string>$LOGS/launchd.err.log</string>
</dict>
</plist>
EOF
  launchctl bootout "gui/$UID_N/$1" 2>/dev/null || true
  launchctl bootstrap "gui/$UID_N" "$AGENTS/$1.plist"
}

entries=""
for d in 1 2 3 4 5; do
  for h in 8 9 10 11 12 13 14 15 16 17; do
    entries+="    <dict><key>Weekday</key><integer>$d</integer><key>Hour</key><integer>$h</integer><key>Minute</key><integer>0</integer></dict>"$'\n'
  done
done
write_plist "$HOURLY" auto "$entries"
write_plist "$WEEKLY" weekly "    <dict><key>Weekday</key><integer>5</integer><key>Hour</key><integer>16</integer><key>Minute</key><integer>30</integer></dict>"

echo "Installed $HOURLY (hourly 08–17, Mon–Fri) and $WEEKLY (Fri 16:30)."
echo "Runner and skill copied to $APP (re-run install.sh after changing them)."
echo "Logs: $LOGS"
echo "Run now: launchctl kickstart gui/$UID_N/$HOURLY"

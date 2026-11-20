#!/bin/bash
# Runs the gtd-triage skill headless with Claude Code. Called by launchd
# (see install.sh). Usage: run-triage.sh [auto|weekly]
#   auto   — "morning" for the first successful run of the day, then "capture"
#   weekly — Friday weekly review
set -u
MODE_ARG="${1:-auto}"
# install.sh copies this script and the skill out of ~/Documents (macOS blocks
# launchd jobs from reading it) into ~/.local/share/time24-agent.
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$HERE/SKILL.md" ]; then SKILL="$HERE/SKILL.md"; else SKILL="$HERE/../skills/gtd-triage/SKILL.md"; fi
SKILL_DIR="$(cd "$(dirname "$SKILL")" && pwd)"
STATE="$HOME/.local/state/time24-agent"
LOGS="$HOME/Library/Logs/time24-agent"
CLAUDE="${CLAUDE_BIN:-$HOME/.local/bin/claude}"
MODEL="${TIME24_AGENT_MODEL:-claude-sonnet-5-5}"
mkdir -p "$STATE" "$LOGS"

TODAY="$(date +%F)"
LOG="$LOGS/$TODAY.log"
log() { echo "[$(date '+%F %T')] $*" >>"$LOG"; }

# Working days only (launchd fires a missed run on wake, which can be on a weekend).
DOW="$(date +%u)"
if [ "$DOW" -gt 5 ]; then log "skip: weekend"; exit 0; fi

# One run at a time; a lock older than 2 hours is stale.
LOCK="$STATE/run.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +120 2>/dev/null)" ]; then
    rm -rf "$LOCK" && mkdir "$LOCK" || exit 0
  else
    log "skip: previous run still active"; exit 0
  fi
fi
trap 'rm -rf "$LOCK"' EXIT

if [ "$MODE_ARG" = "weekly" ]; then
  MODE=weekly
elif [ "$(cat "$STATE/last-morning" 2>/dev/null)" = "$TODAY" ]; then
  MODE=capture
else
  MODE=morning
fi

NOW="$(date '+%A %F %H:%M %Z') (unix $(date +%s); today started at unix $(date -j -f '%F %T' "$TODAY 00:00:00" +%s))"
PROMPT="Scheduled run of the gtd-triage skill in **$MODE** mode. Local time: $NOW.
First read the skill at $SKILL and follow it exactly for this mode.
- Time24 tools are on the MCP server \"time24\" (including chat_messages_since for Google Chat). Call get_agent_profile first.
- Gmail, Bluedot, Google Calendar and Atlassian are available as read sources; create a Jira issue only for an action returned by list_approved_actions.
- Never send email or chat messages yourself; the only notification channel is notify_user.
- If a source or tool is unavailable, skip it, do not move its cursor, and say so in the run summary.
Finish with the run summary."

ALLOWED=(
  "Read($SKILL_DIR/**)"
  "mcp__time24"
  "mcp__claude_ai_Gmail__search_threads"
  "mcp__claude_ai_Gmail__get_thread"
  "mcp__claude_ai_Gmail__get_message"
  "mcp__claude_ai_Bluedot"
  "mcp__claude_ai_Google_Calendar__list_events"
  "mcp__claude_ai_Google_Calendar__list_calendars"
  "mcp__claude_ai_Atlassian_MCP__getAccessibleAtlassianResources"
  "mcp__claude_ai_Atlassian_MCP__atlassianUserInfo"
  "mcp__claude_ai_Atlassian_MCP__searchJiraIssuesUsingJql"
  "mcp__claude_ai_Atlassian_MCP__getJiraIssue"
  "mcp__claude_ai_Atlassian_MCP__getPeopleInfo"
  "mcp__claude_ai_Atlassian_MCP__createJiraIssue"
)

log "start: mode=$MODE model=$MODEL"
cd "$SKILL_DIR" || exit 1
"$CLAUDE" -p "$PROMPT" \
  --model "$MODEL" \
  --permission-mode dontAsk \
  --allowedTools "${ALLOWED[@]}" \
  --no-session-persistence \
  >>"$LOG" 2>&1
STATUS=$?
log "end: mode=$MODE exit=$STATUS"

if [ "$STATUS" -eq 0 ] && [ "$MODE" = "morning" ]; then echo "$TODAY" >"$STATE/last-morning"; fi
# Keep two weeks of logs.
find "$LOGS" -name '*.log' -mtime +14 -delete 2>/dev/null
exit "$STATUS"

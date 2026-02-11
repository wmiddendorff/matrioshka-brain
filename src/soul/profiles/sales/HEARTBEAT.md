# Sales Assistant Heartbeat Tasks

This file defines autonomous tasks for the sales assistant. Tasks run automatically when heartbeat is enabled.

## Scheduled Tasks

### Morning Pipeline Review
**Schedule:** Daily at 9:00 AM (Monday-Friday)
**Estimated time:** 3-5 minutes

```yaml
- [ ] Check Pipedrive for deals with no activity in past 5 days
  → Generate list with: deal name, stage, last activity date, value
  → Draft follow-up emails for top 3 priority deals
  → Tool: pipedrive_search_deals, memory_add

- [ ] Scan email for overnight messages from active deal contacts
  → Flag urgent (decision-makers, hot leads)
  → Draft responses for important messages
  → Tool: gmail_list_messages, memory_search (for context)

- [ ] Pull today's calendar meetings
  → For each meeting, get deal context from Pipedrive
  → Prepare pre-meeting brief (deal stage, last contact, open questions)
  → Tool: calendar_list_events, pipedrive_get_deal

- [ ] Generate morning summary
  → Top 3 priorities (overdue activities, hot deals, important emails)
  → Meeting list with briefs
  → Pipeline health one-liner
  → Send via telegram_send
```

### Midday Check-In
**Schedule:** Daily at 12:30 PM (Monday-Friday)
**Estimated time:** 2 minutes

```yaml
- [ ] Quick email scan for urgent items
  → Decision-maker replies
  → Hot lead responses
  → Notify if action needed
  → Tool: gmail_list_messages (unread, from active contacts)

- [ ] Prep afternoon meetings
  → Meetings starting after 1 PM
  → Pull deal briefs
  → Send 15 min before each meeting
  → Tool: calendar_list_events, pipedrive_get_deal
```

### End-of-Day Summary
**Schedule:** Daily at 5:30 PM (Monday-Friday)
**Estimated time:** 3 minutes

```yaml
- [ ] Summarize today's activities
  → Emails sent/received (count)
  → Meetings held (list)
  → Deals moved (stage changes)
  → New leads added
  → Tool: gmail_get_stats, calendar_list_events, pipedrive_get_activity_log

- [ ] Generate tomorrow's priorities
  → Scheduled meetings (with briefs)
  → Overdue activities
  → Follow-ups due
  → Tool: calendar_list_events, pipedrive_list_activities

- [ ] Pipeline health check
  → Deals stuck in stage >7 days
  → Deals with no activity >5 days
  → Draft re-engagement emails for at-risk deals
  → Tool: pipedrive_search_deals, memory_search

- [ ] Send daily wrap-up
  → Today summary
  → Tomorrow priorities
  → Deals needing attention
  → Tool: telegram_send
```

### Follow-Up Monitor
**Schedule:** Every 2 hours (9 AM - 5 PM, Monday-Friday)
**Estimated time:** 2 minutes

```yaml
- [ ] Scan Pipedrive for deals needing follow-up
  → No activity in past 5 days
  → Proposal sent >3 days ago with no response
  → Demo completed >2 days ago with no next step
  → Tool: pipedrive_search_deals

- [ ] Generate follow-up reminders
  → "Deal X: No activity in 6 days. Suggested: Check-in email"
  → "Deal Y: Proposal sent Mon, no response. Suggested: Follow-up call"
  → Tool: memory_search (for context on best follow-up approach)

- [ ] Draft follow-up emails
  → Personalized based on deal stage and history
  → Include in reminder notification
  → Tool: memory_search, gmail_draft
```

## Manual Tasks (Prompts for User)

These tasks are suggested but require user action:

### Weekly Pipeline Review
**Suggested:** Every Monday at 9 AM

```yaml
- [ ] Review pipeline health
  → Deals by stage (count and total value)
  → Conversion rates (stage to stage)
  → Average time in each stage
  → Identify bottlenecks

- [ ] Clean up stale deals
  → Deals with no activity >14 days → suggest archive or re-engage
  → Lost deals not marked as lost → update stage
  → Duplicate contacts → merge suggestions

- [ ] Forecast this week
  → Deals likely to close this week
  → At-risk deals that need attention
  → Key meetings that could move deals forward
```

### Monthly Metrics
**Suggested:** First Monday of each month

```yaml
- [ ] Calculate monthly performance
  → Deals closed (count and value)
  → Win rate
  → Average deal size
  → Average sales cycle length

- [ ] Analyze trends
  → Which sources generate best leads
  → Common objections
  → Most effective follow-up strategies

- [ ] Generate insights
  → What's working well
  → Where to focus next month
  → Suggested process improvements
```

## Heartbeat Configuration

**Active hours:** 8:00 AM - 6:00 PM, Monday-Friday
**Timezone:** User's local timezone (set during setup)
**Max actions per beat:** 10 (prevent runaway execution)
**Require approval:** No for read-only tasks, Yes for email sends

### Tools Required
- Pipedrive MCP plugin (deals, activities, contacts)
- Gmail MCP plugin (read, draft, send)
- Google Calendar MCP plugin (read events)
- Memory tools (search, add)
- Telegram tools (send notifications)

### Approval Settings
Auto-approve:
- Reading Pipedrive, Gmail, Calendar
- Memory operations
- Generating summaries
- Telegram notifications to user

Require approval:
- Sending emails to clients
- Changing deal stages (>$50K deals)
- Creating calendar events
- Modifying contact information

## Task Execution Logic

Each task is executed in order. If a task fails:
1. Log the error to audit.log
2. Continue to next task (don't block entire heartbeat)
3. Include error in summary: "⚠️ Unable to complete X (reason)"

If too many tasks fail (>50%), pause heartbeat and notify user.

## State Tracking

Heartbeat state stored in `~/.matrioshka-brain/data/heartbeat-state.json`:

```json
{
  "lastMorningReview": "2024-02-11T09:00:00Z",
  "lastMiddayCheck": "2024-02-11T12:30:00Z",
  "lastEODSummary": "2024-02-10T17:30:00Z",
  "lastFollowUpScan": "2024-02-11T15:00:00Z",
  "dealsMonitored": ["deal-123", "deal-456"],
  "lastEmailCheck": "2024-02-11T16:00:00Z"
}
```

This prevents duplicate work if the heartbeat runs multiple times.

## Customization

Users can customize via `config.json`:

```json
{
  "heartbeat": {
    "enabled": true,
    "interval": 7200000,
    "activeHours": {
      "start": "08:00",
      "end": "18:00",
      "timezone": "America/New_York",
      "daysOfWeek": [1, 2, 3, 4, 5]
    },
    "sales": {
      "morningReviewTime": "09:00",
      "middayCheckTime": "12:30",
      "eodSummaryTime": "17:30",
      "followUpInterval": 7200000,
      "dealFollowUpThreshold": 5,
      "proposalFollowUpThreshold": 3,
      "largeDealThreshold": 50000
    }
  }
}
```

## Success Criteria

Heartbeat is working well if:
- Morning summary delivered by 10 AM every workday
- No deal goes >5 days without flagging for follow-up
- Meeting briefs delivered 15+ min before each meeting
- End-of-day summary includes all major activities
- User receives 3-5 actionable notifications per day (not too many, not too few)

Adjust task frequency and thresholds based on user feedback.

# Teleconference Tracking System

## Database Tables Created

### 1. **meeting_settings** - Global Configuration
Stores system-wide teleconference settings:
- Join windows (early/late join times)
- Feature toggles (chat, screen share, recording)
- Quality settings
- Default durations

### 2. **teleconferencesessions** (Enhanced)
Main session records with NEW fields:
- `session_status` - scheduled, active, completed, cancelled, failed
- `total_duration_seconds` - Total session duration
- `participant_count` - Total participants
- `peak_participants` - Max concurrent participants
- `connection_quality` - overall, good, fair, poor
- `total_disconnections` - Connection issues
- `recording_status` - Recording state
- `recording_duration_seconds` - Recording length
- `session_notes` - Issues/notes
- `metadata` - Additional JSON data

### 3. **teleconference_participant_sessions** - Individual Tracking
Tracks each participant's session with comprehensive data:

#### Basic Info
- `participant_id`, `participant_role` (patient/caregiver), `participant_name`
- `joined_at`, `left_at`, `session_duration_seconds`

#### Connection Quality
- `join_count` - Reconnection tracking
- `disconnection_count` - Stability metric
- `connection_quality` - good/fair/poor
- `avg_bandwidth_kbps` - Network performance

#### Device & Browser
- `device_type` - desktop, mobile, tablet
- `browser` - Chrome, Firefox, Safari, etc.
- `operating_system` - Windows, Mac, Linux, iOS, Android
- `ip_address` - User location tracking

#### Audio/Video Usage
- `camera_enabled` - Was video on?
- `microphone_enabled` - Was audio on?
- `screen_shared` - Did they share screen?

#### Engagement Metrics
- `spoke_time_seconds` - Active speaking time
- `messages_sent` - Chat activity
- `reactions_sent` - Emoji reactions

#### Issues
- `issues_encountered` - JSON array of problems
- `error_logs` - Technical errors

### 4. **teleconference_events** - Event Log
Detailed timeline of all events:
- `event_type` - join, leave, disconnect, reconnect, recording_start, etc.
- `event_data` - Event-specific details
- `timestamp` - When it happened

## What Can We Track Now?

### Session-Level Metrics
- ✅ Total session duration
- ✅ Number of participants
- ✅ Peak concurrent users
- ✅ Connection quality
- ✅ Recording status and duration
- ✅ Overall session success/failure

### Participant-Level Metrics
- ✅ Join/leave timestamps
- ✅ Time spent in session
- ✅ Reconnection attempts
- ✅ Device and browser used
- ✅ Camera/mic usage
- ✅ Speaking time
- ✅ Chat participation
- ✅ Technical issues encountered

### Event Timeline
- ✅ Every join/leave
- ✅ Every disconnect/reconnect
- ✅ Screen sharing events
- ✅ Recording start/stop
- ✅ Any custom events

## Data We Can Capture from Frontend

### On Join Event:
```javascript
{
  appointmentId: 30,
  participantRole: "caregiver",
  participantId: 2,
  participantName: "Dr. Wilson Ndambuki",
  userId: 5,
  deviceType: "desktop",
  browser: "Chrome 120.0",
  operatingSystem: "Windows 10",
  ipAddress: "192.168.1.100",
  cameraEnabled: true,
  microphoneEnabled: false,
  isModerator: true
}
```

### On Leave Event:
```javascript
{
  appointmentId: 30,
  participantRole: "caregiver",
  participantId: 2,
  sessionDuration: 1847, // seconds
  disconnectionCount: 2,
  connectionQuality: "good",
  messagesCount: 15,
  screenShared: true,
  issuesEncountered: ["brief-disconnect-at-300s"]
}
```

### Continuous Tracking (via Jitsi Events):
- Audio/video mute/unmute
- Screen share start/stop
- Connection quality changes
- Participant speaking time
- Chat messages
- Reactions/emojis
- Network issues

## Advanced Jitsi Events We Can Track

Jitsi provides these events:
- `videoConferenceJoined`
- `videoConferenceLeft`
- `participantJoined`
- `participantLeft`
- `audioMuteStatusChanged`
- `videoMuteStatusChanged`
- `screenSharingStatusChanged`
- `dominantSpeakerChanged`
- `tileViewChanged`
- `chatUpdated`
- `connectionQualityChanged`
- `recordingStatusChanged`
- `errorOccurred`

## Usage Examples

### Track Session Quality for Billing
```sql
SELECT
  a.id,
  ts.session_status,
  ts.total_duration_seconds / 60 as duration_minutes,
  ts.connection_quality,
  COUNT(tps.id) as participant_count,
  AVG(tps.connection_quality) as avg_participant_quality
FROM appointments a
JOIN teleconferencesessions ts ON ts.appointmentId = a.id
LEFT JOIN teleconference_participant_sessions tps ON tps.teleconference_session_id = ts.id
WHERE ts.session_status = 'completed'
GROUP BY a.id;
```

### Find Problem Sessions
```sql
SELECT
  ts.id,
  ts.appointmentId,
  ts.total_disconnections,
  ts.connection_quality,
  COUNT(te.id) as error_count
FROM teleconferencesessions ts
LEFT JOIN teleconference_events te ON te.teleconference_session_id = ts.id
  AND te.event_type = 'disconnect'
WHERE ts.total_disconnections > 3
GROUP BY ts.id
ORDER BY ts.total_disconnections DESC;
```

### Caregiver Performance Report
```sql
SELECT
  c.id,
  u.firstName,
  u.lastName,
  COUNT(tps.id) as total_sessions,
  AVG(tps.session_duration_seconds) as avg_duration,
  AVG(tps.spoke_time_seconds) as avg_speaking_time,
  SUM(tps.messages_sent) as total_chat_messages,
  AVG(tps.disconnection_count) as avg_disconnections
FROM caregivers c
JOIN users u ON u.id = c.userId
JOIN teleconference_participant_sessions tps ON tps.participant_id = c.id
  AND tps.participant_role = 'caregiver'
WHERE tps.session_status = 'completed'
GROUP BY c.id;
```

## Next Steps

1. **Run the migration SQL** to create/update tables
2. **Update meetingController.js** to save participant session data
3. **Enhance frontend** to capture device info and track events
4. **Create analytics dashboard** to visualize session data
5. **Set up alerts** for poor quality sessions

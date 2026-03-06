# Jitsi Integration Summary

## Overview
This document summarizes the Jitsi teleconferencing integration for CareConnect Healthcare system.

---

## Server Configuration

### Your Jitsi Server
- **Web Interface (Meetings)**: `https://91.108.121.232` (port 443)
- **REST API (Monitoring)**: `http://91.108.121.232:8085`

### Important Port Information
```
✅ Port 443 (HTTPS) → Jitsi web interface (for video meetings)
   Example: https://91.108.121.232/CareConnect_12345_abc123

⚙️  Port 8085 (HTTP) → REST API (for health checks and stats)
   Example: http://91.108.121.232:8085/about/health
```

---

## Environment Configuration (.env)

```env
# Jitsi Server
JITSI_DOMAIN=91.108.121.232
JITSI_REST_API_PORT=8085

# Meeting Time Windows
JITSI_ALLOW_EARLY_MINUTES=15        # Join 15 min before appointment
JITSI_MAX_LATE_MINUTES=30           # Join up to 30 min after appointment ends

# Meeting Duration
JITSI_DEFAULT_DURATION=180          # 3 hours (180 minutes)

# JWT Authentication (optional - for secure meetings)
# JITSI_APP_ID=your_app_id
# JITSI_APP_SECRET=your_app_secret
```

---

## How It Works

### 1. Payment Flow → Meeting Creation

When a client pays for a booking:

**Location**: `src/services/bookingService.js` (lines 232-250)

```javascript
// After successful payment, convert pending booking to appointment
if (sessionType === 'teleconference' || sessionType === 'video') {
  // Generate Jitsi meeting
  const jitsiMeeting = generateJitsiMeeting(
    appointment.id,
    patientId,
    caregiverId
  );

  // Save to appointment
  await appointment.update({
    jitsiRoomName: jitsiMeeting.roomName,    // CareConnect_12345_abc123
    jitsiMeetingUrl: jitsiMeeting.meetingUrl // https://91.108.121.232/CareConnect_12345_abc123
  });
}
```

### 2. Meeting Link Generation

**Location**: `src/services/jitsiService.js`

```javascript
// Generates secure room name
generateJitsiRoomName(appointmentId, patientId, caregiverId)
// Result: CareConnect_12345_ffa482245b90b633

// Generates full URL
generateJitsiMeetingUrl(roomName)
// Result: https://91.108.121.232/CareConnect_12345_ffa482245b90b633
```

### 3. Access Control

**Location**: `src/services/jitsiService.js` - `canJoinMeeting()`

Meeting access window:
```
[15 min before] ← Can Join → [Appointment Start] → [Appointment Duration] → [30 min after] ← Expires
```

Example for 60-minute appointment at 2:00 PM:
- **Opens**: 1:45 PM (15 min early)
- **Appointment**: 2:00 PM - 3:00 PM
- **Closes**: 3:30 PM (30 min after end)

---

## Professional Features Enabled

### Video & Audio
✅ HD Video Quality (720p, up to 1080p)
✅ Stereo Audio
✅ Noise Cancellation
✅ Echo Suppression
✅ Audio/Video Quality Indicators

### Communication
✅ Public Chat
✅ Private Messages
✅ Emoji Reactions
✅ GIF Support
✅ Raise Hand

### Collaboration
✅ Screen Sharing (full screen, window, or tab)
✅ Recording (local and cloud)
✅ Live Streaming
✅ YouTube Video Sharing
✅ Closed Captions

### Professional Features
✅ Virtual Backgrounds
✅ Background Blur
✅ Device Selection (camera, mic, speaker)
✅ Pre-join Page (test devices before joining)
✅ Tile View (up to 25 participants)
✅ Connection Statistics
✅ Bandwidth Optimization

### Moderation (for Caregivers)
✅ Mute All Participants
✅ Kick Participants
✅ Grant Moderator Role
✅ Lobby/Waiting Room
✅ Security Options

---

## Configuration Files

### 1. Test Script
**File**: `test-jitsi-config.js`

Run to test your Jitsi server:
```bash
node test-jitsi-config.js
```

This will:
- ✅ Test connectivity to https://91.108.121.232 (web interface)
- ✅ Test REST API at http://91.108.121.232:8085
- ✅ Generate sample meeting links
- ✅ Test meeting expiration logic
- ✅ Export full configuration to `jitsi-full-config.json`

### 2. Professional Config
**File**: `src/config/jitsiConfig.js`

Use in frontend when embedding Jitsi:
```javascript
const { getProfessionalConfig } = require('./config/jitsiConfig');

// For caregivers (moderators)
const config = getProfessionalConfig(
  roomName,
  'Dr. Smith',
  'dr.smith@example.com',
  true  // isModerator
);

// For patients
const config = getProfessionalConfig(
  roomName,
  'John Doe',
  'john@example.com',
  false  // not moderator
);
```

### 3. Jitsi Service
**File**: `src/services/jitsiService.js`

Core functions:
- `generateJitsiMeeting()` - Create meeting link
- `canJoinMeeting()` - Check access permissions
- `generateJitsiJWT()` - Generate JWT for secure meetings (optional)

---

## Frontend Integration (Next Steps)

### Embedding Jitsi in React

Install Jitsi library:
```bash
npm install @jitsi/react-sdk
```

Create Meeting Component:
```jsx
import { JitsiMeeting } from '@jitsi/react-sdk';
import { getProfessionalConfig } from '../config/jitsiConfig';

function VideoConsultation({ appointment, user }) {
  const config = getProfessionalConfig(
    appointment.jitsiRoomName,
    user.name,
    user.email,
    user.role === 'caregiver'
  );

  return (
    <JitsiMeeting
      domain="91.108.121.232"
      roomName={appointment.jitsiRoomName}
      configOverwrite={config.configOverwrite}
      interfaceConfigOverwrite={config.interfaceConfigOverwrite}
      userInfo={config.userInfo}
      onApiReady={(externalApi) => {
        // Meeting loaded
        console.log('Jitsi API ready');
      }}
      getIFrameRef={(iframeRef) => {
        iframeRef.style.height = '600px';
      }}
    />
  );
}
```

---

## Testing

### 1. Test Server Connectivity
```bash
node test-jitsi-config.js
```

### 2. Test Meeting Link
Open in browser:
```
https://91.108.121.232/TestMeeting123
```

You should see:
1. SSL warning (accept and proceed - self-signed cert)
2. Jitsi pre-join page
3. Device testing options
4. Join meeting

### 3. Test REST API
```bash
curl http://91.108.121.232:8085/about/health
```

Should return server health status.

---

## Meeting Duration Configuration

### Current Setup: 3 Hours (180 minutes)

The 3-hour duration is used for:
1. **JWT Token Expiration**: If using JWT authentication
2. **Access Window Calculation**: In `canJoinMeeting()`

### How Duration Works:

```javascript
// From appointment
const appointment = {
  scheduledDate: '2024-01-15 14:00:00',
  duration: 180  // 3 hours
};

// Access window
const accessCheck = canJoinMeeting(appointment.scheduledDate, appointment.duration);

// Result:
// Can join: 13:45 (15 min before)
// Expires:  17:30 (3 hours + 30 min after)
```

---

## Security Features

### 1. Unique Room Names
Each meeting gets a cryptographically secure room name:
```
CareConnect_{appointmentId}_{secureHash}
Example: CareConnect_12345_ffa482245b90b633
```

### 2. Time-Based Access Control
- Users can only join within allowed time window
- Links expire automatically
- Backend validates access before allowing join

### 3. Optional JWT Authentication
If you configure `JITSI_APP_ID` and `JITSI_APP_SECRET`:
- All meetings require JWT tokens
- Tokens identify users and assign roles
- Additional security layer

### 4. SSL/TLS Encryption
- All meetings use HTTPS (port 443)
- Traffic is encrypted
- Secure communication

---

## Troubleshooting

### "Cannot connect to server"
**Check:**
1. Firewall allows port 443 (HTTPS)
2. Jitsi server is running
3. DNS/IP is correct: `91.108.121.232`
4. SSL certificate is installed

### "Meeting link expired"
**Check:**
1. Appointment time vs current time
2. `JITSI_ALLOW_EARLY_MINUTES` setting
3. `JITSI_MAX_LATE_MINUTES` setting
4. Call `canJoinMeeting()` to verify access

### SSL Warning in Browser
**Normal for self-signed certificates**
- Click "Advanced"
- Click "Proceed to 91.108.121.232 (unsafe)"
- Meeting will load

**Production Solution**: Install valid SSL certificate from Let's Encrypt

---

## Summary Checklist

✅ **Server Configuration**
- Jitsi server at 91.108.121.232
- Port 443 for meetings
- Port 8085 for API

✅ **Environment Variables**
- `JITSI_DOMAIN=91.108.121.232`
- `JITSI_DEFAULT_DURATION=180` (3 hours)
- Access window configuration

✅ **Meeting Creation**
- Automatic on payment completion
- Generates secure room names
- Stores in appointment record

✅ **Professional Features**
- All teleconferencing features enabled
- HD video, screen sharing, recording
- Moderation controls for caregivers

✅ **Access Control**
- Time-based access windows
- Secure room names
- Optional JWT authentication

---

## Next Steps

1. **Test the configuration**:
   ```bash
   node test-jitsi-config.js
   ```

2. **Verify server access**:
   - Visit: https://91.108.121.232/TestMeeting123
   - Accept SSL warning
   - Test meeting features

3. **Integrate in frontend**:
   - Install `@jitsi/react-sdk`
   - Create video consultation component
   - Use professional config from `jitsiConfig.js`

4. **Production deployment**:
   - Install valid SSL certificate
   - Configure JWT authentication (optional)
   - Test end-to-end flow

---

**Configuration Complete! ✅**

Your Jitsi integration is ready for professional healthcare teleconferencing with:
- 3-hour meeting duration
- All professional features enabled
- Self-hosted server at 91.108.121.232
- Automatic meeting creation on payment

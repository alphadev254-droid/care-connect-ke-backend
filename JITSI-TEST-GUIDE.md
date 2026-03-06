# Jitsi Configuration Test Script - Usage Guide

## 🎯 What This Script Does

The `test-jitsi-config.js` script demonstrates **ALL possible Jitsi Meet configuration options** including:

- ✅ All video/audio settings
- ✅ Security & authentication options
- ✅ Recording & streaming capabilities
- ✅ UI customization options
- ✅ Events you can listen to
- ✅ Commands you can execute
- ✅ Complete configuration examples

## 🚀 How to Run

### Step 1: Install Dependencies (if not already installed)
```bash
cd "C:\Users\HP\PycharmProjects\Homecare system\HomeCareSystem-Backend"
npm install axios jsonwebtoken
```

### Step 2: Run the Test Script
```bash
node test-jitsi-config.js
```

### Step 3: Check the Output
The script will:
1. ✅ Test connection to Jitsi server
2. ✅ Display all available configuration options
3. ✅ Show all events you can listen to
4. ✅ List all commands you can execute
5. ✅ Generate a sample meeting configuration
6. ✅ Create `jitsi-full-config.json` with complete config

## 📄 Generated Files

After running, you'll get:

### `jitsi-full-config.json`
Complete configuration file with:
- All possible settings
- Sample meeting configuration
- Available events list
- Available commands list

## 🔧 Configuration Options

### Environment Variables (Optional)
Create a `.env` file:

```env
# Use custom Jitsi server (default: meet.jit.si)
JITSI_DOMAIN=meet.jit.si

# For secure JWT authentication (optional)
JITSI_APP_ID=your_app_id
JITSI_APP_SECRET=your_secret_key
```

## 📖 What You'll Learn

### 1. **Video & Audio Settings**
```javascript
{
  startWithAudioMuted: false,
  startWithVideoMuted: false,
  resolution: 720,
  enableNoisyMicDetection: true,
  enableTalkWhileMuted: true
}
```

### 2. **Security Options**
```javascript
{
  enableE2EE: true,              // End-to-end encryption
  prejoinPageEnabled: true,       // Pre-join lobby
  enableLobbyChat: true,          // Lobby chat
  p2p: { enabled: true }          // Peer-to-peer for 2 people
}
```

### 3. **Recording & Streaming**
```javascript
{
  fileRecordingsEnabled: true,
  liveStreamingEnabled: true,
  hiddenDomain: 'recorder.meet.jit.si'
}
```

### 4. **UI Customization**
```javascript
{
  APP_NAME: 'CareConnect',
  BRAND_WATERMARK_LINK: '',
  SHOW_JITSI_WATERMARK: false,
  DEFAULT_REMOTE_DISPLAY_NAME: 'Healthcare Provider',
  toolbarButtons: [
    'microphone', 'camera', 'chat',
    'desktop', 'recording', 'hangup'
    // ... and many more
  ]
}
```

### 5. **Events You Can Listen To**
```javascript
// Connection events
videoConferenceJoined
videoConferenceLeft
participantJoined
participantLeft

// Media events
audioMuteStatusChanged
videoMuteStatusChanged
screenSharingStatusChanged

// Chat events
incomingMessage
privateMessageReceived

// ... and 30+ more events
```

### 6. **Commands You Can Execute**
```javascript
// Control audio/video
api.executeCommand('toggleAudio')
api.executeCommand('toggleVideo')

// Screen sharing
api.executeCommand('toggleShareScreen')

// Recording
api.executeCommand('startRecording', {mode: 'file'})
api.executeCommand('stopRecording', 'file')

// Participant management
api.executeCommand('kickParticipant', participantId)
api.executeCommand('muteEveryone')

// ... and 40+ more commands
```

## 💡 Example Use Cases

### Use Case 1: HIPAA-Compliant Healthcare Meetings
```javascript
{
  enableE2EE: true,                    // End-to-end encryption
  fileRecordingsEnabled: true,          // Record for records
  enableLobbyChat: true,                // Waiting room
  enablePrivateChat: false,             // Disable private chat
  disableJoinLeaveSounds: true         // Professional environment
}
```

### Use Case 2: Patient Consultation
```javascript
{
  startWithVideoMuted: false,          // Camera on by default
  prejoinPageEnabled: true,            // Test devices first
  enableNoAudioDetection: true,        // Detect audio issues
  toolbarButtons: [                    // Simplified toolbar
    'microphone', 'camera', 'chat',
    'desktop', 'hangup'
  ]
}
```

### Use Case 3: Group Therapy Session
```javascript
{
  resolution: 720,                     // Good quality
  tileView: {
    numberOfVisibleTiles: 25           // See everyone
  },
  enableReactions: true,               // Emoji reactions
  enableChat: true,                    // Group chat
  enableRaisedHand: true              // Moderated discussion
}
```

## 🎨 Customization Levels

### Level 1: Basic (Ready to Use)
- Use default meet.jit.si
- No configuration needed
- Works immediately

### Level 2: Branded (Your Logo/Colors)
```javascript
{
  APP_NAME: 'CareConnect',
  BRAND_WATERMARK_LINK: 'https://yoursite.com',
  DEFAULT_BACKGROUND: '#2c5282'
}
```

### Level 3: Feature Control (Enable/Disable Features)
```javascript
{
  enableChat: true,
  enableRecording: false,
  enableScreenSharing: true,
  toolbarButtons: [/* only what you need */]
}
```

### Level 4: Secure & Private (Self-Hosted + JWT)
```javascript
{
  domain: 'video.yourcompany.com',
  jwt: 'eyJhbGc...',  // JWT token
  enableE2EE: true,
  enableLobbyChat: true
}
```

## 🔍 Testing Checklist

Run this script to answer:

- ✅ What video quality can I set?
- ✅ Can I disable specific features?
- ✅ What events can I track?
- ✅ What commands can I execute programmatically?
- ✅ How do I customize the UI?
- ✅ What security options are available?
- ✅ Can I record meetings?
- ✅ Can I control participants?
- ✅ How do I add branding?

## 📚 Further Reading

- **Jitsi Official Docs:** https://jitsi.github.io/handbook/
- **API Reference:** https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe
- **Self-Hosting Guide:** https://jitsi.github.io/handbook/docs/devops-guide/

## 🎓 Key Takeaways

1. **100+ Configuration Options** - Highly customizable
2. **40+ Events** - Track everything that happens
3. **30+ Commands** - Control the meeting programmatically
4. **Works Out of the Box** - meet.jit.si requires no setup
5. **Production Ready** - Can self-host for HIPAA compliance

---

**Run `node test-jitsi-config.js` to see all possibilities!** 🚀

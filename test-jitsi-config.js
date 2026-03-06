/**
 * Jitsi Meet Configuration Test Script
 *
 * This script demonstrates all possible Jitsi configurations and features
 * Run with: node test-jitsi-config.js
 */

const axios = require('axios');
const crypto = require('crypto');

// ============================================================================
// CONFIGURATION OPTIONS
// ============================================================================

// Load environment variables
require('dotenv').config();

const JITSI_CONFIG = {
  // Server Configuration
  domain: process.env.JITSI_DOMAIN || '91.108.121.232',  // Web interface (port 443/HTTPS)
  restApiPort: 8085,  // REST API port for stats/monitoring

  // Room Configuration
  roomName: 'TestRoom_' + Date.now(),

  // Security & Authentication (for self-hosted Jitsi)
  jwt: {
    enabled: false, // Set to true if using JWT authentication
    appId: process.env.JITSI_APP_ID || '',
    appSecret: process.env.JITSI_APP_SECRET || ''
  }
};

// ============================================================================
// ALL POSSIBLE JITSI CONFIGURATION OPTIONS
// ============================================================================

const COMPLETE_JITSI_OPTIONS = {
  // ========== Core Settings ==========
  configOverwrite: {
    // Video/Audio Quality
    startWithAudioMuted: false,           // Start with mic muted
    startWithVideoMuted: false,           // Start with camera off
    resolution: 720,                      // Video resolution (360, 720, 1080)
    constraints: {
      video: {
        height: { ideal: 720, max: 1080, min: 360 },
        width: { ideal: 1280, max: 1920, min: 640 }
      }
    },
    enableLayerSuspension: true,          // Optimize bandwidth

    // Recording & Streaming
    fileRecordingsEnabled: true,          // Allow local recording
    fileRecordingsServiceEnabled: true,   // Enable file recording service
    fileRecordingsServiceSharingEnabled: true,
    liveStreamingEnabled: true,           // Enable live streaming
    hiddenDomain: 'recorder.meet.jit.si', // Hidden domain for recording

    // Screen Sharing
    desktopSharingChromeExtId: null,      // Chrome extension for screen share
    desktopSharingChromeSources: ['screen', 'window', 'tab'],
    desktopSharingChromeMinExtVersion: '0.1',

    // Chat & Messaging
    enableChat: true,                     // Enable chat feature
    enablePrivateChat: true,              // Allow private messages

    // Security & Privacy
    enableE2EE: false,                    // End-to-end encryption
    e2eeLabels: {},                       // E2EE labels
    enableLobbyChat: true,                // Chat in lobby/waiting room
    enableInsecureRoomNameWarning: true,  // Warn about insecure room names
    p2p: {
      enabled: true,                      // Peer-to-peer mode for 2 people
      stunServers: [
        { urls: 'stun:meet-jit-si-turnrelay.jitsi.net:443' }
      ]
    },

    // Moderation
    enableModeratorIndicator: true,       // Show moderator badge
    enableClosePage: false,               // Show close page button
    enableForcedReload: true,             // Allow forced reload

    // UI/UX Features
    prejoinPageEnabled: true,             // Show pre-join page (test devices)
    enableWelcomePage: false,             // Disable welcome page
    enableCalendarIntegration: false,     // Calendar integration
    enableUserRolesBasedOnToken: true,    // Roles from JWT token

    // Notifications
    enableNoAudioDetection: true,         // Detect when audio isn't working
    enableNoisyMicDetection: true,        // Detect noisy microphone
    disableJoinLeaveSounds: false,        // Play sounds when people join/leave

    // Audio Settings
    audioQuality: {
      stereo: false,                      // Stereo audio
      opusMaxAverageBitrate: null         // Audio bitrate
    },

    // Video Settings
    enableTalkWhileMuted: true,           // Show notification if talking while muted
    disableSimulcast: false,              // Multiple quality streams

    // Performance
    channelLastN: -1,                     // Max video streams (-1 = unlimited)
    lastNLimits: {
      5: 20,
      30: 15,
      50: 10,
      70: 5,
      90: 2
    },

    // Tile View
    tileView: {
      numberOfVisibleTiles: 25            // Max tiles in tile view
    },

    // Branding
    subject: 'CareConnect Healthcare Session',
    hideConferenceSubject: false,
    hideConferenceTimer: false,

    // Advanced Settings
    startAudioOnly: false,                // Audio-only mode
    startScreenSharing: false,            // Start with screen share
    openBridgeChannel: 'websocket',       // Bridge channel type

    // Etherpad (Collaborative document)
    etherpad_base: undefined,             // Etherpad server URL

    // Analytics
    analytics: {
      disabled: false,
      rtcstatsEnabled: false,
      rtcstatsSendInterval: 1000
    },

    // Testing & Development
    testing: {
      testMode: false,
      capScreenshareBitrate: 1,
      noAutoPlayVideo: false
    },

    // Toolbar Buttons (what buttons to show)
    toolbarButtons: [
      'microphone',           // Mic toggle
      'camera',              // Camera toggle
      'closedcaptions',      // Closed captions
      'desktop',             // Screen sharing
      'embedmeeting',        // Embed meeting
      'fullscreen',          // Fullscreen mode
      'fodeviceselection',   // Device selection
      'hangup',              // Leave call
      'profile',             // Edit profile
      'chat',                // Chat panel
      'recording',           // Start recording
      'livestreaming',       // Live streaming
      'etherpad',            // Shared document
      'sharedvideo',         // YouTube sharing
      'settings',            // Settings
      'raisehand',           // Raise hand
      'videoquality',        // Video quality
      'filmstrip',           // Filmstrip toggle
      'invite',              // Invite people
      'feedback',            // Feedback
      'stats',               // Connection stats
      'shortcuts',           // Keyboard shortcuts
      'tileview',            // Tile view
      'videobackgroundblur', // Background blur
      'download',            // Download
      'help',                // Help
      'mute-everyone',       // Mute all (moderator)
      'security'             // Security options
    ],

    // Mobile Settings
    disableDeepLinking: true,

    // Language
    defaultLanguage: 'en',

    // Other Features
    enableReactions: true,               // Enable emoji reactions
    enableGifSearch: true,               // GIF search in chat
    giphy: {
      enabled: true,
      displayMode: 'all',
      rating: 'pg',
      proxyUrl: 'https://giphy-proxy.jitsi.net'
    }
  },

  // ========== Interface Configuration ==========
  interfaceConfigOverwrite: {
    // Branding
    APP_NAME: 'CareConnect',
    BRAND_WATERMARK_LINK: '',
    DEFAULT_BACKGROUND: '#474747',
    DEFAULT_LOCAL_DISPLAY_NAME: 'You',
    DEFAULT_REMOTE_DISPLAY_NAME: 'Healthcare Provider',

    // Watermarks
    SHOW_JITSI_WATERMARK: false,
    SHOW_WATERMARK_FOR_GUESTS: false,
    SHOW_BRAND_WATERMARK: false,
    JITSI_WATERMARK_LINK: '',

    // Display
    DISABLE_VIDEO_BACKGROUND: false,
    INITIAL_TOOLBAR_TIMEOUT: 20000,
    TOOLBAR_TIMEOUT: 4000,
    TOOLBAR_ALWAYS_VISIBLE: false,

    // Film Strip
    FILM_STRIP_MAX_HEIGHT: 120,
    VERTICAL_FILMSTRIP: true,

    // Welcome Page
    GENERATE_ROOMNAMES_ON_WELCOME_PAGE: false,
    DISPLAY_WELCOME_PAGE_CONTENT: false,
    DISPLAY_WELCOME_PAGE_TOOLBAR_ADDITIONAL_CONTENT: false,

    // Settings
    SETTINGS_SECTIONS: [
      'devices',
      'language',
      'moderator',
      'profile',
      'calendar'
    ],

    // Notifications
    DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
    DISABLE_PRESENCE_STATUS: false,
    DISABLE_DOMINANT_SPEAKER_INDICATOR: false,
    DISABLE_FOCUS_INDICATOR: false,
    DISABLE_RINGING: false,
    AUDIO_LEVEL_PRIMARY_COLOR: 'rgba(255,255,255,0.4)',
    AUDIO_LEVEL_SECONDARY_COLOR: 'rgba(255,255,255,0.2)',

    // Mobile
    MOBILE_APP_PROMO: false,
    OPTIMAL_BROWSERS: ['chrome', 'chromium', 'firefox', 'nwjs', 'electron', 'safari'],
    UNSUPPORTED_BROWSERS: [],

    // Provider Info
    PROVIDER_NAME: 'CareConnect Healthcare',
    NATIVE_APP_NAME: 'CareConnect',

    // Recording
    HIDE_RECORDING_LABEL: false,

    // Live Streaming
    LIVE_STREAMING_HELP_LINK: 'https://jitsi.org/live',

    // Recent List
    RECENT_LIST_ENABLED: true,

    // Video Layout
    VIDEO_LAYOUT_FIT: 'both',
    VIDEO_QUALITY_LABEL_DISABLED: false,

    // Invite
    SHOW_PROMOTIONAL_CLOSE_PAGE: false,
    SHOW_CHROME_EXTENSION_BANNER: false
  },

  // ========== User Information ==========
  userInfo: {
    displayName: 'Test User',
    email: 'test@careconnect.com'
  }
};

// ============================================================================
// JITSI EXTERNAL API EVENTS (for frontend integration)
// ============================================================================

const JITSI_EVENTS = {
  // Conference Events
  videoConferenceJoined: 'User successfully joined the conference',
  videoConferenceLeft: 'User left the conference',
  readyToClose: 'Conference is ready to be closed',

  // Participant Events
  participantJoined: 'New participant joined',
  participantLeft: 'Participant left',
  participantKickedOut: 'Participant was kicked out',
  participantRoleChanged: 'Participant role changed',

  // Audio/Video Events
  audioAvailabilityChanged: 'Audio availability changed',
  audioMuteStatusChanged: 'Audio mute status changed',
  videoAvailabilityChanged: 'Video availability changed',
  videoMuteStatusChanged: 'Video mute status changed',
  videoQualityChanged: 'Video quality changed',

  // Screen Share Events
  screenSharingStatusChanged: 'Screen sharing status changed',

  // Recording Events
  recordingStatusChanged: 'Recording status changed',
  recordingLinkAvailable: 'Recording link is available',

  // Chat Events
  incomingMessage: 'New chat message received',
  outgoingMessage: 'Chat message sent',
  privateMessageReceived: 'Private message received',

  // Device Events
  deviceListChanged: 'Device list changed',
  cameraError: 'Camera error occurred',
  micError: 'Microphone error occurred',

  // Error Events
  errorOccurred: 'Error occurred',

  // Display Name Events
  displayNameChange: 'Display name changed',

  // Dominant Speaker Events
  dominantSpeakerChanged: 'Dominant speaker changed',

  // Subject Events
  subjectChange: 'Conference subject changed',

  // Tile View Events
  tileViewChanged: 'Tile view toggled',

  // Raise Hand Events
  raiseHandUpdated: 'Raise hand status updated',

  // Email Events
  emailChange: 'Email address changed',

  // Filmstrip Events
  filmstripDisplayChanged: 'Filmstrip display changed',

  // Feedback Events
  feedbackSubmitted: 'Feedback submitted',

  // Password Events
  passwordRequired: 'Password required to join'
};

// ============================================================================
// JITSI API COMMANDS (for controlling the meeting)
// ============================================================================

const JITSI_COMMANDS = {
  // Audio/Video
  toggleAudio: 'api.executeCommand("toggleAudio")',
  toggleVideo: 'api.executeCommand("toggleVideo")',
  setAudioInputDevice: 'api.executeCommand("setAudioInputDevice", deviceId)',
  setAudioOutputDevice: 'api.executeCommand("setAudioOutputDevice", deviceId)',
  setVideoInputDevice: 'api.executeCommand("setVideoInputDevice", deviceId)',

  // Screen Sharing
  toggleShareScreen: 'api.executeCommand("toggleShareScreen")',

  // Recording
  startRecording: 'api.executeCommand("startRecording", {mode: "file"})',
  stopRecording: 'api.executeCommand("stopRecording", "file")',

  // Chat
  toggleChat: 'api.executeCommand("toggleChat")',
  sendChatMessage: 'api.executeCommand("sendChatMessage", message)',

  // Display
  setLargeVideoParticipant: 'api.executeCommand("setLargeVideoParticipant", participantId)',
  toggleTileView: 'api.executeCommand("toggleTileView")',
  toggleFilmStrip: 'api.executeCommand("toggleFilmStrip")',

  // Participants
  kickParticipant: 'api.executeCommand("kickParticipant", participantId)',
  muteEveryone: 'api.executeCommand("muteEveryone")',
  grantModerator: 'api.executeCommand("grantModerator", participantId)',

  // Call Control
  hangup: 'api.executeCommand("hangup")',

  // Settings
  setVideoQuality: 'api.executeCommand("setVideoQuality", quality)',
  toggleLobby: 'api.executeCommand("toggleLobby", enabled)',
  setSubject: 'api.executeCommand("subject", "Meeting Subject")',

  // User Info
  displayName: 'api.executeCommand("displayName", "New Name")',
  email: 'api.executeCommand("email", "email@example.com")',
  avatarUrl: 'api.executeCommand("avatarUrl", "https://example.com/avatar.jpg")',

  // Password
  password: 'api.executeCommand("password", "meetingPassword")',

  // Raise Hand
  toggleRaiseHand: 'api.executeCommand("toggleRaiseHand")',

  // Virtual Background
  setVideoBackgroundEffect: 'api.executeCommand("setVideoBackgroundEffect", {backgroundType: "blur"})',

  // E2EE
  toggleE2EE: 'api.executeCommand("toggleE2EE", enabled)'
};

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

/**
 * Generate a Jitsi JWT token for secure meetings
 */
function generateJWT(roomName, userName, userEmail, isModerator = false) {
  if (!JITSI_CONFIG.jwt.enabled) {
    console.log('⚠️  JWT not enabled. Using public Jitsi server without authentication.');
    return null;
  }

  const jwt = require('jsonwebtoken');

  const payload = {
    context: {
      user: {
        name: userName,
        email: userEmail,
        moderator: isModerator
      }
    },
    room: roomName,
    aud: JITSI_CONFIG.jwt.appId,
    iss: JITSI_CONFIG.jwt.appId,
    sub: JITSI_CONFIG.domain,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
  };

  return jwt.sign(payload, JITSI_CONFIG.jwt.appSecret);
}

/**
 * Test Jitsi server availability
 */
async function testJitsiServer() {
  console.log('\n🔍 Testing Jitsi Server Availability...\n');

  try {
    // Use http for localhost, https for all other servers (including self-hosted)
    const protocol = JITSI_CONFIG.domain.includes('localhost') ||
                     JITSI_CONFIG.domain.includes('127.0.0.1')
      ? 'http'
      : 'https';

    const url = `${protocol}://${JITSI_CONFIG.domain}`;
    console.log(`Testing Web Interface: ${url}`);

    const response = await axios.get(url, {
      timeout: 10000,
      validateStatus: () => true,
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) // Accept self-signed certs
    });

    if (response.status === 200) {
      console.log('✅ Jitsi Web Interface is reachable!');
      console.log(`   Status: ${response.status}`);
      console.log(`   URL: ${url}`);

      if (JITSI_CONFIG.domain.includes('localhost')) {
        console.log('\n🏠 Using LOCAL Jitsi server');
        console.log('   ✓ Great for development and testing');
        console.log('   ✓ Full control over configuration');
        console.log('   ✓ No internet required');
      } else if (JITSI_CONFIG.domain.includes('91.108.121.232')) {
        console.log('\n🌐 Using SELF-HOSTED Jitsi server');
        console.log('   ✓ Web Interface: https://91.108.121.232 (port 443)');
        console.log('   ✓ REST API: http://91.108.121.232:8085');
        console.log('   ✓ Full control over configuration');
        console.log('   ✓ Professional teleconferencing features enabled');
        console.log('   ✓ Private and secure');
      }

      // Test REST API health endpoint (for self-hosted servers)
      if (JITSI_CONFIG.restApiPort && !JITSI_CONFIG.domain.includes('meet.jit.si')) {
        try {
          console.log('\n🔍 Testing REST API...');
          const apiUrl = `http://${JITSI_CONFIG.domain}:${JITSI_CONFIG.restApiPort}/about/health`;
          console.log(`   Testing: ${apiUrl}`);

          const apiResponse = await axios.get(apiUrl, {
            timeout: 5000,
            validateStatus: () => true
          });

          if (apiResponse.status === 200) {
            console.log('   ✅ REST API is reachable!');
            console.log(`   Health Check: ${JSON.stringify(apiResponse.data)}`);
          } else {
            console.log(`   ⚠️  REST API returned status: ${apiResponse.status}`);
          }
        } catch (apiError) {
          console.log(`   ⚠️  REST API not accessible: ${apiError.message}`);
          console.log('   (This is optional - meetings will still work)');
        }
      }

      return true;
    } else {
      console.log(`⚠️  Server returned status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Failed to reach Jitsi server');
    console.log(`   Error: ${error.message}`);

    if (JITSI_CONFIG.domain.includes('localhost')) {
      console.log('\n💡 Local Jitsi Server Not Reachable');
      console.log('   Make sure your Jitsi server is running on localhost');
      console.log('   Check if the server is started correctly');
    } else if (JITSI_CONFIG.domain.includes('91.108.121.232')) {
      console.log('\n💡 Self-Hosted Jitsi Server Not Reachable');
      console.log('   Web Interface should be at: https://91.108.121.232 (port 443)');
      console.log('   REST API should be at: http://91.108.121.232:8085');
      console.log('   Check:');
      console.log('     - Firewall settings and network connectivity');
      console.log('     - SSL certificate is properly configured');
      console.log('     - Verify JITSI_DOMAIN in .env file is correct');
    } else if (JITSI_CONFIG.domain === 'meet.jit.si') {
      console.log('\n💡 Tip: You are using the public Jitsi server (meet.jit.si)');
      console.log('   This is normal and the server is likely working.');
      console.log('   The connection test may fail due to CORS, but meetings will work.');
    }

    return false;
  }
}

/**
 * Generate a meeting configuration
 */
function generateMeetingConfig(appointmentId, patientName, caregiverName, isModerator = false) {
  const roomName = `CareConnect_${appointmentId}_${crypto.randomBytes(8).toString('hex')}`;

  const config = {
    roomName: roomName,
    width: '100%',
    height: '600px',
    parentNode: null, // This would be a DOM element in browser
    ...COMPLETE_JITSI_OPTIONS
  };

  // Update display name
  config.userInfo.displayName = isModerator ? caregiverName : patientName;

  // Generate JWT if enabled
  if (JITSI_CONFIG.jwt.enabled) {
    config.jwt = generateJWT(
      roomName,
      config.userInfo.displayName,
      config.userInfo.email,
      isModerator
    );
  }

  return config;
}

/**
 * Print configuration details
 */
function printConfigurationDetails() {
  console.log('\n📋 JITSI CONFIGURATION CAPABILITIES\n');
  console.log('=' .repeat(70));

  console.log('\n🎥 VIDEO & AUDIO SETTINGS:');
  console.log('  ✓ Resolution: 360p, 720p, 1080p');
  console.log('  ✓ Start muted (audio/video)');
  console.log('  ✓ Audio quality (stereo, bitrate)');
  console.log('  ✓ Noise detection');
  console.log('  ✓ Talk while muted detection');

  console.log('\n🔒 SECURITY & PRIVACY:');
  console.log('  ✓ End-to-end encryption (E2EE)');
  console.log('  ✓ JWT authentication');
  console.log('  ✓ Password protection');
  console.log('  ✓ Lobby/Waiting room');
  console.log('  ✓ Moderator controls');

  console.log('\n📹 RECORDING & STREAMING:');
  console.log('  ✓ Local recording');
  console.log('  ✓ Cloud recording');
  console.log('  ✓ Live streaming (YouTube, etc)');
  console.log('  ✓ Dropbox integration');

  console.log('\n🖥️  SCREEN SHARING:');
  console.log('  ✓ Share entire screen');
  console.log('  ✓ Share specific window');
  console.log('  ✓ Share browser tab');

  console.log('\n💬 CHAT & COMMUNICATION:');
  console.log('  ✓ Public chat');
  console.log('  ✓ Private messages');
  console.log('  ✓ GIF search');
  console.log('  ✓ Emoji reactions');
  console.log('  ✓ Raise hand');

  console.log('\n🎨 UI CUSTOMIZATION:');
  console.log('  ✓ Custom branding');
  console.log('  ✓ Toolbar buttons selection');
  console.log('  ✓ Tile view / Speaker view');
  console.log('  ✓ Virtual backgrounds');
  console.log('  ✓ Background blur');
  console.log('  ✓ Custom colors');

  console.log('\n🔧 ADVANCED FEATURES:');
  console.log('  ✓ Closed captions');
  console.log('  ✓ Shared documents (Etherpad)');
  console.log('  ✓ YouTube video sharing');
  console.log('  ✓ Calendar integration');
  console.log('  ✓ Breakout rooms');
  console.log('  ✓ Connection statistics');

  console.log('\n👥 PARTICIPANT MANAGEMENT:');
  console.log('  ✓ Kick participants');
  console.log('  ✓ Mute everyone');
  console.log('  ✓ Grant moderator role');
  console.log('  ✓ Participant list');

  console.log('\n' + '='.repeat(70));
}

/**
 * Print all available events
 */
function printAvailableEvents() {
  console.log('\n📡 AVAILABLE JITSI EVENTS:\n');
  console.log('=' .repeat(70));

  Object.entries(JITSI_EVENTS).forEach(([event, description]) => {
    console.log(`  ${event.padEnd(35)} - ${description}`);
  });

  console.log('\n' + '='.repeat(70));
}

/**
 * Print all available commands
 */
function printAvailableCommands() {
  console.log('\n⚡ AVAILABLE JITSI COMMANDS:\n');
  console.log('=' .repeat(70));

  Object.entries(JITSI_COMMANDS).forEach(([command, example]) => {
    console.log(`  ${command.padEnd(30)} - ${example}`);
  });

  console.log('\n' + '='.repeat(70));
}

/**
 * Test meeting expiration and access control
 */
function testMeetingExpiration() {
  console.log('\n⏰ TESTING MEETING EXPIRATION & ACCESS CONTROL\n');
  console.log('=' .repeat(70));

  const { canJoinMeeting } = require('./src/services/jitsiService');

  // Test scenarios
  const scenarios = [
    {
      name: '1. Meeting in the Future (Too Early)',
      scheduledDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      duration: 60
    },
    {
      name: '2. Meeting Starting in 10 Minutes (Can Join)',
      scheduledDate: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
      duration: 60
    },
    {
      name: '3. Meeting Happening NOW (Can Join)',
      scheduledDate: new Date(), // Right now
      duration: 60
    },
    {
      name: '4. Meeting Ended 20 Minutes Ago (Can Still Join - Grace Period)',
      scheduledDate: new Date(Date.now() - 80 * 60 * 1000), // 80 min ago (60 min duration + 20 min elapsed)
      duration: 60
    },
    {
      name: '5. Meeting Ended 2 Hours Ago (Expired)',
      scheduledDate: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      duration: 60
    }
  ];

  scenarios.forEach((scenario) => {
    console.log(`\n${scenario.name}`);
    console.log('-'.repeat(70));

    const accessCheck = canJoinMeeting(scenario.scheduledDate, scenario.duration);

    console.log(`  Scheduled Time: ${scenario.scheduledDate.toLocaleString()}`);
    console.log(`  Duration: ${scenario.duration} minutes`);
    console.log(`\n  Access Status:`);
    console.log(`    Can Join: ${accessCheck.canJoin ? '✅ YES' : '❌ NO'}`);
    console.log(`    Status: ${accessCheck.status}`);
    console.log(`    Message: ${accessCheck.message}`);

    if (accessCheck.availableAt) {
      console.log(`\n  Time Window:`);
      console.log(`    Available From: ${new Date(accessCheck.availableAt).toLocaleString()}`);
      console.log(`    Expires At: ${new Date(accessCheck.expiresAt).toLocaleString()}`);

      if (accessCheck.timeUntilExpiry) {
        console.log(`    Time Until Expiry: ${accessCheck.timeUntilExpiry} minutes`);
      }
      if (accessCheck.timeUntilAvailable) {
        console.log(`    Time Until Available: ${accessCheck.timeUntilAvailable} minutes`);
      }
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log('\n💡 Configuration (from .env):');
  console.log(`   JITSI_ALLOW_EARLY_MINUTES: ${process.env.JITSI_ALLOW_EARLY_MINUTES || 15}`);
  console.log(`   JITSI_MAX_LATE_MINUTES: ${process.env.JITSI_MAX_LATE_MINUTES || 30}`);
  console.log('\n' + '='.repeat(70));
}

/**
 * Generate testable meeting links with different time scenarios
 */
function generateTestableLinks() {
  console.log('\n🔗 TESTABLE MEETING LINKS\n');
  console.log('=' .repeat(70));

  const protocol = JITSI_CONFIG.domain.includes('localhost') ||
                   JITSI_CONFIG.domain.includes('127.0.0.1')
    ? 'http'
    : 'https';

  const testLinks = [
    {
      id: 'NOW',
      name: 'Meeting Available NOW',
      scheduledDate: new Date(),
      duration: 60,
      room: `CareConnect_Test_NOW_${Date.now().toString().slice(-8)}`
    },
    {
      id: 'SOON',
      name: 'Meeting in 10 Minutes',
      scheduledDate: new Date(Date.now() + 10 * 60 * 1000),
      duration: 60,
      room: `CareConnect_Test_SOON_${Date.now().toString().slice(-8)}`
    },
    {
      id: 'LATER',
      name: 'Meeting in 2 Hours (Too Early)',
      scheduledDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
      duration: 60,
      room: `CareConnect_Test_LATER_${Date.now().toString().slice(-8)}`
    }
  ];

  const { canJoinMeeting } = require('./src/services/jitsiService');

  testLinks.forEach((link) => {
    const accessCheck = canJoinMeeting(link.scheduledDate, link.duration);
    const url = `${protocol}://${JITSI_CONFIG.domain}/${link.room}`;

    console.log(`\n${link.name} (${link.id})`);
    console.log('-'.repeat(70));
    console.log(`  🔗 URL: ${url}`);
    console.log(`  📅 Scheduled: ${link.scheduledDate.toLocaleString()}`);
    console.log(`  ⏱️  Duration: ${link.duration} minutes`);
    console.log(`\n  Access Check:`);
    console.log(`    ${accessCheck.canJoin ? '✅ CAN JOIN NOW' : '❌ CANNOT JOIN YET'}`);
    console.log(`    Status: ${accessCheck.status}`);
    console.log(`    ${accessCheck.message}`);

    if (accessCheck.availableAt) {
      console.log(`\n  Window:`);
      console.log(`    Opens: ${new Date(accessCheck.availableAt).toLocaleString()}`);
      console.log(`    Closes: ${new Date(accessCheck.expiresAt).toLocaleString()}`);
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log('\n💡 TIP: Copy any of the URLs above and paste in your browser!');
  console.log('   The backend will check access before allowing you to join.');
  console.log('\n' + '='.repeat(70));

  return testLinks;
}

/**
 * Generate sample meeting for testing
 */
function generateSampleMeeting() {
  console.log('\n🎯 SAMPLE MEETING CONFIGURATION\n');
  console.log('=' .repeat(70));

  const appointmentId = 12345;
  const config = generateMeetingConfig(
    appointmentId,
    'John Doe (Patient)',
    'Dr. Sarah Smith (Caregiver)',
    false
  );

  const protocol = JITSI_CONFIG.domain.includes('localhost') ||
                   JITSI_CONFIG.domain.includes('127.0.0.1')
    ? 'http'
    : 'https';

  console.log('\nRoom Details:');
  console.log(`  Room Name: ${config.roomName}`);
  console.log(`  Meeting URL: ${protocol}://${JITSI_CONFIG.domain}/${config.roomName}`);
  console.log(`  Display Name: ${config.userInfo.displayName}`);
  console.log(`  Email: ${config.userInfo.email}`);

  console.log('\nEnabled Features:');
  console.log(`  ✓ Chat: ${config.configOverwrite.enableChat}`);
  console.log(`  ✓ Recording: ${config.configOverwrite.fileRecordingsEnabled}`);
  console.log(`  ✓ Screen Share: Desktop sharing enabled`);
  console.log(`  ✓ Reactions: ${config.configOverwrite.enableReactions}`);
  console.log(`  ✓ Pre-join Page: ${config.configOverwrite.prejoinPageEnabled}`);
  console.log(`  ✓ Lobby/Waiting Room: ${config.configOverwrite.enableLobbyChat}`);

  console.log('\nToolbar Buttons:');
  console.log(`  ${config.configOverwrite.toolbarButtons.length} buttons enabled`);
  console.log(`  ${config.configOverwrite.toolbarButtons.slice(0, 10).join(', ')}...`);

  console.log('\n' + '='.repeat(70));

  return config;
}

/**
 * Save configuration to file
 */
function saveConfigToFile() {
  const fs = require('fs');
  const config = generateSampleMeeting();

  const output = {
    timestamp: new Date().toISOString(),
    server: JITSI_CONFIG.domain,
    configuration: config,
    availableEvents: JITSI_EVENTS,
    availableCommands: Object.keys(JITSI_COMMANDS),
    readme: 'This file contains all possible Jitsi Meet configuration options for CareConnect'
  };

  fs.writeFileSync(
    'jitsi-full-config.json',
    JSON.stringify(output, null, 2)
  );

  console.log('\n💾 Full configuration saved to: jitsi-full-config.json');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                   ║');
  console.log('║          JITSI MEET CONFIGURATION TEST & DOCUMENTATION           ║');
  console.log('║                      CareConnect Healthcare                       ║');
  console.log('║                                                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');

  // Test server
  await testJitsiServer();

  // Print all configuration options
  printConfigurationDetails();

  // Print events
  printAvailableEvents();

  // Print commands
  printAvailableCommands();

  // Generate sample meeting
  const sampleConfig = generateSampleMeeting();

  // TEST EXPIRATION FEATURE
  testMeetingExpiration();

  // GENERATE TESTABLE LINKS
  const testLinks = generateTestableLinks();

  // Save to file
  saveConfigToFile();

  const protocol = JITSI_CONFIG.domain.includes('localhost') ||
                   JITSI_CONFIG.domain.includes('127.0.0.1')
    ? 'http'
    : 'https';

  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                         TESTING COMPLETE                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('\n📁 Full configuration exported to: jitsi-full-config.json');
  console.log('📖 Read TEST_JITSI.md for implementation guide');
  console.log('📖 Read JITSI-LINK-EXPIRATION.md for expiration details');
  console.log('\n🔗 Sample Meeting URL:');
  console.log(`   ${protocol}://${JITSI_CONFIG.domain}/${sampleConfig.roomName}`);
  console.log('\n🧪 Test Links Generated Above - Copy & Paste in Browser!');
  console.log('   ✅ Links with "CAN JOIN NOW" will work immediately');
  console.log('   ⏰ Links with "CANNOT JOIN YET" will be blocked until scheduled time\n');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  JITSI_CONFIG,
  COMPLETE_JITSI_OPTIONS,
  JITSI_EVENTS,
  JITSI_COMMANDS,
  generateMeetingConfig,
  generateJWT,
  testJitsiServer
};

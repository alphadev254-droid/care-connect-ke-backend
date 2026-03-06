/**
 * Jitsi Professional Configuration
 * All features enabled for healthcare teleconferencing
 */

module.exports = {
  /**
   * Get complete Jitsi configuration for professional teleconference
   * Includes all features for high-quality healthcare video consultations
   * Duration: 3 hours (180 minutes) as configured
   */
  getProfessionalConfig: (roomName, userName, userEmail, isModerator = false) => {
    return {
      roomName: roomName,
      width: '100%',
      height: '100%',

      // User Information
      userInfo: {
        displayName: userName,
        email: userEmail
      },

      // ========== Core Configuration ==========
      configOverwrite: {
        // Meeting Duration (3 hours = 180 minutes)
        // Note: This is informational - actual expiration is handled by backend canJoinMeeting()
        defaultLocalDisplayName: userName,
        defaultRemoteDisplayName: 'Healthcare Provider',

        // Video/Audio Quality - Professional Settings
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        resolution: 720,                      // HD quality
        constraints: {
          video: {
            height: { ideal: 720, max: 1080, min: 360 },
            width: { ideal: 1280, max: 1920, min: 640 }
          }
        },
        enableLayerSuspension: true,          // Optimize bandwidth

        // Recording & Streaming - ALL ENABLED
        fileRecordingsEnabled: true,          // Local recording
        fileRecordingsServiceEnabled: true,   // Cloud recording
        fileRecordingsServiceSharingEnabled: true,
        liveStreamingEnabled: true,           // Live streaming capability
        recordingService: {
          enabled: true,
          sharingEnabled: true
        },

        // Screen Sharing - FULL SUPPORT
        desktopSharingChromeExtId: null,
        desktopSharingChromeSources: ['screen', 'window', 'tab'],
        desktopSharingChromeMinExtVersion: '0.1',
        desktopSharingFirefoxDisabled: false,

        // Chat & Communication - ALL ENABLED
        enableChat: true,                     // Public chat
        enablePrivateChat: true,              // Private messages
        enableGifSearch: true,                // GIF support in chat
        enableReactions: true,                // Emoji reactions

        // Security & Privacy
        enableE2EE: false,                    // End-to-end encryption (can enable if needed)
        enableLobbyChat: true,                // Chat in waiting room
        enableInsecureRoomNameWarning: false, // Disable warning for internal use
        p2p: {
          enabled: true,                      // Peer-to-peer for 2 participants (better quality)
          stunServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        },

        // Moderation Features - FULL CONTROL
        enableModeratorIndicator: true,       // Show moderator badge
        enableClosePage: false,
        enableForcedReload: true,
        disableRemoteMute: !isModerator,      // Only moderators can mute others

        // UI/UX Features
        prejoinPageEnabled: true,             // Device testing before join
        enableWelcomePage: false,
        enableCalendarIntegration: false,
        enableUserRolesBasedOnToken: true,

        // Notifications & Detection
        enableNoAudioDetection: true,         // Alert if audio not working
        enableNoisyMicDetection: true,        // Alert if mic too noisy
        enableTalkWhileMuted: true,           // Show notification if talking while muted
        disableJoinLeaveSounds: false,

        // Audio Settings - HIGH QUALITY
        audioQuality: {
          stereo: true,                       // Stereo audio for better quality
          opusMaxAverageBitrate: 128000      // High bitrate
        },

        // Video Settings - OPTIMIZED
        disableSimulcast: false,              // Multiple quality streams
        enableLayeredScreenSharing: true,

        // Performance - PROFESSIONAL GRADE
        channelLastN: -1,                     // Show all participants (unlimited)
        lastNLimits: {
          5: 20,
          30: 15,
          50: 10,
          70: 5,
          90: 2
        },

        // Tile View
        tileView: {
          numberOfVisibleTiles: 25            // Support large meetings
        },

        // Branding
        subject: 'CareConnect Healthcare Consultation',
        hideConferenceSubject: false,
        hideConferenceTimer: false,
        conferenceInfo: {
          alwaysVisible: ['recording', 'local-recording'],
          autoHide: []
        },

        // Advanced Features
        startAudioOnly: false,
        startScreenSharing: false,
        openBridgeChannel: 'websocket',

        // Analytics - ENABLED for monitoring
        analytics: {
          disabled: false,
          rtcstatsEnabled: true,
          rtcstatsSendInterval: 1000
        },

        // Testing Features
        testing: {
          testMode: false,
          capScreenshareBitrate: 0,           // No limit
          noAutoPlayVideo: false
        },

        // Toolbar Buttons - ALL PROFESSIONAL FEATURES
        toolbarButtons: [
          'microphone',           // Mic toggle
          'camera',              // Camera toggle
          'closedcaptions',      // Closed captions
          'desktop',             // Screen sharing
          'fullscreen',          // Fullscreen mode
          'fodeviceselection',   // Device selection
          'hangup',              // Leave call
          'profile',             // Edit profile
          'chat',                // Chat panel
          'recording',           // Recording (if moderator)
          'livestreaming',       // Live streaming (if moderator)
          'sharedvideo',         // YouTube sharing
          'settings',            // Settings
          'raisehand',           // Raise hand
          'videoquality',        // Video quality control
          'filmstrip',           // Filmstrip toggle
          'invite',              // Invite people
          'stats',               // Connection stats
          'shortcuts',           // Keyboard shortcuts
          'tileview',            // Tile view
          'videobackgroundblur', // Background blur
          'download',            // Download
          'help',                // Help
          'mute-everyone',       // Mute all (moderator only)
          'security',            // Security options (moderator only)
          'participants-pane'    // Participants panel
        ],

        // Mobile Settings
        disableDeepLinking: false,

        // Language
        defaultLanguage: 'en',

        // Other Professional Features
        enableDisplayNameInStats: true,
        enableEmailInStats: false,
        enableOpusRed: true,                  // Audio redundancy for reliability
        enableNoiseCancellation: true,        // Noise suppression
        enableTcc: true,                      // Transport-wide congestion control
        enableRemb: true,                     // Receiver estimated maximum bitrate

        // Virtual Background Support
        backgroundAlpha: 0.5,
        disableVideoBackground: false,

        // Connection Quality
        connectionIndicators: {
          autoHide: true,
          autoHideTimeout: 5000,
          disabled: false,
          disableDetails: false,
          inactiveDisabled: false
        }
      },

      // ========== Interface Configuration ==========
      interfaceConfigOverwrite: {
        // Branding - CareConnect Healthcare
        APP_NAME: 'CareConnect',
        BRAND_WATERMARK_LINK: '',
        DEFAULT_BACKGROUND: '#047857',        // Healthcare green
        DEFAULT_LOCAL_DISPLAY_NAME: 'Me',
        DEFAULT_REMOTE_DISPLAY_NAME: 'Healthcare Provider',

        // Watermarks - DISABLED for professional look
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        SHOW_BRAND_WATERMARK: false,
        JITSI_WATERMARK_LINK: '',

        // Display Settings
        DISABLE_VIDEO_BACKGROUND: false,
        INITIAL_TOOLBAR_TIMEOUT: 20000,
        TOOLBAR_TIMEOUT: 4000,
        TOOLBAR_ALWAYS_VISIBLE: false,
        HIDE_INVITE_MORE_HEADER: false,

        // Film Strip
        FILM_STRIP_MAX_HEIGHT: 120,
        VERTICAL_FILMSTRIP: true,

        // Welcome Page
        GENERATE_ROOMNAMES_ON_WELCOME_PAGE: false,
        DISPLAY_WELCOME_PAGE_CONTENT: false,
        DISPLAY_WELCOME_PAGE_TOOLBAR_ADDITIONAL_CONTENT: false,

        // Settings Sections - ALL ENABLED
        SETTINGS_SECTIONS: [
          'devices',
          'language',
          'moderator',
          'profile',
          'calendar',
          'sounds',
          'more'
        ],

        // Notifications
        DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
        DISABLE_PRESENCE_STATUS: false,
        DISABLE_DOMINANT_SPEAKER_INDICATOR: false,
        DISABLE_FOCUS_INDICATOR: false,
        DISABLE_RINGING: false,
        AUDIO_LEVEL_PRIMARY_COLOR: 'rgba(4, 120, 87, 0.8)',     // CareConnect green
        AUDIO_LEVEL_SECONDARY_COLOR: 'rgba(4, 120, 87, 0.4)',

        // Mobile
        MOBILE_APP_PROMO: false,
        OPTIMAL_BROWSERS: ['chrome', 'chromium', 'firefox', 'nwjs', 'electron', 'safari', 'edge'],
        UNSUPPORTED_BROWSERS: [],

        // Provider Info
        PROVIDER_NAME: 'CareConnect Healthcare',
        NATIVE_APP_NAME: 'CareConnect',

        // Recording UI
        HIDE_RECORDING_LABEL: false,

        // Recent List
        RECENT_LIST_ENABLED: true,

        // Video Layout
        VIDEO_LAYOUT_FIT: 'both',
        VIDEO_QUALITY_LABEL_DISABLED: false,

        // Promotional Content - DISABLED
        SHOW_PROMOTIONAL_CLOSE_PAGE: false,
        SHOW_CHROME_EXTENSION_BANNER: false,

        // Controls
        DISABLE_TRANSCRIPTION_SUBTITLES: false,
        DISABLE_RINGING: false,

        // Connection
        CONNECTION_INDICATOR_AUTO_HIDE_ENABLED: true,
        CONNECTION_INDICATOR_AUTO_HIDE_TIMEOUT: 5000,
        CONNECTION_INDICATOR_DISABLED: false
      }
    };
  },

  /**
   * Get minimal configuration for testing/development
   */
  getBasicConfig: (roomName, userName) => {
    return {
      roomName: roomName,
      width: '100%',
      height: '100%',
      userInfo: {
        displayName: userName
      },
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        enableChat: true,
        enableReactions: true
      }
    };
  }
};

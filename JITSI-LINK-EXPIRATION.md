# Jitsi Meeting Link Auto-Expiration Guide

## ✅ Auto-Expiration is Now Implemented!

Your Jitsi meeting links now automatically expire based on appointment time. This is a **critical security feature** for healthcare!

---

## 🕐 How It Works

### Meeting Time Window Formula:
```
Meeting Available From: Appointment Time - 15 minutes (configurable)
Meeting Expires At:     Appointment End Time + 30 minutes (configurable)
```

### Example Scenario:
```
Appointment Details:
- Scheduled Time: 2:00 PM
- Duration: 60 minutes
- Ends At: 3:00 PM

Meeting Link Access:
✓ Available from: 1:45 PM (15 min before)
✓ Expires at:     3:30 PM (30 min after end)

Total window: 1 hour 45 minutes
```

---

## ⚙️ Configuration

### Environment Variables (`.env`)
```env
# How early can users join before appointment (minutes)
JITSI_ALLOW_EARLY_MINUTES=15

# How late can users join after appointment ends (minutes)
JITSI_MAX_LATE_MINUTES=30
```

### Examples:

#### Strict Security (Short Window)
```env
JITSI_ALLOW_EARLY_MINUTES=5
JITSI_MAX_LATE_MINUTES=10
```
- Users can join 5 min before
- Link expires 10 min after appointment ends
- **Best for:** Highly sensitive consultations

#### Flexible Access (Longer Window)
```env
JITSI_ALLOW_EARLY_MINUTES=30
JITSI_MAX_LATE_MINUTES=60
```
- Users can join 30 min before
- Link expires 1 hour after appointment ends
- **Best for:** Group sessions, therapy

#### Default (Balanced)
```env
JITSI_ALLOW_EARLY_MINUTES=15
JITSI_MAX_LATE_MINUTES=30
```
- Standard healthcare setting ✅

---

## 📡 API Response

### When link is ACCESSIBLE:
```json
GET /api/appointments/123/jitsi

{
  "jitsi": {
    "roomName": "CareConnect_123_abc12345",
    "meetingUrl": "http://localhost:8000/CareConnect_123_abc12345",
    "access": {
      "canJoin": true,
      "status": "available",
      "message": "You can join the meeting now. Your appointment starts in 10 minutes.",
      "availableAt": "2025-12-26T13:45:00.000Z",
      "expiresAt": "2025-12-26T15:30:00.000Z",
      "timeUntilExpiry": 105
    }
  }
}
```

### When link is TOO EARLY:
```json
{
  "jitsi": {
    "access": {
      "canJoin": false,
      "status": "too_early",
      "message": "Meeting opens 45m before your appointment.",
      "timeUntilAvailable": 45,
      "availableAt": "2025-12-26T13:45:00.000Z",
      "expiresAt": "2025-12-26T15:30:00.000Z"
    }
  }
}
```

### When link is EXPIRED:
```json
{
  "jitsi": {
    "access": {
      "canJoin": false,
      "status": "expired",
      "message": "This meeting link has expired. Please contact support if you need assistance.",
      "availableAt": "2025-12-26T13:45:00.000Z",
      "expiresAt": "2025-12-26T15:30:00.000Z",
      "expiredAt": "2025-12-26T16:00:00.000Z"
    }
  }
}
```

---

## 🎯 Status Codes

| Status | Description | Can Join? |
|--------|-------------|-----------|
| `available` | Meeting is currently accessible | ✅ YES |
| `too_early` | Before the access window | ❌ NO |
| `expired` | After the access window | ❌ NO |

---

## 🔒 Security Benefits

### 1. **Prevents Unauthorized Access**
- Links can't be used outside appointment time
- Even if link is leaked, it expires automatically

### 2. **HIPAA Compliance**
- Time-limited access to sensitive sessions
- Automatic link invalidation

### 3. **No Manual Cleanup**
- Links expire automatically
- No need to manually disable old links

### 4. **Prevents Link Reuse**
- Old appointment links can't be reused
- Each appointment has its own time window

---

## 📊 Timeline Visualization

```
Timeline for a 2:00 PM appointment (60 min duration):

1:00 PM  |------------------------------|
         |                              |
1:30 PM  |                              |
         |                              |
1:45 PM  |========== WINDOW OPENS ======| 🟢 Can join now!
         |                              |
2:00 PM  |====== APPOINTMENT START =====| 🟢 Appointment begins
         |                              |
2:30 PM  |                              | 🟢 Still in session
         |                              |
3:00 PM  |====== APPOINTMENT END ======| 🟢 Appointment ends
         |                              |
3:15 PM  |                              | 🟢 Still accessible (grace period)
         |                              |
3:30 PM  |========== WINDOW CLOSES =====| 🔴 Link expired!
         |                              |
4:00 PM  |------------------------------|
```

---

## 🧪 Testing Expiration

### Test 1: Check Access Before Appointment
```bash
# Create appointment for tomorrow 2:00 PM
# Try to access now
curl http://localhost:5000/api/appointments/123/jitsi \
  -H "Authorization: Bearer TOKEN"

# Expected: "too_early" status
```

### Test 2: Check Access During Window
```bash
# Create appointment for NOW + 10 minutes
# Access link
curl http://localhost:5000/api/appointments/123/jitsi \
  -H "Authorization: Bearer TOKEN"

# Expected: "available" status, canJoin: true
```

### Test 3: Check Access After Expiration
```bash
# Create appointment for yesterday
# Try to access now
curl http://localhost:5000/api/appointments/123/jitsi \
  -H "Authorization: Bearer TOKEN"

# Expected: "expired" status
```

---

## 💡 Frontend Implementation

### Display Status to Users

```javascript
// Call API
const response = await fetch(`/api/appointments/${id}/jitsi`);
const data = await response.json();

// Check access status
if (data.jitsi.access.canJoin) {
  // Show "Join Meeting" button
  button.disabled = false;
  button.text = "Join Meeting";
} else if (data.jitsi.access.status === 'too_early') {
  // Show countdown timer
  button.disabled = true;
  button.text = `Opens in ${data.jitsi.access.timeUntilAvailable} minutes`;
} else if (data.jitsi.access.status === 'expired') {
  // Show error message
  button.disabled = true;
  button.text = "Meeting Ended";
  showError(data.jitsi.access.message);
}
```

### Auto-Refresh Access Status
```javascript
// Check every minute if meeting is now available
setInterval(async () => {
  const status = await checkMeetingAccess(appointmentId);
  updateUI(status);
}, 60000); // Check every 60 seconds
```

---

## 🔧 Advanced Configuration

### Different Rules for Different Appointment Types

#### Emergency Consultations
```env
JITSI_ALLOW_EARLY_MINUTES=60  # Can join 1 hour early
JITSI_MAX_LATE_MINUTES=120    # Valid for 2 hours after
```

#### Quick Check-ups
```env
JITSI_ALLOW_EARLY_MINUTES=5   # Join 5 min before
JITSI_MAX_LATE_MINUTES=15     # Expires 15 min after
```

#### Group Therapy Sessions
```env
JITSI_ALLOW_EARLY_MINUTES=30  # Can join early
JITSI_MAX_LATE_MINUTES=60     # Long grace period
```

---

## ✨ Summary

✅ **Links automatically expire** based on appointment time
✅ **Configurable time windows** via environment variables
✅ **API returns access status** with detailed information
✅ **Three states:** `available`, `too_early`, `expired`
✅ **Security enhanced** for HIPAA compliance
✅ **No manual link management** required

---

## 🎓 Key Points

1. **Meeting URL stays the same** - only access window changes
2. **Jitsi server doesn't enforce this** - your backend controls access
3. **Frontend must check `canJoin`** before allowing users to join
4. **Time zone handled** - all times in UTC (ISO format)
5. **Grace period included** - users can join after appointment ends

---

**Your Jitsi links are now time-limited and auto-expire!** 🎉

Configure the window times in your `.env` file to match your healthcare requirements.

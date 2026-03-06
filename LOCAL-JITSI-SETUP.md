# Using Local Jitsi Server (localhost:8000)

## ✅ Current Configuration

Your system is now configured to use your **local Jitsi server** running on `localhost:8000`.

### Environment Variable
```env
JITSI_DOMAIN=localhost:8000
```

This is already set in your `.env` file! ✅

---

## 🚀 How It Works

### 1. **Automatic Protocol Detection**
The system automatically uses:
- `http://` for localhost/127.0.0.1
- `https://` for all other domains

### 2. **Meeting URL Generation**
When an appointment is created:
```javascript
Room Name: CareConnect_123_a1b2c3d4e5f6g7h8
Meeting URL: http://localhost:8000/CareConnect_123_a1b2c3d4e5f6g7h8
```

---

## 🧪 Testing Your Local Jitsi Server

### Step 1: Verify Jitsi Server is Running
Open your browser and go to:
```
http://localhost:8000
```

You should see the Jitsi Meet interface.

### Step 2: Test Backend Configuration
Run the test script:
```bash
node test-jitsi-config.js
```

**Expected Output:**
```
🔍 Testing Jitsi Server Availability...

Testing: http://localhost:8000
✅ Jitsi server is reachable!
   Status: 200
   Protocol: http
   Domain: localhost:8000

🏠 Using LOCAL Jitsi server
   ✓ Great for development and testing
   ✓ Full control over configuration
   ✓ No internet required
```

### Step 3: Create a Test Appointment
Create a teleconference appointment through your booking flow, then check the database:

```sql
SELECT
  id,
  sessionType,
  jitsi_room_name,
  jitsi_meeting_url
FROM appointments
WHERE sessionType = 'teleconference'
ORDER BY id DESC
LIMIT 5;
```

**Expected Result:**
```
id  | sessionType    | jitsi_room_name              | jitsi_meeting_url
----+----------------+------------------------------+------------------------------------------------
123 | teleconference | CareConnect_123_abc12345678  | http://localhost:8000/CareConnect_123_abc12345678
```

### Step 4: Test the API Endpoint
```bash
# Replace {appointmentId} with actual appointment ID
curl http://localhost:5000/api/appointments/{appointmentId}/jitsi \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "appointmentId": 123,
  "sessionType": "teleconference",
  "jitsi": {
    "roomName": "CareConnect_123_abc12345678",
    "meetingUrl": "http://localhost:8000/CareConnect_123_abc12345678"
  }
}
```

### Step 5: Join the Meeting
Open the meeting URL in your browser:
```
http://localhost:8000/CareConnect_123_abc12345678
```

You should see the Jitsi Meet conference interface!

---

## 🔧 Local Jitsi Server Configuration

### Check Jitsi Config Files
Your Jitsi server configuration is typically in:
```
/etc/jitsi/meet/localhost-config.js
```

### Important Settings for Healthcare
Edit your Jitsi config to enable these features:

```javascript
// Enable pre-join page (test devices before joining)
prejoinPageEnabled: true,

// Require display names
requireDisplayName: true,

// Disable auto-join (useful for waiting room)
enableWelcomePage: false,

// Enable lobby for privacy
enableLobbyChat: true,

// Start with video on for healthcare
startWithVideoMuted: false,
startWithAudioMuted: false,

// Enable recording for medical records
fileRecordingsEnabled: true,

// Better video quality for medical consultations
resolution: 720,
constraints: {
  video: {
    height: { ideal: 720, max: 1080, min: 360 }
  }
}
```

---

## 🎯 Advantages of Local Jitsi Server

### ✅ Privacy & Security
- All data stays on your server
- No third-party servers involved
- Full HIPAA compliance possible

### ✅ Customization
- Complete control over features
- Custom branding
- No Jitsi watermarks

### ✅ Performance
- Low latency (local network)
- No internet bandwidth usage
- Faster connection

### ✅ Reliability
- Works without internet
- No dependency on external services
- You control uptime

---

## 🔍 Troubleshooting

### Issue: "Failed to reach Jitsi server"
**Solution:**
1. Check if Jitsi is running:
   ```bash
   sudo systemctl status jitsi-videobridge2
   sudo systemctl status jicofo
   sudo systemctl status prosody
   ```

2. Check if port 8000 is open:
   ```bash
   netstat -tuln | grep 8000
   ```

3. Try accessing directly:
   ```
   http://localhost:8000
   ```

### Issue: "Meeting URL not generated"
**Solution:**
1. Check `.env` file has: `JITSI_DOMAIN=localhost:8000`
2. Restart your backend server
3. Create a new appointment

### Issue: "Can't join meeting"
**Solution:**
1. Open browser console (F12)
2. Check for errors
3. Verify URL format: `http://localhost:8000/RoomName`
4. Try in incognito mode

---

## 📝 Quick Reference

### Current Setup
```
Backend Server: localhost:5000
Jitsi Server:   localhost:8000
Database:       AWS RDS
```

### Meeting URL Format
```
http://localhost:8000/CareConnect_{appointmentId}_{hash}
```

### API Endpoint
```
GET /api/appointments/{id}/jitsi
```

### Test Command
```bash
node test-jitsi-config.js
```

---

## 🎓 Next Steps

### For Production Deployment
When you're ready to deploy to production:

1. **Get a domain name** (e.g., `video.careconnect.com`)

2. **Update .env:**
   ```env
   JITSI_DOMAIN=video.careconnect.com
   ```

3. **Configure SSL certificate** on your Jitsi server

4. **Enable JWT authentication** for security:
   ```env
   JITSI_APP_ID=your_app_id
   JITSI_APP_SECRET=your_secret_key
   ```

5. **Test with production domain**

---

## ✨ You're All Set!

Your backend is now configured to use your local Jitsi server at `localhost:8000`.

**Test it now:**
```bash
node test-jitsi-config.js
```

Then create a teleconference appointment and see the magic happen! 🎉

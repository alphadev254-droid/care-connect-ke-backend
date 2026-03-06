# Jitsi Video Conferencing Integration - Implementation Complete

## ✅ What's Been Implemented

### 1. Database Changes
- ✅ Added `jitsi_room_name` column to appointments table
- ✅ Added `jitsi_meeting_url` column to appointments table

### 2. Backend Services Created
- ✅ `jitsiService.js` - Handles Jitsi link generation and validation
- ✅ Updated `bookingService.js` - Automatically generates Jitsi links when creating teleconference appointments
- ✅ Updated `Appointment` model - Added Jitsi fields

### 3. API Endpoints
- ✅ `GET /api/appointments/:id/jitsi` - Get Jitsi meeting details for an appointment

---

## 🚀 How It Works

### Automatic Link Generation
When a patient books a **teleconference appointment**:

1. Patient selects a time slot and chooses `sessionType: "teleconference"`
2. After successful booking fee payment, the system creates the appointment
3. **Jitsi link is automatically generated** with:
   - Unique room name: `CareConnect_{appointmentId}_{secureHash}`
   - Full meeting URL: `https://meet.jit.si/CareConnect_{appointmentId}_{secureHash}`
4. Both fields are saved to the appointment record in the database

### Generated Link Format
```
Room Name: CareConnect_123_a1b2c3d4e5f6g7h8
Meeting URL: https://meet.jit.si/CareConnect_123_a1b2c3d4e5f6g7h8
```

---

## 📡 API Usage

### Get Jitsi Meeting Link
```http
GET /api/appointments/{appointmentId}/jitsi
Authorization: Bearer {token}
```

**Response (Success):**
```json
{
  "appointmentId": 123,
  "sessionType": "teleconference",
  "scheduledDate": "2025-01-15T14:00:00.000Z",
  "status": "session_waiting",
  "jitsi": {
    "roomName": "CareConnect_123_a1b2c3d4e5f6g7h8",
    "meetingUrl": "https://meet.jit.si/CareConnect_123_a1b2c3d4e5f6g7h8"
  },
  "participants": {
    "patient": {
      "id": 45,
      "name": "John Doe",
      "email": "john@example.com"
    },
    "caregiver": {
      "id": 12,
      "name": "Dr. Sarah Smith",
      "specialty": "General Practice"
    }
  }
}
```

---

## 🧪 Testing the Implementation

### Step 1: Start Your Backend Server
```bash
cd "C:\Users\HP\PycharmProjects\Homecare system\HomeCareSystem-Backend"
npm start
```

### Step 2: Create a Teleconference Appointment
Use your existing booking flow to create an appointment with `sessionType: "teleconference"`

### Step 3: Check the Database
```sql
SELECT id, sessionType, jitsi_room_name, jitsi_meeting_url
FROM appointments
WHERE sessionType = 'teleconference'
ORDER BY id DESC
LIMIT 5;
```

You should see the Jitsi fields populated!

### Step 4: Test the API Endpoint
```bash
# Get a teleconference appointment's Jitsi link
curl http://localhost:5000/api/appointments/{appointmentId}/jitsi \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔧 Configuration (Optional)

### Environment Variables
Add these to your `.env` file for custom configuration:

```env
# Jitsi Configuration (Optional - defaults to meet.jit.si)
JITSI_DOMAIN=meet.jit.si

# Time restrictions (Optional - defaults shown)
JITSI_ALLOW_EARLY_MINUTES=15
JITSI_MAX_LATE_MINUTES=120

# For secure Jitsi server (Advanced - only if using your own server)
JITSI_APP_ID=your_app_id
JITSI_APP_SECRET=your_app_secret
```

---

## 🌐 Using Jitsi Meet (Free Public Server)

The system is configured to use **meet.jit.si** (Jitsi's free public server) by default.

**Pros:**
- ✅ No setup required
- ✅ Free to use
- ✅ Works immediately
- ✅ Supports unlimited participants
- ✅ No account needed

**Cons:**
- ⚠️ Not HIPAA compliant (for production, use self-hosted)
- ⚠️ Public server (shared with other users)

---

## 🏥 Production Deployment (Self-Hosted Jitsi)

For **HIPAA compliance** and **production use**, you should host your own Jitsi server.

### Quick Setup Options:

#### Option 1: Docker (Easiest for Local Testing)
```bash
# Clone Jitsi Docker repo
git clone https://github.com/jitsi/docker-jitsi-meet
cd docker-jitsi-meet

# Generate config
cp env.example .env
./gen-passwords.sh

# Start services
docker-compose up -d
```

Then set in your `.env`:
```env
JITSI_DOMAIN=localhost:8443
```

#### Option 2: Ubuntu Server (Production)
```bash
# Install Jitsi on Ubuntu 20.04+
sudo apt update
sudo apt install -y apt-transport-https
sudo curl https://download.jitsi.org/jitsi-key.gpg.key | sudo sh -c 'gpg --dearmor > /usr/share/keyrings/jitsi-keyring.gpg'
echo "deb [signed-by=/usr/share/keyrings/jitsi-keyring.gpg] https://download.jitsi.org stable/" | sudo tee /etc/apt/sources.list.d/jitsi-stable.list
sudo apt update
sudo apt install -y jitsi-meet
```

Then point your domain to the server and update `.env`:
```env
JITSI_DOMAIN=video.yourhealthcareapp.com
```

---

## 📋 Next Steps

### For Frontend Integration:
1. When user clicks "Join Call" button
2. Frontend makes API call to `GET /api/appointments/{id}/jitsi`
3. Receives the `meetingUrl`
4. Opens Jitsi meeting using one of these methods:
   - **Option A:** Redirect to `meetingUrl` directly
   - **Option B:** Embed Jitsi in iframe
   - **Option C:** Use Jitsi React SDK (already created for you)

### For Testing:
1. Create a test teleconference appointment
2. Check database for Jitsi links
3. Test the API endpoint
4. Open the meeting URL in browser
5. Verify both patient and caregiver can join the same room

---

## 🔍 Troubleshooting

### Jitsi Link Not Generated?
1. Check appointment `sessionType` is `"teleconference"` or `"video"`
2. Verify booking payment completed successfully
3. Check server logs for errors during appointment creation

### Can't Access Meeting?
1. Verify the time restrictions (default: 15 min before to 2 hours after)
2. Check appointment status is `session_waiting`
3. Ensure user has permission (patient or caregiver for that appointment)

### Database Errors?
Run these SQL commands to verify:
```sql
-- Check if columns exist
DESCRIBE appointments;

-- Check existing teleconference appointments
SELECT * FROM appointments WHERE sessionType = 'teleconference';
```

---

## 📚 File Reference

### Created Files:
- `src/services/jitsiService.js` - Jitsi utility functions
- `src/scripts/addJitsiFields.js` - Database migration script
- `TEST_JITSI.md` - This documentation

### Modified Files:
- `src/models/Appointment.js` - Added jitsiRoomName & jitsiMeetingUrl fields
- `src/services/bookingService.js` - Auto-generate Jitsi links on booking
- `src/controllers/appointmentController.js` - Added getJitsiMeetingDetails endpoint
- `src/routes/appointment.routes.js` - Added GET /:id/jitsi route

---

## ✨ Features Included

✅ Automatic Jitsi link generation for teleconference appointments
✅ Secure, unique room names for each appointment
✅ Time-based access control (join 15min before, up to 2hrs after)
✅ API endpoint to retrieve meeting details
✅ Support for both patients and caregivers
✅ Works with free public Jitsi server (meet.jit.si)
✅ Ready for self-hosted Jitsi server configuration
✅ JWT token generation for secure Jitsi domains (optional)
✅ Participant validation and authorization

---

**Implementation Complete! 🎉**

The backend is now fully configured to generate and serve Jitsi video conferencing links for all teleconference appointments. When you're ready, integrate the frontend to consume these endpoints!

# Home Care System Backend

A comprehensive digital healthcare platform enabling patients to connect with verified caregivers, schedule appointments, participate in teleconference sessions, and manage care reports with real-time status tracking and automated alerts.

## 🏗️ System Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (React/Vue)   │◄──►│   (Node.js)     │◄──►│   (MySQL)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
┌─────────────────┬─────────────────┬─────────────────┐
│  Email Service  │  SMS Service    │  Payment        │
│  (Nodemailer)   │  (TextSMS)      │  (Stripe)       │
└─────────────────┴─────────────────┴─────────────────┘
```

### Core Components

**1. Authentication Layer**
- JWT-based authentication
- Role-based access control (RBAC)
- Password encryption with bcrypt

**2. Business Logic Layer**
- Controllers handle HTTP requests
- Services contain business logic
- Middleware for validation and security

**3. Data Layer**
- Sequelize ORM for database operations
- MySQL for data persistence
- Model associations and relationships

**4. External Services**
- TextSMS for notifications
- Nodemailer for email
- Stripe for payments
- Mock video service (replaceable)

## 🔄 Complete System Flow

### 1. User Registration & Verification Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Patient   │    │  Caregiver  │    │  Physician  │    │    Admin    │
│ Registers   │    │ Registers   │    │ Registers   │    │  Verifies   │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    User Management System                           │
│  • Email validation    • Password hashing    • Role assignment     │
│  • Profile creation    • Credential storage  • Status tracking     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │   Verification Queue    │
                    │  (Caregivers/Physicians)│
                    └─────────────────────────┘
```

### 2. Caregiver Matching & Appointment Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Patient   │    │ Specialties │    │ Caregivers  │    │Appointment  │
│ Searches    │───►│ Database    │───►│ Filtered    │───►│ Created     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                                      │                  │
      ▼                                      ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Select by   │    │ View Profiles│    │ Book Session│    │Notifications│
│ Specialty   │    │ & Ratings   │    │ (In-person/ │    │ Sent (Email │
│ & Location  │    │             │    │ Virtual)    │    │ & SMS)      │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 3. Care Session & Reporting Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Appointment │    │ Session     │    │ Care Report │    │ Status      │
│ Confirmed   │───►│ Conducted   │───►│ Created     │───►│ Evaluated   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Video Room  │    │ Session     │    │ Mandatory   │    │ Alert       │
│ Created     │    │ Recording & │    │ Fields:     │    │ System      │
│ (if virtual)│    │ Notes       │    │ • Vitals    │    │ Triggered   │
│             │    │             │    │ • Status    │    │ (if critical)│
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 4. Patient Status Tracking & Alert System
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Caregiver   │    │ Patient     │    │ Alert       │    │ Notification│
│ Submits     │───►│ Status      │───►│ Severity    │───►│ Dispatch    │
│ Report      │    │ Updated     │    │ Determined  │    │ System      │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Status      │    │ Timeline    │    │ Critical    │    │ Emergency   │
│ Options:    │    │ Updated     │    │ Alerts:     │    │ Contacts    │
│ • Stable    │    │             │    │ • Email     │    │ Notified    │
│ • Improving │    │             │    │ • SMS       │    │ (Email+SMS) │
│ • Critical  │    │             │    │ • Dashboard │    │             │
│ • Deceased  │    │             │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## 🎯 Key Features & Workflows

### User Roles & Permissions

**Patients**
- Register and manage profile
- Search caregivers by specialty
- Book appointments (in-person/virtual)
- View care reports and status history
- Make payments

**Caregivers**
- Register with credentials
- Await admin verification
- Manage availability and specialties
- Conduct care sessions
- Submit mandatory care reports
- Update patient status

**Primary Physicians**
- Register with medical license
- Recommend specific caregivers
- Monitor patient progress
- Access care reports

**Administrators**
- Verify caregiver credentials
- Manage system specialties
- Monitor platform statistics
- Handle critical alerts

### Specialty-Based Matching System
```
Specialties Available:
├── Nursing
├── Geriatric Care
├── Pediatric Care
├── Physiotherapy
├── Mental Health Support
├── Post-operative Care
├── Disability Support
├── Nutrition
├── Maternal Health
└── Medication Management
```

### Patient Status Tracking
```
Status Levels & Actions:
├── Stable ────────────► Normal monitoring
├── Improving ─────────► Positive progress tracking
├── Deteriorating ─────► HIGH ALERT → Email + SMS
├── Critical ──────────► CRITICAL ALERT → Immediate notification
├── Cured/Recovered ───► Care completion
└── Deceased ──────────► CRITICAL ALERT → Protocol activation
```

## 🔧 Technical Implementation

### Database Schema
```
Core Entities:
├── Users (base authentication)
├── Patients (patient-specific data)
├── Caregivers (caregiver profiles)
├── PrimaryPhysicians (doctor profiles)
├── Specialties (medical categories)
├── Appointments (session bookings)
├── CareSessionReports (post-session data)
├── TeleconferenceSessions (video sessions)
├── PaymentTransactions (billing)
├── CaregiverRecommendations (physician referrals)
└── StatusAlerts (automated notifications)
```

### API Architecture
```
RESTful API Structure:
├── /auth (authentication)
├── /users (profile management)
├── /caregivers (caregiver operations)
├── /appointments (booking system)
├── /reports (care documentation)
├── /teleconference (video sessions)
├── /specialties (medical categories)
└── /admin (administrative functions)
```

### Security Implementation
- **Authentication**: JWT tokens with expiration
- **Authorization**: Role-based middleware
- **Data Protection**: Bcrypt password hashing
- **Input Validation**: Express-validator middleware
- **Security Headers**: Helmet.js protection
- **CORS**: Configured for frontend domain
- **Audit Logging**: Winston comprehensive logging

## 📱 Notification System

### Multi-Channel Alerts
```
Notification Triggers:
├── Appointment Confirmations ──► Email + SMS
├── Session Reminders ──────────► SMS
├── Status Alerts (Critical) ───► Email + SMS + Dashboard
├── Payment Confirmations ──────► Email
└── System Updates ─────────────► Email
```

### TextSMS Integration
- Kenyan phone number formatting (+254)
- Emergency contact notifications
- Real-time status alerts
- Appointment reminders

## 💳 Payment Processing

### Stripe Integration Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Appointment │───►│ Cost        │───►│ Payment     │───►│ Transaction │
│ Completed   │    │ Calculated  │    │ Processed   │    │ Recorded    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                         │                  │                  │
                         ▼                  ▼                  ▼
                   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
                   │ Hourly Rate │    │ Stripe API  │    │ Receipt     │
                   │ × Duration  │    │ Integration │    │ Generated   │
                   └─────────────┘    └─────────────┘    └─────────────┘
```

## 🚀 Deployment Architecture

### Production Setup
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │───►│   Node.js App   │───►│   MySQL DB      │
│   (Nginx)       │    │   (PM2 Cluster) │    │   (Master/Slave)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SSL/TLS       │    │   Environment   │    │   Backup        │
│   Certificates  │    │   Variables     │    │   Strategy      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📊 Monitoring & Analytics

### System Metrics
- User registration trends
- Appointment completion rates
- Caregiver verification status
- Patient status distribution
- Payment transaction success
- Alert response times
- System performance metrics

### Health Monitoring
- Database connection status
- External service availability
- Error rate tracking
- Response time monitoring
- Resource utilization

## 🔄 Data Flow Summary

1. **Registration** → User creates account → Role-specific profile created
2. **Verification** → Admin verifies caregivers → Status updated
3. **Matching** → Patient searches by specialty → Caregiver list filtered
4. **Booking** → Appointment scheduled → Notifications sent
5. **Session** → Care provided → Video/in-person session
6. **Reporting** → Caregiver submits report → Patient status updated
7. **Alerting** → Critical status triggers → Multi-channel notifications
8. **Payment** → Session completed → Automatic billing processed
9. **Analytics** → Data aggregated → Dashboard insights generated

This architecture ensures scalability, security, and comprehensive healthcare management from patient registration through care delivery and outcome tracking.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL with Sequelize ORM
- **Authentication**: JWT tokens
- **SMS**: TextSMS API
- **Payments**: Stripe
- **Email**: Nodemailer
- **File Upload**: Multer
- **Logging**: Winston

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Configure your `.env` file with actual values

5. Start the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

See `.env.example` for all required environment variables including:
- Database configuration
- JWT secrets
- TextSMS credentials
- Stripe keys
- Email settings

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

### Appointments
- `POST /api/appointments` - Create appointment
- `GET /api/appointments` - List appointments
- `GET /api/appointments/:id` - Get appointment details
- `PATCH /api/appointments/:id/status` - Update appointment status

### Caregivers
- `GET /api/caregivers` - List verified caregivers
- `GET /api/caregivers/:id` - Get caregiver details

### Reports
- `POST /api/reports` - Create care session report
- `GET /api/reports` - List reports

### Teleconference
- `POST /api/teleconference/room` - Create video room
- `POST /api/teleconference/token` - Get access token
- `POST /api/teleconference/end/:sessionId` - End session

### Admin
- `PATCH /api/admin/caregivers/:id/verify` - Verify caregiver
- `GET /api/admin/dashboard` - Dashboard statistics

## Development

Run in development mode:
```bash
npm run dev
```

The server will start on port 5000 (or PORT environment variable) with auto-reload enabled.

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure production database
3. Set up proper SSL certificates
4. Use process manager like PM2
5. Configure reverse proxy (nginx)

## License

ISC
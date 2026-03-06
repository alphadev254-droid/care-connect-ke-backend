const sequelize = require('../config/database');
const User = require('./User');
const Role = require('./Role');
const Permission = require('./Permission');
const RolePermission = require('./RolePermission');
const Patient = require('./Patient');
const Caregiver = require('./Caregiver');
const PrimaryPhysician = require('./PrimaryPhysician');
const Specialty = require('./Specialty');
const Appointment = require('./Appointment');
const TeleconferenceSession = require('./TeleconferenceSession');
const CareSessionReport = require('./CareSessionReport');
const PaymentTransaction = require('./PaymentTransaction');
const CaregiverRecommendation = require('./CaregiverRecommendation');
const StatusAlert = require('./StatusAlert');
const UserSettings = require('./UserSettings');
const TimeSlot = require('./TimeSlot');
const CaregiverAvailability = require('./CaregiverAvailability');
const Location = require('./Location');
const PendingBooking = require('./PendingBooking');
const PendingPaymentTransaction = require('./PendingPaymentTransaction');
const EmailQueue = require('./EmailQueue');
const Notification = require('./Notification');
const CaregiverEarnings = require('./CaregiverEarnings');
const WithdrawalRequest = require('./WithdrawalRequest');
const WithdrawalToken = require('./WithdrawalToken');
const Referral = require('./Referral');

// Define associations
// User-Role association
Role.hasMany(User, { foreignKey: 'role_id' });
User.belongsTo(Role, { foreignKey: 'role_id' });

// Role-Permission many-to-many
Role.belongsToMany(Permission, { through: RolePermission, foreignKey: 'role_id' });
Permission.belongsToMany(Role, { through: RolePermission, foreignKey: 'permission_id' });

User.hasOne(Patient, { foreignKey: 'userId' });
Patient.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(Caregiver, { foreignKey: 'userId' });
Caregiver.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(PrimaryPhysician, { foreignKey: 'userId' });
PrimaryPhysician.belongsTo(User, { foreignKey: 'userId' });

// Caregiver-Specialty many-to-many
Caregiver.belongsToMany(Specialty, { through: 'caregiverspecialties' });
Specialty.belongsToMany(Caregiver, { through: 'caregiverspecialties' });

// Appointments
Patient.hasMany(Appointment, { foreignKey: 'patientId' });
Appointment.belongsTo(Patient, { foreignKey: 'patientId' });

Caregiver.hasMany(Appointment, { foreignKey: 'caregiverId' });
Appointment.belongsTo(Caregiver, { foreignKey: 'caregiverId' });

// Specialty-Appointment association
Specialty.hasMany(Appointment, { foreignKey: 'specialtyId' });
Appointment.belongsTo(Specialty, { foreignKey: 'specialtyId' });

// Teleconference sessions
Appointment.hasOne(TeleconferenceSession, { foreignKey: 'appointmentId' });
TeleconferenceSession.belongsTo(Appointment, { foreignKey: 'appointmentId' });

// Care session reports
Appointment.hasOne(CareSessionReport, { foreignKey: 'appointmentId' });
CareSessionReport.belongsTo(Appointment, { foreignKey: 'appointmentId' });

// Payment transactions
Appointment.hasOne(PaymentTransaction, { foreignKey: 'appointmentId' });
PaymentTransaction.belongsTo(Appointment, { foreignKey: 'appointmentId' });

// Caregiver recommendations
PrimaryPhysician.hasMany(CaregiverRecommendation, { foreignKey: 'physicianId' });
CaregiverRecommendation.belongsTo(PrimaryPhysician, { foreignKey: 'physicianId' });

Patient.hasMany(CaregiverRecommendation, { foreignKey: 'patientId' });
CaregiverRecommendation.belongsTo(Patient, { foreignKey: 'patientId' });

Caregiver.hasMany(CaregiverRecommendation, { foreignKey: 'caregiverId' });
CaregiverRecommendation.belongsTo(Caregiver, { foreignKey: 'caregiverId' });

// Status alerts
Patient.hasMany(StatusAlert, { foreignKey: 'patientId' });
StatusAlert.belongsTo(Patient, { foreignKey: 'patientId' });

// User settings
User.hasOne(UserSettings, { foreignKey: 'userId' });
UserSettings.belongsTo(User, { foreignKey: 'userId' });

// TimeSlot associations
Caregiver.hasMany(TimeSlot, { foreignKey: 'caregiverId' });
TimeSlot.belongsTo(Caregiver, { foreignKey: 'caregiverId' });

Appointment.belongsTo(TimeSlot, { foreignKey: 'timeSlotId' });
TimeSlot.hasOne(Appointment, { foreignKey: 'timeSlotId' });

// CaregiverAvailability associations
Caregiver.hasMany(CaregiverAvailability, { foreignKey: 'caregiverId' });
CaregiverAvailability.belongsTo(Caregiver, { foreignKey: 'caregiverId' });

// PendingBooking associations
Patient.hasMany(PendingBooking, { foreignKey: 'patientId' });
PendingBooking.belongsTo(Patient, { foreignKey: 'patientId' });

Caregiver.hasMany(PendingBooking, { foreignKey: 'caregiverId' });
PendingBooking.belongsTo(Caregiver, { foreignKey: 'caregiverId' });

Specialty.hasMany(PendingBooking, { foreignKey: 'specialtyId' });
PendingBooking.belongsTo(Specialty, { foreignKey: 'specialtyId' });

TimeSlot.hasMany(PendingBooking, { foreignKey: 'timeSlotId' });
PendingBooking.belongsTo(TimeSlot, { foreignKey: 'timeSlotId' });

Location.hasMany(PendingBooking, { foreignKey: 'locationId' });
PendingBooking.belongsTo(Location, { foreignKey: 'locationId' });

Appointment.hasMany(PendingBooking, { foreignKey: 'convertedToAppointmentId' });
PendingBooking.belongsTo(Appointment, { foreignKey: 'convertedToAppointmentId', as: 'ConvertedAppointment' });

// PendingPaymentTransaction associations
PendingBooking.hasMany(PendingPaymentTransaction, { foreignKey: 'pendingBookingId' });
PendingPaymentTransaction.belongsTo(PendingBooking, { foreignKey: 'pendingBookingId' });

PaymentTransaction.hasMany(PendingPaymentTransaction, { foreignKey: 'convertedToPaymentId' });
PendingPaymentTransaction.belongsTo(PaymentTransaction, { foreignKey: 'convertedToPaymentId', as: 'ConvertedPayment' });

// Notification associations
User.hasMany(Notification, { foreignKey: 'userId' });
Notification.belongsTo(User, { foreignKey: 'userId' });

// CaregiverEarnings associations
Caregiver.hasOne(CaregiverEarnings, { foreignKey: 'caregiverId' });
CaregiverEarnings.belongsTo(Caregiver, { foreignKey: 'caregiverId' });

// WithdrawalRequest associations
Caregiver.hasMany(WithdrawalRequest, { foreignKey: 'caregiverId' });
WithdrawalRequest.belongsTo(Caregiver, { foreignKey: 'caregiverId' });

// WithdrawalToken associations
Caregiver.hasMany(WithdrawalToken, { foreignKey: 'caregiverId' });
WithdrawalToken.belongsTo(Caregiver, { foreignKey: 'caregiverId' });

// Referral associations
Caregiver.hasMany(Referral, { foreignKey: 'caregiverId', as: 'Referrals' });
Referral.belongsTo(Caregiver, { foreignKey: 'caregiverId', as: 'Caregiver' });

Patient.hasMany(Referral, { foreignKey: 'patientId' });
Referral.belongsTo(Patient, { foreignKey: 'patientId' });

// Caregiver-to-Caregiver referral association
Caregiver.hasMany(Referral, { foreignKey: 'referredCaregiverId', as: 'ReceivedReferrals' });
Referral.belongsTo(Caregiver, { foreignKey: 'referredCaregiverId', as: 'ReferredCaregiver' });

module.exports = {
  sequelize,
  User,
  Role,
  Permission,
  RolePermission,
  Patient,
  Caregiver,
  PrimaryPhysician,
  Specialty,
  Appointment,
  TeleconferenceSession,
  CareSessionReport,
  PaymentTransaction,
  CaregiverRecommendation,
  StatusAlert,
  UserSettings,
  TimeSlot,
  CaregiverAvailability,
  Location,
  PendingBooking,
  PendingPaymentTransaction,
  EmailQueue,
  Notification,
  CaregiverEarnings,
  WithdrawalRequest,
  WithdrawalToken,
  Referral
};
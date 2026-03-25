const axios = require('axios');
const logger = require('../utils/logger');

const sendSMS = async (phoneNumber, message) => {
  try {
    const partnerId = process.env.TEXTSMS_PARTNER_ID;
    const apiKey = process.env.TEXTSMS_API_KEY;
    const senderId = process.env.TEXTSMS_SENDER_ID;
    const baseUrl = process.env.TEXTSMS_BASE_URL;

    // Format phone number
    let phone = phoneNumber.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
      phone = process.env.DEFAULT_COUNTRY_CODE + phone.substring(1);
    }

    const data = {
      apikey: apiKey,
      partnerID: partnerId,
      message: message,
      shortcode: senderId,
      mobile: phone
    };

    const response = await axios.post(baseUrl, data, { timeout: 10000 });
    
    logger.info('SMS API Response:', response.data);
    
    if (response.status === 200) {
      const responseData = response.data;
      return responseData.success !== undefined ? responseData.success : true;
    }
    
    return false;
  } catch (error) {
    logger.error('SMS sending failed:', error.message);
    return false;
  }
};

const sendAppointmentReminder = async (phoneNumber, appointmentDetails) => {
  const message = `TunzaConnect\n\nAppointment Reminder:\nDate: ${appointmentDetails.scheduledDate}\nCaregiver: ${appointmentDetails.caregiverName}\nType: ${appointmentDetails.sessionType}\n\nThank you!`;
  
  return sendSMS(phoneNumber, message);
};

const sendStatusAlert = async (phoneNumber, alertDetails) => {
  const message = `TunzaConnect\n\nURGENT ALERT\nPatient: ${alertDetails.patientName}\nStatus: ${alertDetails.severity.toUpperCase()}\nMessage: ${alertDetails.message}\n\nPlease take immediate action.`;
  
  return sendSMS(phoneNumber, message);
};

module.exports = {
  sendSMS,
  sendAppointmentReminder,
  sendStatusAlert
};
const { TeleconferenceSession } = require('../models');
const { generateToken } = require('../utils/helpers');

// Mock video service - Replace with actual video service integration
const createVideoRoom = async (appointmentId) => {
  try {
    const roomName = `appointment-${appointmentId}-${Date.now()}`;
    const roomId = generateToken(16);
    
    await TeleconferenceSession.create({
      appointmentId,
      roomId
    });

    return {
      sid: roomId,
      uniqueName: roomName,
      status: 'in-progress'
    };
  } catch (error) {
    throw new Error(`Video room creation failed: ${error.message}`);
  }
};

const generateAccessToken = (roomName, identity) => {
  // Mock token generation - Replace with actual video service
  const mockToken = Buffer.from(JSON.stringify({
    room: roomName,
    identity,
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  })).toString('base64');
  
  return mockToken;
};

const endVideoRoom = async (roomSid) => {
  try {
    // Mock room ending - Replace with actual video service
    return {
      sid: roomSid,
      status: 'completed',
      endTime: new Date()
    };
  } catch (error) {
    throw new Error(`Failed to end video room: ${error.message}`);
  }
};

module.exports = {
  createVideoRoom,
  generateAccessToken,
  endVideoRoom
};
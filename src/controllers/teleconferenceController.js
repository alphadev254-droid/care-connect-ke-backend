const { createVideoRoom, generateAccessToken, endVideoRoom } = require('../services/videoService');
const { TeleconferenceSession } = require('../models');

const createRoom = async (req, res, next) => {
  try {
    const { appointmentId } = req.body;
    
    const room = await createVideoRoom(appointmentId);
    
    res.status(201).json({ 
      roomId: room.sid,
      roomName: room.uniqueName
    });
  } catch (error) {
    next(error);
  }
};

const getAccessToken = async (req, res, next) => {
  try {
    const { roomName, identity } = req.body;
    
    const token = generateAccessToken(roomName, identity || req.user.email);
    
    res.json({ token });
  } catch (error) {
    next(error);
  }
};

const endSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    const session = await TeleconferenceSession.findByPk(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await endVideoRoom(session.roomId);
    
    session.endTime = new Date();
    await session.save();
    
    res.json({ message: 'Session ended successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRoom,
  getAccessToken,
  endSession
};
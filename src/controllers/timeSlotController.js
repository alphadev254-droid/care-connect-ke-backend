const { TimeSlot, Caregiver, CaregiverAvailability, Appointment, Patient, User } = require('../models');
const { TIMESLOT_STATUS } = require('../utils/constants');
const { Op } = require('sequelize');

const parseLocalDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const toLocalDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const buildSlots = (availabilityList, caregiver, startDate, endDate) => {
  const slots = [];
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const duration = parseInt(process.env.DEFAULT_APPOINTMENT_DURATION) || caregiver.appointmentDuration || 180;

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay();
    const dateStr = toLocalDateStr(date);

    for (const avail of availabilityList) {
      if (Number(avail.dayOfWeek) !== dayOfWeek) continue;

      const [sh, sm] = avail.startTime.split(':').map(Number);
      const [eh, em] = avail.endTime.split(':').map(Number);

      const windowEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), eh, em, 0);
      let cursor = new Date(date.getFullYear(), date.getMonth(), date.getDate(), sh, sm, 0);

      while (cursor < windowEnd) {
        const slotEnd = new Date(cursor.getTime() + duration * 60000);
        if (slotEnd <= windowEnd) {
          slots.push({
            caregiverId: caregiver.id,
            date: dateStr,
            startTime: `${String(cursor.getHours()).padStart(2, '0')}:${String(cursor.getMinutes()).padStart(2, '0')}:00`,
            endTime: `${String(slotEnd.getHours()).padStart(2, '0')}:${String(slotEnd.getMinutes()).padStart(2, '0')}:00`,
            duration,
            status: TIMESLOT_STATUS.AVAILABLE,
            availabilityId: avail.id
          });
        }
        cursor = slotEnd;
      }
    }
  }
  return slots;
};

const generateTimeSlots = async (req, res, next) => {
  try {
    const { caregiverId, startDate, endDate } = req.body;

    const caregiver = await Caregiver.findByPk(caregiverId);
    if (!caregiver) return res.status(404).json({ error: 'Caregiver not found' });

    const availability = await CaregiverAvailability.findAll({
      where: { caregiverId, isActive: true }
    });
    if (!availability.length) return res.json({ message: 'No availability set', count: 0 });

    const slots = buildSlots(availability, caregiver, startDate, endDate);

    if (slots.length > 0) {
      await TimeSlot.destroy({
        where: {
          caregiverId: caregiver.id,
          status: TIMESLOT_STATUS.AVAILABLE,
          date: { [Op.between]: [startDate, endDate] }
        }
      });
      await TimeSlot.bulkCreate(slots);
    }

    res.json({ message: 'Time slots generated successfully', count: slots.length });
  } catch (error) {
    next(error);
  }
};

const generateTimeSlotsForAvailability = async (req, res, next) => {
  try {
    const { availabilityId, startDate, endDate } = req.body;

    const availability = await CaregiverAvailability.findByPk(availabilityId);
    if (!availability) return res.status(404).json({ error: 'Availability not found' });

    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver || caregiver.id !== availability.caregiverId) {
      return res.status(403).json({ error: 'Not authorized to generate slots for this availability' });
    }

    const slots = buildSlots([availability], caregiver, startDate, endDate);

    if (slots.length > 0) {
      await TimeSlot.destroy({
        where: {
          availabilityId: availability.id,
          status: TIMESLOT_STATUS.AVAILABLE,
          date: { [Op.between]: [startDate, endDate] }
        }
      });
      await TimeSlot.bulkCreate(slots);
    }

    res.json({
      message: 'Time slots generated successfully for this availability',
      count: slots.length,
      availabilityId: availability.id
    });
  } catch (error) {
    next(error);
  }
};

const getAvailableSlots = async (req, res, next) => {
  try {
    const { caregiverId, day, month, year, date, includeLocked } = req.query;

    const now = new Date();
    const todayStr = toLocalDateStr(now);
    const whereClause = { status: TIMESLOT_STATUS.AVAILABLE };

    if (date) {
      // exact date from date picker
      whereClause.date = date;
    } else if (day) {
      // fill missing month/year with current
      const m = month ? parseInt(month) : now.getMonth() + 1;
      const y = year  ? parseInt(year)  : now.getFullYear();
      const d = parseInt(day);

      // validate date
      const dateObj = new Date(y, m - 1, d);
      if (dateObj.getMonth() !== m - 1 || dateObj.getDate() !== d) {
        return res.status(400).json({ error: 'Invalid date' });
      }

      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      whereClause.date = dateStr;
    } else if (month && year) {
      const mm = String(parseInt(month)).padStart(2, '0');
      const yy = parseInt(year);
      whereClause.date = { [Op.between]: [`${yy}-${mm}-01`, `${yy}-${mm}-31`] };
    } else if (year) {
      whereClause.date = { [Op.between]: [`${parseInt(year)}-01-01`, `${parseInt(year)}-12-31`] };
    } else if (month) {
      const mm = String(parseInt(month)).padStart(2, '0');
      const yy = now.getFullYear();
      whereClause.date = { [Op.between]: [`${yy}-${mm}-01`, `${yy}-${mm}-31`] };
    } else {
      whereClause.date = { [Op.gte]: todayStr };
    }

    // never return past dates
    if (whereClause.date?.[Op.between]?.[0] < todayStr) {
      whereClause.date[Op.between][0] = todayStr;
    }

    if (!includeLocked) {
      whereClause[Op.or] = [
        { lockedUntil: null },
        { lockedUntil: { [Op.lt]: new Date() } }
      ];
    }

    if (caregiverId) whereClause.caregiverId = caregiverId;

    const slots = await TimeSlot.findAll({
      where: whereClause,
      include: [{ model: Caregiver, attributes: ['id', 'hourlyRate'] }],
      order: [['date', 'ASC'], ['startTime', 'ASC']],
      limit: 100
    });

    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

    const filteredSlots = slots.filter(slot => {
      if (slot.date === todayStr) return slot.startTime > currentTime;
      return true;
    });

    res.json({ slots: filteredSlots, count: filteredSlots.length });
  } catch (error) {
    next(error);
  }
};

const lockSlot = async (req, res, next) => {
  try {
    const { id } = req.params;
    const slot = await TimeSlot.findByPk(id);
    if (!slot) return res.status(404).json({ error: 'Time slot not found' });
    if (slot.status !== TIMESLOT_STATUS.AVAILABLE) return res.status(400).json({ error: 'Time slot not available' });

    const lockedUntil = new Date(Date.now() + 10 * 60000);
    await slot.update({ status: TIMESLOT_STATUS.LOCKED, lockedUntil });
    res.json({ slot, lockedUntil });
  } catch (error) {
    next(error);
  }
};

const unlockSlot = async (req, res, next) => {
  try {
    const { id } = req.params;
    const slot = await TimeSlot.findByPk(id);
    if (!slot) return res.status(404).json({ error: 'Time slot not found' });
    await slot.update({ status: TIMESLOT_STATUS.AVAILABLE, lockedUntil: null });
    res.json({ slot });
  } catch (error) {
    next(error);
  }
};

const getCaregiverTimeSlots = async (req, res, next) => {
  try {
    const { caregiverId } = req.params;

    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver || caregiver.id !== caregiverId) {
      return res.status(403).json({ error: 'Not authorized to view these time slots' });
    }

    const slots = await TimeSlot.findAll({
      where: {
        caregiverId,
        date: { [Op.gte]: toLocalDateStr(new Date()) }
      },
      include: [
        {
          model: Appointment,
          required: false,
          include: [
            {
              model: Patient,
              include: [{ model: User, attributes: ['firstName', 'lastName'] }]
            }
          ]
        }
      ],
      order: [['date', 'ASC'], ['startTime', 'ASC']],
      limit: 200
    });

    res.json({ slots });
  } catch (error) {
    next(error);
  }
};

const updateTimeSlotPrice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { price } = req.body;

    const slot = await TimeSlot.findByPk(id);
    if (!slot) return res.status(404).json({ error: 'Time slot not found' });

    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver || slot.caregiverId !== caregiver.id) {
      return res.status(403).json({ error: 'Not authorized to edit this time slot' });
    }

    if (slot.status !== TIMESLOT_STATUS.AVAILABLE) {
      return res.status(400).json({ error: 'Can only edit available time slots' });
    }

    await slot.update({ price: Math.round(price) });
    res.json({ slot });
  } catch (error) {
    next(error);
  }
};

const bulkUpdateTimeSlotPrices = async (req, res, next) => {
  try {
    const { price, slotIds } = req.body;

    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) return res.status(403).json({ error: 'Caregiver profile not found' });

    const whereClause = { caregiverId: caregiver.id, status: TIMESLOT_STATUS.AVAILABLE };
    if (slotIds && slotIds.length > 0) whereClause.id = { [Op.in]: slotIds };

    const [updatedCount] = await TimeSlot.update({ price: Math.round(price) }, { where: whereClause });
    res.json({ message: `Updated ${updatedCount} time slots`, updatedCount });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateTimeSlots,
  generateTimeSlotsForAvailability,
  getAvailableSlots,
  getCaregiverTimeSlots,
  updateTimeSlotPrice,
  bulkUpdateTimeSlotPrices,
  lockSlot,
  unlockSlot
};

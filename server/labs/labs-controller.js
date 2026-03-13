const Laboratory = require('./Lab');
const Reservation = require('../reservations/Reservation');
const { getTimeSlots, renderErrorPage } = require('../util/helpers');

exports.getManageLabsPage = async (req, res) => {
  try {
    const labs = await Laboratory.getAllLabs(req.query);
    console.log(labs);  
    res.render('manage-labs', {
      title: 'Manage Labs',
      headerTitle: 'Manage Labs',
      layout: 'dashboard',
      activePage: 'manage-labs',
      labs
    });

  } catch (error) {
    console.error(error);
    res.redirect('/');
  }
};

exports.getAllAvailableLabs = async (req, res) => {
  try {
    
    const selectedDate = req.query.bookingDate || new Date().toLocaleDateString('en-CA');
    const selectedLabName = req.query.labName || null;
    const datesArray = getNextNDates(7);
    const timeSlotsArray = getTimeSlots(30, "00:00", "23:59", req.query.bookingDate);


    const selectedTime = req.query.bookingTime || (timeSlotsArray.length > 0 ? timeSlotsArray[0] : null);
    const availableLabs = await Laboratory.getAvailableLabs(selectedDate, selectedTime, [selectedLabName]);
    const availableLabsNoRoomFilter = await Laboratory.getAvailableLabs(selectedDate, selectedTime);
    const labNamesArray = availableLabsNoRoomFilter.map(lab => lab.name);

    res.render('slots-availability', {
      title: 'Slots Availability',
      headerTitle: 'Slots Availability',
      layout: 'dashboard',
      activePage: 'slots-availability',
      datesArray,
      timeSlotsArray,
      labNamesArray,
      selectedDate,
      selectedTime,
      selectedLabName,
      availableLabs
    });

  } catch (err) {
    console.log(err);
  }
};


exports.createLab = async (req, res) => {
  try {
    const { name, capacity, openTime, closeTime, image } = req.body;

    const labData = {
      name,
      capacity,
      openTime,
      closeTime,
      image: image || 'lab-default.jpg'
    };

    const newLab = await Laboratory.createLab(labData);
    res.redirect('/labs/manage');
  } catch (error) {
    res.status(500).send('Error creating lab');
  }
};

exports.getLabById = async (req, res) => {
  try {
    const { id } = req.params;
    const lab = await Laboratory.getLabById(id);
    if (!lab) {
      return res.status(404).send('Lab not found');
    }
    res.render('/labs/manage', { lab }); 
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching lab for editing');
  }
};

exports.updateLab = async (req, res) => {
  try {
    const labId = req.params.id; 
    const { name, openTime, closeTime, capacity } = req.body; 

    const updatedLab = await Laboratory.updateLab(labId, {
      name,
      openTime,
      closeTime,
      capacity
    });

    res.redirect('/labs/manage'); 

  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while updating the lab.");
  }
};

// 5. DELETE: Delete a lab by ID
exports.deleteLab = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedLab = await Laboratory.deleteLab(id);

    if (!deletedLab) {
      return res.status(404).send('Lab not found');
    }

    res.redirect('/labs/manage'); 
  } catch (error) {
    res.status(500).send('Error deleting lab');
  }
};

exports.getLabSeats = async (req, res) => {
  try {

    let {seatNumber, bookingTime, bookingDate, labName, cartSession, reservationId } = req.body;
    let selectedDate = bookingDate;
    let selectedTime = bookingTime;
    let selectedLabName = labName;
    let reservation;

    if (seatNumber){
      reservationId = await Reservation.getReservationIdByLabNameDateTimeSeat(labName, bookingDate, bookingTime, seatNumber)
    }

    if (reservationId) {
      reservation = await Reservation.getReservationById(reservationId); 4
      selectedTime = reservation.slots?.[0]?.timeSlot; 
      selectedLabName = reservation.laboratory?.name; 
      selectedDate = reservation.date;
      
      cartSession = {}
      reservation.slots.forEach(slot => {
        cartSession[slot.timeSlot] = {
          seatNumber: String(slot.seatNumber), 
          status: 'checking...'
        };
      });
    } 

    
    const labId = await Laboratory.getIdByName(selectedLabName);
    const lab = await Laboratory.getLabById(labId);
    const labSeats = await Laboratory.getLabSeats(selectedLabName, selectedTime, selectedDate);
    const timeSlotsArray = getTimeSlots(30, lab.openTime, lab.closeTime, selectedDate);
  
    res.render("lab-details", {
      labSeats,
      selectedDate,
      selectedTime,
      timeSlotsArray,
      layout: "dashboard",
      activePage: "slots-availability",
      headerTitle: lab.name,
      lab,
      cartSession: JSON.stringify(cartSession),
      reservation,
      isTechnician: req.session.role === "technician",
      isLoggedIn: req.session.role
    });
  } catch (err) {
    renderErrorPage(res, err);
  }
};


exports.getSeatStatus = async (req, res) => {
  try {
    const selectedDate = req.query.bookingDate;
    const selectedTime = req.query.bookingTime;
    const selectedLabName = req.params.labName;
    const labSeats = await Laboratory.getLabSeats(selectedLabName, selectedTime, selectedDate);
    return res.json(labSeats);

  } catch (err) {
    res.redirect("/");
  }
};


function getNextNDates(n = 7) {
  const today = new Date();
  const dates = [];

  for (let i = 0; i < n; i++) {
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + i);

    const yyyy = nextDate.getFullYear();
    const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
    const dd = String(nextDate.getDate()).padStart(2, '0');

    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}




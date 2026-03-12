const Laboratory = require('./Lab');
const Reservation = require('../reservations/Reservation');
const { getTimeSlots, renderErrorPage} = require('../util/helpers');



exports.getManageLabsPage = async (req, res) => {
  try {
    // Fetch all labs from the database
    const labs = await Laboratory.getAllLabs(req.query);
    console.log(labs);  // Log the labs data to check what you're receiving

    // Render the page with labs data
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

    console.log(selectedDate, selectedTime);
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
    console.error(err);
    res.redirect('/esfefw');
  }
};


// 1. CREATE: Create a new lab

exports.createLab = async (req, res) => {
  try {
    const { name, capacity, openTime, closeTime, image } = req.body;

    // Create the lab
    const labData = {
      name,
      capacity,
      openTime,
      closeTime,
      image: image || 'lab-default.jpg' // Use default image if not provided
    };

    const newLab = await Laboratory.createLab(labData);
    res.redirect('/labs/manage'); // Redirect to the list of labs after creating
  } catch (error) {
    console.error(error);
    res.status(500).send('Error creating lab');
  }
};


// 3. READ ONE: Get a specific lab by ID for editing
exports.getLabById = async (req, res) => {
  try {
    const { id } = req.params;
    const lab = await Laboratory.getLabById(id);
    if (!lab) {
      return res.status(404).send('Lab not found');
    }
    res.render('/labs/manage', { lab }); // Pass lab to edit form view
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching lab for editing');
  }
};

// 4. UPDATE: Update a lab's details
exports.updateLab = async (req, res) => {
  try {
    const labId = req.params.id;  // Get the lab ID from the URL
    const { name, openTime, closeTime, capacity } = req.body;  // Extract data from the form submission

    // Call the updateLab method from the model
    const updatedLab = await Laboratory.updateLab(labId, {
      name,
      openTime,
      closeTime,
      capacity
    });

    // Redirect back to the labs page with updated lab list
    res.redirect('/labs/manage');  // Adjust if needed to the correct route

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

    res.redirect('/labs/manage'); // Redirect to labs list after successful deletion
  } catch (error) {
    res.status(500).send('Error deleting lab');
  }
};

exports.getLabSeats = async (req, res) => {
  try {
    const { bookingTime, bookingDate, labName, cartSession} = req.body;
    const selectedDate = bookingDate;
    const selectedTime = bookingTime;
    const selectedLabName = labName;

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
      cartSession
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
    console.error("Error fetching lab details:", err);
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




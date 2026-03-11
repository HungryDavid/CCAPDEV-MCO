const moment = require('moment'); // npm install moment
const hbs = require('hbs');

module.exports = {
    // 1. FORMAT DATE
    formatDate: function (date, format) {
        return moment(date).format(format);
    },

    // 2. EQUALITY CHECK
    eq: function (a, b) {
        return a === b;
    },

    // 3. IS SELECTED
    isSelected: function (a, b) {
        return a === b ? 'selected' : '';
    },

    // 4. NOT EQUAL
    ne: function (a, b) {
        return a !== b;
    },

    // 5. CHECK IF RESERVED
    seatStatus: function (reservation) {
        return reservation ? 'taken' : 'available';
    },

    // 6. CHECK IF A SEAT IS SELECTED IN A RESERVATION
    isSeatSelected: function (reservationSeats, selectedTime, seatNumber) {
        if (!reservationSeats || !selectedTime) {
            return false;
        }

        const seats = reservationSeats[selectedTime];
        if (!Array.isArray(seats)) {
            return false;
        }

        const seatStr = String(seatNumber);
        return seats.some(seat => String(seat) === seatStr);
    },

    // 6. ROLE CHECK
    hasRole: function (user, requiredRole, options) {
        if (!user || !user.role) {
            return options.inverse(this);
        }
        const rolesArray = requiredRole.split(',').map(role => role.trim());
        if (rolesArray.includes(user.role)) {
            return options.fn(this);
        }
        return options.inverse(this);
    },

    // 7. DEBUGGING (Dump JSON)
    json: function (context) {
        return JSON.stringify(context, null, 2);
    },

    // 8. MATH (Add)
    add: function (value, addition) {
        return parseInt(value) + parseInt(addition);
    },

    // 9. TRUNCATE TEXT
    truncate: function (str, len) {
        if (str.length > len && str.length > 0) {
            return str.substring(0, len) + '...';
        }
        return str;
    },

    // 10. CHECK IF TECHNICIAN
    renderErrorPage: function (res, err) {
        res.render('error', {
            layout: "plain",  // Default layout
            errorNumber: err.errorNumber || 500,  // Default to 500 if errorNumber is not provided
            errorName: err.errorName || 'Internal Server Error',  // Default to 'Internal Server Error'
            errorMessage: err.errorMessage || 'An unexpected error occurred.'  // Default message
        });
    },

    // 11. NAV LINK CLASS
    navLinkClass: function (currentPath, targetPath) {
        return currentPath === targetPath
            ? 'active text-white bg-primary'
            : 'text-black';
    },

    // 12. TIME SLOTS HELPER
    getTimeSlots: function (intervalMinutes = 30, start = "19:30", end = "07:15", date = null) {
        const slots = [];

        // Force start time to always be 00:00
        const [startH, startM] = [0, 0];  // 00:00 as the start time
        const [endH, endM] = end.split(":").map(Number);

        let startTime, endTime;

        // Use provided date or default to today (in local time zone)
        const localDate = new Date().toLocaleDateString('en-CA');  // Local date in YYYY-MM-DD format
        if (date) {
            startTime = new Date(date);
            endTime = new Date(date);
        } else {
            startTime = new Date(localDate);
            endTime = new Date(localDate);
        }

        startTime.setHours(startH, startM, 0, 0); // Set start time to 00:00
        endTime.setHours(Math.min(endH, 23), Math.min(endM, 59), 0, 0); // Cap end time at 23:59

        // If the start time is after the end time, move the end time to the next day
        if (startTime > endTime) {
            endTime.setDate(endTime.getDate() + 1);
        }

        // Check if the date is today (skip past time slots if it's today)
        const now = new Date();
        const isToday = !date || date === localDate;

        let slotTime = new Date(startTime);
        while (slotTime <= endTime) {
            // If the date is today and the slotTime is in the past, skip it
            if (isToday && slotTime <= now) {
                slotTime.setMinutes(slotTime.getMinutes() + intervalMinutes);
                continue;
            }

            // Format the time and push it into the slots array
            const formatted = slotTime.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            });
            slots.push(formatted);
            slotTime.setMinutes(slotTime.getMinutes() + intervalMinutes);
        }

        return slots;
    }
};
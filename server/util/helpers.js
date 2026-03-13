const moment = require('moment'); // npm install moment
const hbs = require('hbs');

module.exports = {
    // FORMAT DATE
    formatDate: function (date, format) {
        return moment(date).format(format);
    },

    // EQUALITY CHECK
    eq: function (a, b) {
        return a === b;
    },

    // IS SELECTED
    isSelected: function (a, b) {
        return a === b ? 'selected' : '';
    },

    // NOT EQUAL
    ne: function (a, b) {
        return a !== b;
    },

    // CHECK IF RESERVED
    seatStatus: function (reservation) {
        return reservation ? 'taken' : 'available';
    },

    // ROLE CHECK
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

    // DEBUGGING (Dump JSON)
    json: function (context) {
        return JSON.stringify(context, null, 2);
    },

    // MATH (Add)
    add: function (value, addition) {
        return parseInt(value) + parseInt(addition);
    },

    // TRUNCATE TEXT
    truncate: function (str, len) {
        if (str.length > len && str.length > 0) {
            return str.substring(0, len) + '...';
        }
        return str;
    },

    // RENDER ERROR
    renderErrorPage: function (res, err) {
        res.render('error', {
            layout: "plain",  // Default layout
            errorNumber: err.errorNumber || 500,  // Default to 500 if errorNumber is not provided
            errorName: err.errorName || 'Internal Server Error',  // Default to 'Internal Server Error'
            errorMessage: err.errorMessage || 'An unexpected error occurred.'  // Default message
        });
    },

    // NAV LINK CLASS
    navLinkClass: function (currentPath, targetPath) {
        return currentPath === targetPath
            ? 'active text-white bg-primary'
            : 'text-black';
    },

    // TIME SLOTS HELPER
    getTimeSlots: function (intervalMinutes = 30, start = "19:30", end = "07:15", date = null) {
    const slots = [];

    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);

    let startTime, endTime;

    const localDate = new Date().toLocaleDateString('en-CA');

    if (date) {
        startTime = new Date(date);
        endTime = new Date(date);
    } else {
        startTime = new Date(localDate);
        endTime = new Date(localDate);
    }

    startTime.setHours(startH, startM, 0, 0);
    endTime.setHours(Math.min(endH, 23), Math.min(endM, 59), 0, 0);

    if (startTime > endTime) {
        endTime.setDate(endTime.getDate() + 1);
    }

    const now = new Date();
    const isToday = !date || date === localDate;

    let slotTime = new Date(startTime);

    while (slotTime <= endTime) {

        const slotEnd = new Date(slotTime);
        slotEnd.setMinutes(slotEnd.getMinutes() + intervalMinutes);

        // Skip only if the whole slot already finished
        if (isToday && now >= slotEnd) {
            slotTime.setMinutes(slotTime.getMinutes() + intervalMinutes);
            continue;
        }

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
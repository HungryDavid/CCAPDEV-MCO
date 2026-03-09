const moment = require('moment'); // You might need: npm install moment
const hbs = require('hbs');

module.exports = {
    // 1. FORMAT DATE
    // Usage: {{formatDate date "MMMM Do YYYY, h:mm:ss a"}}
    formatDate: function (date, format) {
        return moment(date).format(format);
    },

    // 2. EQUALITY CHECK
    // Usage: {{#if (eq user.role "technician")}} ... {{/if}}
    eq: function (a, b) {
       // console.log( a === b);
        return a === b;
        
    },

    // 3. NOT EQUAL
    // Usage: {{#if (ne user.role "student")}} ... {{/if}}
    ne: function (a, b) {
        return a !== b;
    },

    // 4. CHECK IF RESERVED
    // Logic: If a reservation object exists, return 'taken', else 'available'
    // Usage: <div class="seat {{seatStatus this.reservation}}">
    seatStatus: function (reservation) {
        return reservation ? 'taken' : 'available';
    },

    hasRole: function (user, requiredRole, options) {
        // 1. Safety check: If no user or no role, don't show anything
        if (!user || !user.role) {
            return options.inverse(this);
        }

        console.log("Checking navbar roles...");
        // 2. Allow for multiple roles (comma separated)
        // Example: {{#hasRole user "admin,technician"}}
        const rolesArray = requiredRole.split(',').map(role => role.trim());

        if (rolesArray.includes(user.role)) {
            return options.fn(this); // Show the content inside the block
        }

        return options.inverse(this); // Show the {{else}} block if it exists
    },

    // 5. DEBUGGING (Dump JSON)
    // Usage: {{{json this}}} - prints raw data to screen to check what you are getting
    json: function (context) {
        return JSON.stringify(context, null, 2);
    },

    // 6. MATH (Add)
    // Usage: {{add index 1}} (Useful for lists starting at 1 instead of 0)
    add: function (value, addition) {
        return parseInt(value) + parseInt(addition);
    },


    // 8. TRUNCATE TEXT
    // Usage: {{truncate description 50}}
    truncate: function (str, len) {
        if (str.length > len && str.length > 0) {
            return str.substring(0, len) + '...';
        }
        return str;
    },

    // 9. CHECK IF TECHNICIAN (Shorthand)
    // Usage: {{#if (isTech role)}}
    isTech: function (role) {
        return role === 'technician';
    },

    navLinkClass: function (currentPath, targetPath) {
        return currentPath === targetPath
            ? 'active text-white bg-primary'
            : 'text-black';
    }
};

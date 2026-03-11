
// 1. Protect routes that require the user to be logged in
exports.ensureAuthenticated = async (req, res, next) => {
    // 1. Check if the session exists and has a userId
    if (!req.session || !req.session.userId) {
        return res.redirect('/auth/login');
    }; 
    next(); 
}

// 4. If not logged in (or user not found in DB), redirect
// Optional: req.session.redirectTo = req.originalUrl;


// 2. Protect routes that are only for visitors (Login, Register)
// Prevents logged-in users from accessing the login page
exports.ensureGuest = (req, res, next) => {
    if (!req.session.userId) {
        return next();
    }
    return res.redirect("/auth/login");
//    return res.redirect('/slots-availability'); // or dashboard
};

// 3. Role-Based Authorization: Lab Technician Only
exports.ensureLabTech = (req, res, next) => {
    // Check if logged in AND role is correct
    if (req.session.userId && req.session.role === 'Lab Technician') {
        return next();
    }
    // If they are logged in but not a tech, send 403 (Forbidden) or redirect
    if (req.session.userId) {
        return res.status(403).render('error', { message: 'Access Denied: Lab Technicians Only' });
    }
    res.redirect('/auth/login');
};

// 4. Role-Based Authorization: Student Only
exports.ensureStudent = (req, res, next) => {
    if (req.session.userId && req.session.role === 'Student') {
        return next();
    }
    if (req.session.userId) {
        return res.status(403).render('error', { message: 'Access Denied: Students Only' });
    }
    res.redirect('/auth/login');
};

exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // 1. Check if user is logged in
    if (!req.session || !req.session.userId) {
        alert("false");
      return res.status(401).redirect('/auth/login'); 
    }

    // Use res.locals.user (set in your app.js middleware)
    const user = res.locals.user;

    // 2. Check if the user exists and their role is allowed
    if (user && allowedRoles.includes(user.role)) {
      return next(); 
    }

    // 3. User is logged in but doesn't have the right role
    return res.status(403).render('error', { 
      message: "Forbidden: You don't have permission to access this." 
    });
  };
};
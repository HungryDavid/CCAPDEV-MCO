
exports.ensureAuthenticated = async (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/auth/login');
    }
    next(); 
}

exports.ensureGuest = (req, res, next) => {
    if (!req.session.userId) {
        return next();
    }
    return res.redirect("/auth/login");
};

exports.ensureLabTech = (req, res, next) => {
    if (req.session.userId && req.session.role === 'Lab Technician') {
        return next();
    }
    if (req.session.userId) {
        return res.status(403).render('error', { message: 'Access Denied: Lab Technicians Only' });
    }
    res.redirect('/auth/login');
};

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
    if (!req.session || !req.session.userId) {
        alert("false");
      return res.status(401).redirect('/auth/login'); 
    }
    const user = res.locals.user;
    if (user && allowedRoles.includes(user.role)) {
      return next(); 
    }
    return res.status(403).render('error', { 
      message: "Forbidden: You don't have permission to access this." 
    });
  };
};
const User = require('./User');
const Reservation = require('../reservations/Reservation');


exports.getCurrentUser = async (req, res) => {
    try {
        const sessionUser = await User.readUserByIdSafe(req.session.userId).lean();
        const reservations = await Reservation.getUpcomingReservationsByUser(req.session.userId);

        res.render('partials/profile-card', {
            user: sessionUser,
            account: sessionUser,
            title: 'My Profile',
            headerTitle: 'My Profile',
            layout: 'dashboard',
            activePage: 'my-profile',
            isOwner: true,
            reservations
        });

    } catch (error) {
        console.error(error);
        res.redirect('/');
    }
};


exports.updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const filePath = req.file ? `/uploads/${req.file.filename}` : null;
        await user.updateUser(req.body, filePath);
        res.redirect('/user/me');
    } catch (error) {
        console.log(error);
        res.status(500).send("Error updating profile");
    }
}

exports.deleteProfile = async (req, res) => {
    try {
        await User.deleteUser(req.session.userId);
        req.session.destroy();
        res.redirect('/');
    } catch (err) {
        res.status(400).send(err.message);
    }
};

exports.searchUser = async (req, res) => {
  try {
    const sessionUserDoc = await User.readUserByIdSafe(req.session.userId);
    const sessionUser = sessionUserDoc ? sessionUserDoc.toObject() : null;
    const query = req.query.q?.trim() || '';
    let searchedUser = null;
    let searchedUserReservation = null
    if (query) {
      try {
        const searchedUserDoc = await User.readUserSafeAndPublic(query);
        searchedUser = searchedUserDoc?.toObject() || null;
        searchedUserReservation = await Reservation.getUpcomingReservationsByUser(searchedUser._id);
      } catch (err) {
        if (err.message !== 'User not found.') {
          console.error('Error fetching user:', err);
        }
        searchedUser = null; 
      }
    }
      
      res.render('search-profile', {
      title: 'Search Users',
      headerTitle: 'Search User',
      layout: 'dashboard',
      activePage: 'search-user',
      user: sessionUser,
      account: searchedUser,
      searchQuery: query,
      reservations: searchedUserReservation
    });

  } catch (error) {
    res.redirect('/');
  }
};

const User = require('../users/User');

//GET LOGIN
const getLoginPage = (req, res) => {
    const message = req.flash('error');
    console.log("getLoginPage");
    res.render('login', {
        title: 'Login',
        layout: 'auth',
        errorMessage: message.length > 0 ? message[0] : null
    });
};

//GET REGISTER
const getRegisterPage = (req, res) => {
    const message = req.flash('error');
    return res.render('register', {  //render body
        title: 'Register',
        layout: 'auth',
        errorMessage: message.length > 0 ? message[0] : null
    });
};

//LOGINS USER
const loginUser = async (req, res) => {
    try {
        const { identifier, password, rememberMe } = req.body;
        const user = await User.loginUser(identifier, password);

        req.session.userId = user._id;
        req.session.role = user.role;

        if (rememberMe) {
            req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 21; // 21 Days
        } else {
            req.session.cookie.expires = false; // Session cookie (clears on browser close)
        }
        res.redirect('/slots-availability');
    } catch (error) {
        req.flash('error', error.message);
        return res.redirect('/login');
    }
};

//LOGOUTS USER
const logoutUser = (req, res) => {

    if (!req.session) {
        return res.redirect("/login");
    }

    // 1. Clear server-side session
    req.session.destroy((err) => {
        // 2. Clear the persistent "remember" cookie
        // You MUST use the same options (path, domain) used when creating it
        res.clearCookie('server.sid', {
            path: '/',
            httpOnly: true,
            // Match the 'secure' setting from your app.use(session)
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });


        // 2. Prevent Back-Button "Cache" access
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        return res.redirect("/login");
    });
};

//REGISTERS USER
const registerUser = async (req, res, next) => {
    try {
        const { email, idNumber, password, rememberMe } = req.body;
        await User.createUser({ email, idNumber, password, rememberMe });
        res.redirect('/login');
    } catch (error) {
        console.log(error);
        req.flash('error', error.message);
        return res.redirect('/register');
    }
};


module.exports = {
    getLoginPage,
    getRegisterPage,
    loginUser,
    logoutUser,
    registerUser
};

const User = require('./User');


const getAboutUsPage = (req, res) => {
    res.render('about', {
        layout: 'plain',
    });
};

//GET LOGIN
const getLoginPage = (req, res) => {
    const message = req.flash('error');
    res.render('login', {
        title: 'Login',
        layout: 'auth',
        errorMessage: message.length > 0 ? message[0] : null
    });
};

//GET REGISTER
const getRegisterPage = (req, res) => {
    const message = req.flash('error');
    return res.render('register', {  
        title: 'Register',
        layout: 'auth',
        errorMessage: message.length > 0 ? message[0] : null
    });
};

//logins a user by checking if the provided email/ID and password match a record in the database
const loginUser = async (req, res) => {
    try {
        const { identifier, password, rememberMe } = req.body;
        const user = await User.loginUser(identifier, password);

        req.session.userId = user._id;
        req.session.role = user.role;

        if (rememberMe) {
            req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 21; // 21 Days
            req.session.touch();
        } 
        
        res.redirect('/labs/slots-availability');
    } catch (error) {
        req.flash('error', error.message);
        return res.redirect('/auth/login');
    }
};

//logs out a user by destroying their session and clearing the cookie
const logoutUser = (req, res) => {

    if (!req.session) {
        return res.redirect("/auth/login");
    }

    req.session.destroy((err) => {
        res.clearCookie('server.sid', {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });

        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        return res.redirect("/auth/login");
    });
};

//registers user
const registerUser = async (req, res) => {
    try {
        const { email, idNumber, password} = req.body;
        await User.createUser(email, idNumber, password );
        res.redirect('/auth/login');
    } catch (error) {
        req.flash('error', error.message);
        return res.redirect('/auth/register');
    }
};


module.exports = {
    getAboutUsPage,
    getLoginPage,
    getRegisterPage,
    loginUser,
    logoutUser,
    registerUser
};
// Import required modules
const express = require('express');
const exphbs = require('express-handlebars');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const path = require('path');
const dotenv = require('dotenv');
const flash = require('connect-flash');
const { connectDB } = require('./config/db');
const User = require('./users/User');
const helmet = require('helmet');
const {
  ensureAuthenticated,
  ensureGuest,
  ensureStudent,
  ensureLabTech
} = require('./middleware/auth-middleware');

// Load environment variables from .env file
dotenv.config({
  path: path.resolve(__dirname, '../.env')
});

// Connect to MongoDB database
connectDB();

// Initialize Express app
const app = express();

// Set views path for handlebars templates
const viewsPath = path.join(__dirname, '../views');
app.set('views', viewsPath);

// Serve static files (CSS, JS, Images)
app.use(helmet()); // Helmet for security
app.use(express.static(path.join(__dirname, '../client')));

// Middleware for parsing incoming request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies (from forms)
app.use(express.json()); // Parse JSON bodies (from API requests)

// Set up Handlebars template engine
app.engine('.hbs', exphbs.engine({
  extname: '.hbs',
  defaultLayout: 'dashboard', // Default layout for views
  helpers: require('./util/helpers'), // Custom Handlebars helpers
  layoutsDir: path.join(viewsPath, '../views/layouts'), // Directory for layouts
  partialsDir: path.join(viewsPath, '../views/partials') // Directory for partial views
}));
app.set('view engine', '.hbs'); // Set the view engine to .hbs (Handlebars)

// Set up session management using MongoDB store
app.use(session({
  name: 'server.sid', // Custom session cookie name
  secret: process.env.SESSION_SECRET, // Secret for encrypting session data
  resave: false, // Don't save session if not modified
  saveUninitialized: false, // Don't create session until something is stored
  rolling: true, // Reset session expiration on each request
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI, // MongoDB URI for session storage
    ttl: 60 * 1, // Session expiry time (1 minute for example)
    autoRemove: 'native' // Remove expired sessions automatically
  }),
  cookie: {
    httpOnly: true, // Ensure the cookie is accessible only via HTTP (prevents XSS)
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
    maxAge: 60000 // Cookie expiration time (1 minute by default)
  }
}));

// Use flash messages for storing temporary messages (like success or error)
app.use(flash());

// Middleware for extending session duration if 'Remember Me' is selected
app.use((req, res, next) => {
  if (req.session.userId && req.session.rememberMe) {
    req.session.cookie.maxAge = 21 * 24 * 60 * 60 * 1000; // Extend session for 21 days
  }
  next();
});

// Middleware for loading user info into the response locals for easy access in views
app.use(async (req, res, next) => {
  if (req.session.userId) {
    const user = await User.findById(req.session.userId).lean();
    res.locals.user = {
      userId: user._id,
      email: user.email,
      role: user.role
    };
  }
  next();
});

// Route definitions (Protected routes use authentication middleware)

app.use('/reservation', ensureAuthenticated, require('./reservations/reservation-routes'));
app.use('/user', ensureAuthenticated, require('./users/user-routes'));
app.use('/labs', ensureAuthenticated, require('./labs/labs-routes'));
app.use('/auth', require('./users/auth-routes')); // Public routes (authentication-related)
app.use('/', require('./users/auth-routes')); 

// Define server port
const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../users/User");
const Laboratory = require("../labs/Lab");
const Reservation = require("../reservations/Reservation");

const users = [
    {
        name: "John Doe",
        email: "john_doe@dlsu.edu.ph",
        idNumber: "12345611",
        role: "student",
        password: "password123"
    },
    {
        name: "Jane Smith",
        email: "jane_smith@dlsu.edu.ph",
        idNumber: "12345672",
        role: "student",
        password: "password123"
    },
    {
        name: "Lab Technician",
        email: "tech_admin@dlsu.edu.ph",
        idNumber: "12345673",
        role: "technician",
        password: "password123"
    },
    {
        name: "Carl Johnson",
        email: "carl_johnson@dlsu.edu.ph",
        idNumber: "12345674",
        role: "student",
        password: "password123"
    },
    {
        name: "Juan Dela Cruz",
        email: "juan_dela_cruz@dlsu.edu.ph",
        idNumber: "12345678",
        role: "student",
        password: "password123"
    }
];

const labs = [
    { name: "GK301", capacity: 25, openTime: 0, closeTime: 1439, image: "/imgs/gk-building.webp" },
    { name: "GK302", capacity: 25, openTime: 0, closeTime: 1439, image: "/imgs/gk-building.webp" },
    { name: "GK303", capacity: 25, openTime: 0, closeTime: 1439, image: "/imgs/gk-building.webp" },
    { name: "VL205", capacity: 30, openTime: 0, closeTime: 1439, image: "/imgs/vl-building.webp" },
    { name: "VL206", capacity: 30, openTime: 0, closeTime: 1439, image: "/imgs/vl-building.webp" },
    { name: "AG1901", capacity: 40, openTime: 0, closeTime: 1439, image: "/imgs/ag-building.webp" },
    { name: "SJ212", capacity: 40, openTime: 0, closeTime: 1439, image: "/imgs/sj-building.webp" }
];

const seedDatabase = async () => {

    const existingUsers = await User.countDocuments();

    // Prevent reseeding every restart
    if (existingUsers > 0) {
        console.log("Database already seeded");
        return;
    }

    console.log("Seeding database...");

    // Hash passwords
    const hashedUsers = [];
    for (let user of users) {
        const hashedPassword = await bcrypt.hash(user.password, 12);
        hashedUsers.push({ ...user, password: hashedPassword });
    }

    const createdUsers = await User.insertMany(hashedUsers);
    const createdLabs = await Laboratory.insertMany(labs);

    const john = createdUsers.find(u => u.name === "John Doe");
    const carl = createdUsers.find(u => u.name === "Carl Johnson");
    const jane = createdUsers.find(u => u.name === "Jane Smith");
    const juan = createdUsers.find(u => u.name === "Juan Dela Cruz");
    const tech = createdUsers.find(u => u.role === "technician");

    const gk301 = createdLabs.find(l => l.name === "GK301");
    const gk302 = createdLabs.find(l => l.name === "GK302");
    const gk303 = createdLabs.find(l => l.name === "GK303");
    const vl205 = createdLabs.find(l => l.name === "VL205");

    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISODate = new Date(now - offset).toISOString().split('T')[0];
    const totalMinutes = (now.getHours() * 60) + now.getMinutes();
    const roundedMinutes = Math.floor(totalMinutes / 30) * 30;

    const startMinutesMinus30 = (roundedMinutes - 30) % 1440;
    const startMinutesNow = roundedMinutes% 1440;
    const startMinutesPlus30 = (roundedMinutes + 30) % 1440;
    const startMinutesPlus60 = (roundedMinutes + 60) % 1440;
    const startMinutesPlus90 = (roundedMinutes + 90) % 1440;


    const endRoundedMinutes0 = (roundedMinutes) % 1440;
    const endRoundedMinutes30 = (roundedMinutes + 30) % 1440;
    const endRoundedMinutes60 = (roundedMinutes + 60) % 1440;
    const endRoundedMinutes90 = (roundedMinutes + 90) % 1440;
    
    const reservations = [
        {
            studentId: jane._id,
            laboratory: gk301._id,
            date: localISODate,
            anonymous: false,
            slots: [{ seatNumber: 2, startTime: startMinutesNow, endTime: endRoundedMinutes30 }]
        },
        {
            studentId: john._id,
            laboratory: gk301._id,
            date: localISODate,
            anonymous: false,
            slots: [{ seatNumber: 3, startTime: startMinutesPlus30, endTime: endRoundedMinutes60 }]
        },
        {
            studentId: john._id,
            laboratory: gk301._id,
            date: localISODate,
            anonymous: false,
            slots: [{ seatNumber: 4, startTime: startMinutesPlus60, endTime: endRoundedMinutes90}]
        }
        ,
        {
            studentId: john._id,
            laboratory: vl205._id,
            date: localISODate,
            anonymous: false,
            slots: [{ seatNumber: 5, startTime: startMinutesNow, endTime: endRoundedMinutes30 }]
        },
        {
            studentId: carl._id,
            laboratory: gk302._id,
            date: localISODate,
            anonymous: false,
            slots: [{ seatNumber: 6, startTime: startMinutesNow, endTime: endRoundedMinutes30 }]
        },
        {
            studentId: juan._id,
            laboratory: gk303._id,
            date: localISODate,
            anonymous: false,
            slots: [{ seatNumber: 6, startTime: startMinutesNow, endTime: endRoundedMinutes30 }]
        },
        {
            studentId: john._id,
            laboratory: gk301._id,
            date: localISODate,
            anonymous: false,
            slots: [{ seatNumber: 1, startTime: startMinutesMinus30, endTime: endRoundedMinutes0}]
        }
    ];

    await Reservation.insertMany(reservations);

    console.log("Database seeded successfully");

};

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);

        console.log(`MongoDB Connected: ${conn.connection.host}`);

        await seedDatabase(); // seed after connection

        console.log("Available Accounts:");
        console.log("- john_doe@dlsu.edu.ph");
        console.log("- jane_smith@dlsu.edu.ph");
        console.log("- tech_admin@dlsu.edu.ph");
        console.log("- carl_johnson@dlsu.edu.ph");
        console.log("- juan_dela_cruz@dlsu.edu.ph");
        console.log("Default Password: password123");
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

module.exports = { connectDB };
// Import required modules
const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const { check, validationResult } = require("express-validator");

// Initialize the app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded data

// Set up MySQL database connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "signup"
});

// Test the database connection
db.connect((err) => {
    if (err) {
        console.error("Database connection failed:", err);
    } else {
        console.log("Database connected successfully.");
    }
});

// Signup route
app.post("/signup", (req, res) => {
    console.log("Received data:", req.body); // Log the request body for debugging

    const q = "INSERT INTO login (`name`, `email`, `password`) VALUES (?, ?, ?)";
    const values = [
        req.body.values.name,
        req.body.values.email,
        req.body.values.password
    ];

    db.query(q, values, (err, data) => {
        if (err) {
            console.error("Database insertion error:", err); // Log detailed error for debugging
            return res.status(500).json({ error: "Database insertion error" });
        }
        return res.json("User created successfully.");
    });
});


// Login route with validation
app.post("/login", [
    check("email", "Email length error").isEmail().isLength({ min: 10, max: 30 }),
    check("password", "Password length 8-10").isLength({ min: 8, max: 10 })
], (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.json(errors); // Return validation errors if present
    } 

    const sql = "SELECT * FROM login WHERE email = ? AND password = ?";
    db.query(sql, [req.body.email, req.body.password], (err, data) => {
        if (err) {
            console.error("Database query error:", err); // Log detailed error for debugging
            return res.json("Error");
        }
        if (data.length > 0) {
            return res.json("Success");
        } else {
            return res.json("Failed");
        }
    });
});

// Start the server
app.listen(8081, () => {
    console.log("Server is listening on port 8081");
});



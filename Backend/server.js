// server.js
const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { check, validationResult } = require("express-validator");
require('dotenv').config();  

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const apiKey = process.env.GEMINI_API_KEY || "AIzaSyASBWrK53bGRmSkqS7CkGztYT-Shfgc0Cw";
const genAI = new GoogleGenerativeAI(apiKey);
const generationConfig = { temperature: 0.4, topP: 1, topK: 32, maxOutputTokens: 4096 };

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "my_database"
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
  } else {
    console.log("Database connected successfully.");
  }
});

// Set up file storage for media uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage: storage });

// Maintenance Request Route
app.post("/maintenance-request", upload.array("media", 10), async (req, res) => {
  try {
    console.log("Received maintenance request:", req.body);
    console.log("Uploaded files:", req.files);

    let { description, tenantId } = req.body;

    if (!description || !tenantId) {
      console.error("Missing description or tenantId.");
      return res.status(400).json({ error: "Missing required fields: description or tenantId" });
    }

    const parsedTenantId = parseInt(tenantId);
    if (isNaN(parsedTenantId)) {
      console.error("Invalid tenantId format:", tenantId);
      return res.status(400).json({ error: "Invalid tenantId format. It should be a number." });
    }

    const checkUserQuery = "SELECT * FROM users WHERE user_id = ?";
    db.query(checkUserQuery, [parsedTenantId], async (err, userResult) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({ error: "Database query error" });
      }
      if (userResult.length === 0) {
        console.error("User does not exist for tenantId:", parsedTenantId);
        return res.status(400).json({ error: "Invalid tenant ID. User does not exist." });
      }

      const media = req.files;
      const media_link = media && media.length > 0 ? JSON.stringify(media.map(file => file.path)) : null;

      const q = "INSERT INTO maintenancerequests (user_id, description, status, priority, media_link, date_submitted, date_resolved, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
      const values = [
        parsedTenantId,
        description,
        req.body.status || "Pending",
        req.body.priority || "Normal",
        media_link,
        new Date(),
        null,
        req.body.assigned_to || null
      ];

      db.query(q, values, async (err, data) => {
        if (err) {
          console.error("Database insertion error:", err);
          return res.status(500).json({ error: "Database insertion error" });
        }

        // Chatbot Route
        app.post("/chatbot", async (req, res) => {
          try {
            const userMessage = req.body.message;

            if (!userMessage) {
              return res.status(400).json({ error: "Message is required." });
            }

            try {
              const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig });
              const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: userMessage }] }]
              });
              const aiResponse = await result.response;
              console.log("AI Reply:", aiResponse.text());
              return res.json({ reply: aiResponse.text() });
            } catch (aiError) {
              console.error("Error generating AI response:", aiError);
              return res.status(500).json({ error: "Failed to generate AI response." });
            }
          } catch (error) {
            console.error("Error processing chatbot message:", error);
            return res.status(500).json({ error: "Error processing chatbot message." });
          }
        });


        try {
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig });
          const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: description }] }]
          });
          const aiResponse = await result.response;
          console.log("AI Predicted Issue:", aiResponse.text());
          return res.json({ message: "Maintenance request submitted successfully.", aiPrediction: aiResponse.text() });
        } catch (aiError) {
          console.error("Error generating AI response:", aiError);
          return res.json({ message: "Maintenance request submitted successfully, but AI analysis failed." });
        }
      });
    });
  } catch (err) {
    console.error("Error processing maintenance request:", err);
    return res.status(500).json({ error: "Error processing maintenance request" });
  }
});

// Signup route
app.post("/signup", (req, res) => {
  console.log("Received data:", req.body);

  const q = "INSERT INTO users (`name`, `email`, `phone`, `password_hash`, role) VALUES (?, ?, ?, ?, ?)";
  const values = [
    req.body.values.name,
    req.body.values.email,
    req.body.values.phone,
    req.body.values.password, 
    req.body.values.role,
  ];

  db.query(q, values, (err, data) => {
    if (err) {
      console.error("Database insertion error:", err);
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
    return res.json(errors); 
  }

  const sql = "SELECT * FROM users WHERE email = ? AND password_hash = ?";
  db.query(sql, [req.body.email, req.body.password], (err, data) => {
    if (err) {
      console.error("Database query error:", err); 
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

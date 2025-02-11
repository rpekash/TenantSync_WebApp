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

const apiKey = process.env.GEMINI_API_KEY || "AAIzaSyAiuTeUXIUxfSfTvJRN8X4Q27rzXfvizd4";
const genAI = new GoogleGenerativeAI(apiKey);
const generationConfig = { temperature: 0.4, topP: 1, topK: 32, maxOutputTokens: 4096 };

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "tenantsyncdata"
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


app.post("/signup", (req, res) => {
  console.log("Received data:", req.body);

  const insertUserQuery = "INSERT INTO users (`name`, `email`, `phone`, `password_hash`, `role`) VALUES (?, ?, ?, ?, ?)";
  const userValues = [
    req.body.values.name,
    req.body.values.email,
    req.body.values.phone,
    req.body.values.password,
    req.body.values.role,
  ];

  db.query(insertUserQuery, userValues, (err, result) => {
    if (err) {
      console.error("Database insertion error:", err);
      return res.status(500).json({ error: "Database insertion error" });
    }

    const userId = result.insertId; 
    console.log("User created successfully with ID:", userId);

    if (req.body.values.role === "maintenance") {
      const insertMaintenanceQuery = "INSERT INTO maintenanceteam (`team_id`, `name`, `contact_info`, `availability`, `type_of_maintenance`) VALUES (?, ?, ?, ?, ?)";
      const maintenanceValues = [
        userId,
        req.body.values.name,
        req.body.values.email,
        null, 
        "General", 
      ];

      db.query(insertMaintenanceQuery, maintenanceValues, (maintenanceErr) => {
        if (maintenanceErr) {
          console.error("Error inserting into maintenanceteam:", maintenanceErr);
          return res.status(500).json({ error: "Error inserting into maintenanceteam" });
        }
        console.log("Maintenance worker added to team successfully.");
      });
    }

    return res.json({ message: "User created successfully." });
  });
});

app.post("/login", (req, res) => {
  const sql = "SELECT * FROM users WHERE email = ? AND password_hash = ?";
  
  db.query(sql, [req.body.email, req.body.password], (err, userData) => {
    if (err) {
      console.error("Database query error:", err);
      return res.status(500).json({ error: "Database query error" });
    }

    if (userData.length > 0) {
      const user = userData[0];

      const checkMaintenanceQuery = "SELECT * FROM maintenanceteam WHERE team_id = ?";
      
      db.query(checkMaintenanceQuery, [user.user_id], (maintenanceErr, maintenanceData) => {
        if (maintenanceErr) {
          console.error("Error checking maintenance team:", maintenanceErr);
          return res.status(500).json({ error: "Error checking maintenance team" });
        }

        if (maintenanceData.length > 0) {
          const maintenanceWorker = maintenanceData[0];

          return res.json({
            message: "Success",
            userId: user.user_id,
            role: user.role,
            isMaintenance: true,
            teamId: maintenanceWorker.team_id,
            availability: maintenanceWorker.availability,
            typeOfMaintenance: maintenanceWorker.type_of_maintenance
          });
        } else {
          return res.json({
            message: "Success",
            userId: user.user_id,
            role: user.role,
            isMaintenance: false
          });
        }
      });
    } else {
      return res.json({ message: "Failed" });
    }
  });
});

const aiRequestData = {};

app.post("/chatbot", async (req, res) => {
  const tenantId = req.body.tenantId;
  const userMessage = req.body.message;
  const media = req.body.media || [];

  if (!tenantId || !userMessage) {
    return res.status(400).json({ error: "Missing tenantId or message." });
  }

  if (!aiRequestData[tenantId]) {
    aiRequestData[tenantId] = {
      description: "",
      media: [],
      followUps: 0,
      maxFollowUps: 3,
    };
  }

  const requestData = aiRequestData[tenantId];

 
  if (media.length > 0) {
    requestData.media = [...requestData.media, ...media];
  }

  
  requestData.description += " " + ` ${userMessage}`.trim();

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig });

    const evaluationPrompt = `
      Here is the maintenance issue description:
      "${requestData.description}"

      Based on the description provided, evaluate if there is enough information to create a maintenance request.
      If the description is complete, respond with "complete". 
      Otherwise, suggest a single follow-up question to clarify the most critical missing information.
    `;

    const evaluationResult = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: evaluationPrompt }] }],
    });
    const aiResponse = evaluationResult.response.text().trim();

    console.log(`AI Evaluation for Tenant ${tenantId}:`, aiResponse);

    if (aiResponse.toLowerCase() === "complete" || requestData.followUps >= requestData.maxFollowUps) {
      //AI Predicts the Type of Maintenance
      const typePrompt = `
        Here is the maintenance issue description:
        "${requestData.description}"

        Predict the type of maintenance required for this issue. Respond with one of the following types: 
        "Plumber", "Electrician".
      `;

      const typeResult = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: typePrompt }] }],
      });
      const maintenanceType = typeResult.response.text().trim();

      console.log(`Predicted Maintenance Type: ${maintenanceType}`);

      //Fetch Available Worker
      const fetchWorkerQuery = `
        SELECT team_id, name, availability, type_of_maintenance 
        FROM maintenanceteam 
        WHERE type_of_maintenance = ? 
        ORDER BY availability ASC 
        LIMIT 1
      `;

      db.query(fetchWorkerQuery, [maintenanceType], (workerErr, workerResults) => {
        if (workerErr || workerResults.length === 0) {
          console.error("No workers available:", workerErr || "No results found.");
          return res.status(400).json({ error: "No workers available for this type of maintenance." });
        }

        const assignedWorker = workerResults[0];
        const [startTime, endTime] = assignedWorker.availability.split("-");

        // Calculate Schedule and Availability
        const scheduledStartTime = new Date(`2024-12-10T${startTime}:00`);
        const scheduledEndTime = new Date(scheduledStartTime.getTime() + 60 * 60 * 1000); // 1 hour
        const breakEndTime = new Date(scheduledEndTime.getTime() + 30 * 60 * 1000); // Add 30-minute break

        if (breakEndTime > new Date(`2024-12-10T${endTime}:00`)) {
          console.error("Worker is unavailable for the requested time.");
          return res.status(400).json({ error: "Worker is unavailable for the requested time." });
        }

        const timeScheduled = `${scheduledStartTime.toTimeString().slice(0, 5)}-${scheduledEndTime.toTimeString().slice(0, 5)}`;

        //Insert Maintenance Request
        const mediaLink = requestData.media.length > 0 ? JSON.stringify(requestData.media) : null;
        const insertRequestQuery = `
          INSERT INTO maintenancerequests 
          (user_id, description, status, priority, media_link, date_submitted, date_resolved, assigned_to, type_of_maintenance, time_scheduled) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const requestValues = [
          tenantId,
          requestData.description.trim(),
          "Pending", // Status remains pending
          "Normal", // Default priority
          mediaLink,
          new Date(),
          null,
          assignedWorker.team_id,
          maintenanceType,
          timeScheduled,
        ];

        db.query(insertRequestQuery, requestValues, (insertErr, result) => {
          if (insertErr) {
            console.error("Error inserting maintenance request:", insertErr);
            return res.status(500).json({ error: "Failed to submit maintenance request." });
          }

          console.log("Maintenance request submitted successfully:", result.insertId);

          //Update Worker Availability
          const newStartTime = breakEndTime.toTimeString().slice(0, 5);
          const newAvailability = `${newStartTime}-${endTime}`;

          const updateWorkerQuery = `
            UPDATE maintenanceteam 
            SET availability = ? 
            WHERE team_id = ?
          `;
          db.query(updateWorkerQuery, [newAvailability, assignedWorker.team_id], (updateErr) => {
            if (updateErr) {
              console.error("Error updating worker availability:", updateErr);
              return res.status(500).json({ error: "Failed to update worker availability." });
            }

            delete aiRequestData[tenantId];
            return res.json({
              reply: `Your maintenance request has been submitted successfully, scheduled with ${assignedWorker.name} (${timeScheduled}).`,
            });
          });
        });
      });
    } else {
      // Increment follow-up counter and send AI's follow-up question
      requestData.followUps += 1;
      return res.json({
        reply: aiResponse,
      });
    }
  } catch (error) {
    console.error("Error in AI chatbot:", error);
    return res.status(500).json({ error: "Failed to process chatbot message." });
  }
});


//----------------------------

// Endpoint to fetch today's bookings for a worker (excluding completed requests)
app.get("/bookings/:workerId/:date", (req, res) => {
  const { workerId, date } = req.params;

  const query = `
    SELECT * FROM maintenancerequests
    WHERE assigned_to = ? 
    AND DATE(date_submitted) = ? 
    AND status != 'Closed'  -- Exclude completed requests
  `;

  db.query(query, [workerId, date], (err, results) => {
    if (err) {
      console.error("Error fetching bookings:", err);
      return res.status(500).json({ error: "Error fetching bookings" });
    }
    res.json(results);
  });
});


app.post("/complete-request", (req, res) => {
  const { id, timeTaken } = req.body;

  console.log(`Completing maintenance request: ID=${id}, timeTaken=${timeTaken}`);

  const updateQuery = `
    UPDATE maintenancerequests
    SET status = 'Closed', date_resolved = NOW(), time_taken = ?
    WHERE request_id = ?
  `;

  db.query(updateQuery, [timeTaken, id], (updateErr, results) => {
    if (updateErr) {
      console.error("Error updating request:", updateErr);
      return res.status(500).json({ error: "Error updating request" });
    }

    console.log(`Updated Request ID ${id}:`, results);

    // Fetch updated data to confirm changes
    db.query("SELECT time_scheduled, time_taken, date_resolved FROM maintenancerequests WHERE request_id = ?", [id], (err, updatedRows) => {
      if (err) {
        console.error("Error fetching updated request data:", err);
        return res.status(500).json({ error: "Error fetching updated request data" });
      }

      console.log(`After Update - Request ID ${id}:`, updatedRows[0]);
      res.json({ message: "Request marked as completed successfully.", updatedData: updatedRows[0] });
    });
  });
});

// TIMER
app.post("/update-timer", (req, res) => {
  const { requestId, timeTaken } = req.body;

  console.log(`Received timer update: ID=${requestId}, timeTaken=${timeTaken}`);

  const query = `
    UPDATE maintenancerequests
    SET time_taken = ?
    WHERE request_id = ?
  `;

  db.query(query, [timeTaken, requestId], (err, results) => {
    if (err) {
      console.error("Error updating timer:", err);
      return res.status(500).json({ error: "Error updating timer" });
    }
    console.log(`Timer updated successfully for Request ID ${requestId}:`, results);
    res.json({ message: "Timer updated successfully." });
  });
});

// Worker Availability Update
app.post("/update-availability", (req, res) => {
  const { workerId, availability } = req.body;

  console.log(`Updating availability for Worker ID=${workerId}, New Availability=${availability}`);

  const query = "UPDATE maintenanceteam SET availability = ? WHERE team_id = ?";
  db.query(query, [availability, workerId], (err, result) => {
    if (err) {
      console.error("Error updating availability:", err);
      return res.status(500).json({ error: "Error updating availability" });
    }
    
    console.log(`Worker ID ${workerId} availability updated to ${availability}`);
    res.json({ message: "Availability updated successfully." });
  });
});


app.post("/update-maintenance-type", (req, res) => {
  const { workerId, typeOfMaintenance } = req.body;

  if (!workerId || !typeOfMaintenance) {
    return res.status(400).json({ error: "Missing workerId or typeOfMaintenance" });
  }

  const query = "UPDATE maintenanceteam SET type_of_maintenance = ? WHERE team_id = ?";
  db.query(query, [typeOfMaintenance, workerId], (err, result) => {
    if (err) {
      console.error("Error updating maintenance type:", err);
      return res.status(500).json({ error: "Failed to update maintenance type." });
    }
    
    console.log(`Worker ID ${workerId} type updated to ${typeOfMaintenance}`);
    res.json({ message: "Maintenance type updated successfully." });
  });
});


//-------------------------


// Create a New Bulletin Post
app.post("/create-post", (req, res) => {
  const { user_id, user_role, title, content, category } = req.body;
  if (!user_id || !user_role || !title || !content || !category) {
    return res.status(400).json({ error: "All fields are required." });
  }

  const query = `INSERT INTO bulletin_posts (user_id, user_role, title, content, category, moderated) VALUES (?, ?, ?, ?, ?, FALSE)`;
  db.query(query, [user_id, user_role, title, content, category], (err, result) => {
    if (err) {
      console.error("Error creating post:", err);
      return res.status(500).json({ error: "Failed to create post." });
    }
    res.json({ message: "Post created successfully.", postId: result.insertId });
  });
});

// Fetch All Bulletin Posts (Only Moderated)
app.get("/get-posts", (req, res) => {
  const query = "SELECT * FROM bulletin_posts WHERE moderated = TRUE ORDER BY created_at DESC";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching posts:", err);
      return res.status(500).json({ error: "Failed to fetch posts." });
    }
    res.json(results);
  });
});

// Add a Comment to a Post
app.post("/add-comment", (req, res) => {
  const { post_id, user_id, content } = req.body;
  if (!post_id || !user_id || !content) {
    return res.status(400).json({ error: "All fields are required." });
  }

  const query = `INSERT INTO bulletin_comments (post_id, user_id, content) VALUES (?, ?, ?)`;
  db.query(query, [post_id, user_id, content], (err, result) => {
    if (err) {
      console.error("Error adding comment:", err);
      return res.status(500).json({ error: "Failed to add comment." });
    }
    res.json({ message: "Comment added successfully." });
  });
});

// Fetch Comments for a Post
app.get("/get-comments/:post_id", (req, res) => {
  const { post_id } = req.params;
  const query = "SELECT * FROM bulletin_comments WHERE post_id = ? ORDER BY created_at ASC";

  db.query(query, [post_id], (err, results) => {
    if (err) {
      console.error("Error fetching comments:", err);
      return res.status(500).json({ error: "Failed to fetch comments." });
    }
    res.json(results);
  });
});

// Moderate Posts (Admin or Landlord)
app.post("/moderate-post", (req, res) => {
  const { post_id, approved } = req.body;
  if (!post_id) return res.status(400).json({ error: "Post ID is required." });

  const query = "UPDATE bulletin_posts SET moderated = ? WHERE post_id = ?";
  db.query(query, [approved, post_id], (err) => {
    if (err) {
      console.error("Error moderating post:", err);
      return res.status(500).json({ error: "Failed to moderate post." });
    }
    res.json({ message: `Post ${approved ? "approved" : "rejected"}.` });
  });
});

// Start the server
app.listen(8081, () => {
  console.log("Server is listening on port 8081");
});

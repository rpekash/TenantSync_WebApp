// server.js
const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const axios = require("axios");
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { check, validationResult } = require("express-validator");
require('dotenv').config();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY); // Add Stripe

const app = express();

// Configure CORS to Allow Frontend with Credentials
const corsOptions = {
  origin: "http://localhost:5173", //  Allow frontend origin
  credentials: true, //  Allow cookies/session authentication
  methods: ["GET", "POST", "PUT", "DELETE"], //  Allow needed methods
  allowedHeaders: ["Content-Type", "Authorization"], //  Allow headers
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const apiKey = process.env.GEMINI_API_KEY || "AAIzaSyAiuTeUXIUxfSfTvJRN8X4Q27rzXfvizd4";
const genAI = new GoogleGenerativeAI(apiKey);
const generationConfig = { temperature: 0.4, topP: 1, topK: 32, maxOutputTokens: 4096 };

const paypal = require('@paypal/checkout-server-sdk'); // PayPal SDK
// PayPal environment and client setup
const environment = new paypal.core.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET);
const paypalClient = new paypal.core.PayPalHttpClient(environment);

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

// Initialize MySQL session store
const sessionStore = new MySQLStore({
  expiration: 86400000, // Sessions expire after 1 day
  createDatabaseTable: true,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
}, db);

app.use(session({
  key: 'session_cookie_name',
  secret: 'session_cookie_secret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, //  Set to `true` ONLY if using HTTPS (localhost is HTTP)
    httpOnly: true, // Prevents JavaScript access
    sameSite: "lax" //  Allows session cookies across requests
  }
}));

app.get("/check-session", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "No session found" });
  }
  return res.json({ message: "Session found", user: req.session.user });
});


// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }
  next();
};

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error logging out:", err);
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie('session_cookie_name');
    res.json({ message: "Logged out successfully" });
  });
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

app.post("/maintenance-request", isAuthenticated, upload.array("media", 10), async (req, res) => {
  try {
    const { description } = req.body;
    const tenantId = req.session.user?.userId; // Get tenant ID from session

    if (!description || !tenantId) {
      return res.status(400).json({ error: "Missing required fields: description or tenantId" });
    }

    // 🔍 Find the Landlord for this Tenant
    const landlordQuery = "SELECT landlord_id FROM tenants WHERE user_id = ?";
    db.query(landlordQuery, [tenantId], (err, landlordResult) => {
      if (err) {
        console.error(" Error fetching landlord ID:", err);
        return res.status(500).json({ error: "Database error fetching landlord ID." });
      }

      if (landlordResult.length === 0 || !landlordResult[0].landlord_id) {
        console.error(" No landlord found for this tenant.");
        return res.status(400).json({ error: "No landlord assigned to this tenant." });
      }

      const landlordId = landlordResult[0].landlord_id;
      console.log(" Landlord ID for Tenant:", landlordId);

      // 🔹 Insert Maintenance Request with Landlord ID
      const insertQuery = `
        INSERT INTO maintenancerequests 
        (user_id, description, status, priority, media_link, date_submitted, landlord_id) 
        VALUES (?, ?, 'Pending', 'Normal', NULL, NOW(), ?)
      `;
      db.query(insertQuery, [tenantId, description, landlordId], (err, result) => {
        if (err) {
          console.error(" Error inserting maintenance request:", err);
          return res.status(500).json({ error: "Error inserting maintenance request." });
        }
        console.log(" Maintenance request created successfully!");
        res.json({ message: "Maintenance request submitted successfully." });
      });
    });
  } catch (err) {
    console.error(" Error processing maintenance request:", err);
    return res.status(500).json({ error: "Error processing maintenance request." });
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

    // 🔹 If the new user is a tenant, insert into the tenants table
    if (req.body.values.role === "tenant") {
      const insertTenantQuery = "INSERT INTO tenants (`user_id`, `apartment_number`, `rent_price`) VALUES (?, NULL, NULL)";

      db.query(insertTenantQuery, [userId], (tenantErr) => {
        if (tenantErr) {
          console.error("Error inserting into tenants table:", tenantErr);
          return res.status(500).json({ error: "Error inserting into tenants table" });
        }
        console.log("Tenant entry created successfully.");
      });
    }

    if (req.body.values.role === "landlord") {
      const insertLandlordQuery = `
        INSERT INTO landlords (landlord_id, name, email, phone, paypal_email) 
        VALUES (?, ?, ?, ?, NULL)`;

      db.query(insertLandlordQuery,
        [userId, req.body.values.name, req.body.values.email, req.body.values.phone],
        (landlordErr) => {
          if (landlordErr) {
            console.error(" Error inserting into landlords table:", landlordErr);
            return res.status(500).json({ error: "Error inserting into landlords table" });
          }
          console.log(" Landlord entry created successfully.");
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

        //  Save user session
        req.session.user = {
          userId: user.user_id,
          role: user.role,
          isMaintenance: maintenanceData.length > 0,
          teamId: maintenanceData.length > 0 ? maintenanceData[0].team_id : null,
          availability: maintenanceData.length > 0 ? maintenanceData[0].availability : null,
          typeOfMaintenance: maintenanceData.length > 0 ? maintenanceData[0].type_of_maintenance : null
        };

        return res.json({
          message: "Success",
          ...req.session.user
        });
      });
    } else {
      return res.status(401).json({ message: "Invalid email or password" });
    }
  });
});

const aiRequestData = {};

app.post("/chatbot", isAuthenticated, async (req, res) => {
  const tenantId = req.session.user?.userId; //  Get tenantId from session
  const userMessage = req.body.message;
  const media = req.body.media || [];

  if (!tenantId || !userMessage) {
    return res.status(400).json({ error: "Unauthorized or missing message." });
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
      // AI Predicts the Type of Maintenance
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

      // Fetch Available Worker
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

        // Insert Maintenance Request
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

          // Update Worker Availability
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

// Endpoint to create a payment intent
app.post("/api/payment/create-payment-intent", async (req, res) => {
  try {
    const { amount } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      payment_method_types: ["card", "google_pay", "apple_pay"], // Ensure these methods are included
    });

    res.status(200).send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({ error: "Failed to create payment intent" });
  }
});

// LANDLORD DASHBOARD 
//-------------------------------------

const checkLandlordRole = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "landlord") {
    console.error(" Unauthorized access attempt! Session missing or user is not a landlord.");
    return res.status(403).json({ error: "Access denied. Landlords only." });
  }

  console.log(" Access granted for Landlord:", req.session.user.userId);
  req.landlordId = req.session.user.userId; //  Store landlordId for further use
  next();
};

// Get all tenants
app.get("/landlord/tenants", checkLandlordRole, (req, res) => {
  const landlordId = req.landlordId; //  Now coming from session
  console.log("Fetching tenants for landlord:", landlordId);

  const query = `
    SELECT users.user_id, users.name, users.email, users.phone, tenants.apartment_number, tenants.rent_price 
    FROM users 
    JOIN tenants ON users.user_id = tenants.user_id 
    WHERE tenants.landlord_id = ?
  `;

  db.query(query, [landlordId], (err, results) => {
    if (err) {
      console.error("Database error fetching tenants:", err);
      return res.status(500).json({ error: "Database error." });
    }
    res.json(results);
  });
});

// Update tenant rent and apartment number
app.post("/landlord/update-tenant", checkLandlordRole, (req, res) => {
  const { tenantId, rent, apartmentNumber } = req.body;

  const query = "UPDATE tenants SET rent_price = ?, apartment_number = ? WHERE user_id = ?";
  db.query(query, [rent, apartmentNumber, tenantId], (err, result) => {
    if (err) {
      console.error("Failed to update tenant info:", err);
      return res.status(500).json({ error: "Failed to update tenant info." });
    }
    console.log(`Tenant ${tenantId} updated successfully.`);
    res.json({ message: "Tenant updated successfully." });
  });
});

// Fetch active maintenance requests
app.get("/landlord/maintenance-requests", checkLandlordRole, (req, res) => {
  const landlordId = req.landlordId;

  const query = "SELECT * FROM maintenancerequests WHERE landlord_id = ?";
  db.query(query, [landlordId], (err, results) => {
    if (err) {
      console.error("Database error fetching maintenance requests:", err);
      return res.status(500).json({ error: "Database error." });
    }
    res.json(results);
  });
});


// Message a tenant (simple placeholder for now)
app.post("/landlord/message-tenant", checkLandlordRole, (req, res) => {
  const { tenantId, message } = req.body;
  console.log(`Landlord sent message to Tenant ${tenantId}: ${message}`);
  res.json({ message: "Message sent successfully." });
});

//-------------------------------------

// Endpoint for landlords to link their PayPal account (for simplicity, we're just storing the PayPal email)
app.post("/link-paypal", (req, res) => {
  const { landlordId, paypalEmail } = req.body;

  console.log(" Updating PayPal email for Landlord ID:", landlordId);
  console.log(" New PayPal Email:", paypalEmail);

  if (!landlordId || !paypalEmail) {
    console.error(" Missing landlordId or PayPal email.");
    return res.status(400).json({ error: "Missing landlordId or PayPal email." });
  }

  const query = "UPDATE landlords SET paypal_email = ? WHERE landlord_id = ?";
  db.query(query, [paypalEmail, landlordId], (err, result) => {
    if (err) {
      console.error(" Error updating PayPal email:", err);
      return res.status(500).json({ error: "Failed to update PayPal email." });
    }

    if (result.affectedRows === 0) {
      console.error(" No landlord found with that ID.");
      return res.status(400).json({ error: "No landlord found with this ID." });
    }

    console.log(" PayPal email updated successfully.");
    res.json({ message: "PayPal email linked successfully." });
  });
});

app.post("/create-payment", async (req, res) => {
  const { amount, currency, landlordId } = req.body;

  if (!amount || !currency || !landlordId) {
    console.error(" Missing required fields:", { amount, currency, landlordId });
    return res.status(400).json({ error: "Missing amount, currency, or landlordId." });
  }

  // Fetch landlord's PayPal email
  const query = "SELECT paypal_email FROM landlords WHERE landlord_id = ?";
  db.query(query, [landlordId], async (err, result) => {
    if (err) {
      console.error(" Database error fetching PayPal email:", err);
      return res.status(500).json({ error: "Database error while fetching PayPal email." });
    }

    if (result.length === 0 || !result[0].paypal_email) {
      console.error(" Landlord has not linked a PayPal account.");
      return res.status(400).json({ error: "Landlord has not linked a PayPal account." });
    }

    const paypalEmail = result[0].paypal_email;
    console.log(" PayPal Email:", paypalEmail);

    try {
      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer("return=representation");
      request.requestBody({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount.toFixed(2),
            },
            payee: {
              email_address: paypalEmail,
            },
          },
        ],
        application_context: {
          brand_name: "TenantSync Payments",
          landing_page: "LOGIN", //  Forces PayPal to show the login & review page
          user_action: "PAY_NOW",
          return_url: `http://localhost:5173/payment-success`,
          cancel_url: `http://localhost:5173/payment-cancelled`,
        },
      });

      console.log(" Sending PayPal Order Request...");

      const order = await paypalClient.execute(request);

      console.log(" PayPal Order Created:", JSON.stringify(order.result, null, 2));

      res.json(order.result);
    } catch (error) {
      console.error(" Error creating PayPal order:", error);
      res.status(500).json({ error: "Failed to create PayPal order.", details: error.message });
    }
  });
});

app.post("/capture-payment", async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ error: "Missing PayPal order ID" });
  }

  console.log(" Capturing PayPal Order:", orderId);

  try {
    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});

    const captureResponse = await paypalClient.execute(request);

    console.log(" PayPal Payment Captured Successfully:", captureResponse.result);

    // Send success response back
    res.json({ success: true, captureDetails: captureResponse.result });
  } catch (error) {
    console.error(" Error capturing PayPal order:", error);

    if (error.response) {
      console.error(" PayPal API Response:", JSON.stringify(error.response, null, 2));
    }

    res.status(500).json({ error: "Failed to capture PayPal payment", details: error.message });
  }
});

app.get("/get-landlord/:tenantId", (req, res) => {
  const tenantId = req.params.tenantId;

  // Adjust the query based on your actual database schema
  const query = "SELECT landlord_id FROM tenants WHERE user_id = ?";

  db.query(query, [tenantId], (err, result) => {
    if (err) {
      console.error("Error fetching landlord ID:", err);
      return res.status(500).json({ error: "Database error." });
    }

    if (result.length === 0 || !result[0].landlord_id) {
      return res.status(400).json({ error: "No landlord assigned to this tenant." });
    }

    res.json({ landlord_id: result[0].landlord_id });
  });
});

app.get("/get-rent/:tenantId", (req, res) => {
  const tenantId = req.params.tenantId;

  console.log(" Fetching rent for Tenant ID:", tenantId);

  const query = "SELECT rent_price FROM tenants WHERE user_id = ?";
  db.query(query, [tenantId], (err, result) => {
    if (err) {
      console.error(" Database error:", err);
      return res.status(500).json({ error: "Database query failed." });
    }

    if (result.length === 0 || result[0].rent_price === null) {
      console.error(" Rent price not found for Tenant ID:", tenantId);
      return res.status(400).json({ error: "Rent price not set for this tenant." });
    }

    console.log("✅ Rent price found:", result[0].rent_price);
    res.json({ rent_price: result[0].rent_price });
  });
});

app.get("/get-landlord-id/:tenantId", (req, res) => {
  const tenantId = req.params.tenantId;

  if (!tenantId) {
    console.error(" Missing tenant ID in request.");
    return res.status(400).json({ error: "Tenant ID is required." });
  }

  const query = `
    SELECT landlords.landlord_id 
    FROM tenants 
    JOIN landlords ON tenants.landlord_id = landlords.landlord_id 
    WHERE tenants.user_id = ?;
  `;

  db.query(query, [tenantId], (err, result) => {
    if (err) {
      console.error(" Database error fetching landlord ID:", err);
      return res.status(500).json({ error: "Database error while fetching landlord ID." });
    }

    if (result.length === 0 || !result[0].landlord_id) {
      console.error("⚠️ No landlord found for tenant ID:", tenantId);
      return res.status(400).json({ error: "No landlord assigned to this tenant." });
    }

    console.log(" Fetched Landlord ID:", result[0].landlord_id);
    res.json({ landlord_id: result[0].landlord_id });
  });
});



app.get("/get-paypal-email/:landlordId", (req, res) => {
  const { landlordId } = req.params;

  console.log("🔍 Checking PayPal email for Landlord ID:", landlordId);

  const query = "SELECT paypal_email FROM landlords WHERE landlord_id = ?";
  db.query(query, [landlordId], (err, result) => {
    if (err) {
      console.error(" Database error fetching PayPal email:", err);
      return res.status(500).json({ error: "Database error while fetching PayPal email." });
    }

    if (result.length === 0) {
      console.error("⚠️ Landlord not found.");
      return res.status(400).json({ error: "Landlord not found." });
    }

    console.log("PayPal Email Fetched:", result[0].paypal_email);
    res.json({ paypal_email: result[0].paypal_email });
  });
});

// Start the server
app.listen(8081, () => {
  console.log("Server is listening on port 8081");
});

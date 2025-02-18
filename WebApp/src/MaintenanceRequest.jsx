import React, { useState, useEffect } from 'react';
import axios from 'axios';

function MaintenanceRequest() {
  const [description, setDescription] = useState("");
  const [media, setMedia] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    //  Fetch session to check if the user is logged in
    axios.get("http://localhost:8081/check-session", { withCredentials: true })
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null)); // If session check fails, set user to null
  }, []);

  const handleFileChange = (e) => {
    setMedia([...e.target.files]);
  };

  const handleManualSubmit = async () => {
    if (!user) {
      alert("User is not logged in. Please log in first.");
      return;
    }
  
    const formData = new FormData();
    formData.append("description", description);
    formData.append("tenantId", user.userId); //  Use session user ID
    media.forEach((file) => {
      formData.append("media", file);
    });

    setChatHistory((prev) => [...prev, { sender: "User", message: description }]);
  
    try {
      const response = await axios.post("http://localhost:8081/maintenance-request", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true, //  Required for authentication
      });
  
      if (response.data.message) {
        setChatHistory((prev) => [...prev, { sender: "System", message: response.data.message }]);
      }

      if (response.data.aiPrediction) {
        setChatHistory((prev) => [...prev, { sender: "AI", message: `AI Predicted Issue: ${response.data.aiPrediction}` }]);
      }
    } catch (error) {
      console.error("Error submitting maintenance request:", error);
      setChatHistory((prev) => [...prev, { sender: "System", message: "Failed to submit request. Please try again." }]);
    }
  };
  
  const handleAutoSubmit = async () => {
    if (!user) {
      alert("User is not logged in. Please log in first.");
      return;
    }
  
    try {
      const response = await axios.post("http://localhost:8081/chatbot", {
        message: currentMessage,
        media: media.map(file => ({ path: file.name })),
      }, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true, //  Required for authentication
      });
  
      if (response.data.reply) {
        setChatHistory((prev) => [...prev, { sender: "AI", message: response.data.reply }]);

        if (response.data.reply.toLowerCase().includes("ready to submit")) {
          handleManualSubmit();
        }
      }
    } catch (error) {
      console.error("Error in AI auto-submit:", error);
      setChatHistory((prev) => [...prev, { sender: "System", message: "Failed to process automatic submission. Please try again." }]);
    }

    setCurrentMessage("");
  };
  
  const handleSendMessage = async (e) => {
    e.preventDefault();
  
    if (currentMessage.trim() !== "") {
      setChatHistory((prev) => [...prev, { sender: "User", message: currentMessage }]);

      if (!user) {
        setChatHistory((prev) => [...prev, { sender: "System", message: "User is not logged in. Please log in first." }]);
        return;
      }
  
      if (autoSubmit) {
        handleAutoSubmit();
      } else {
        try {
          const response = await axios.post("http://localhost:8081/chatbot", {
            message: currentMessage,
            media: media.map((file) => ({ path: file.name })),
          }, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true, //  Required for authentication
          });
  
          if (response.data.reply) {
            setChatHistory((prev) => [...prev, { sender: "AI", message: response.data.reply }]);
          }
        } catch (error) {
          console.error("Error communicating with chatbot:", error);
          setChatHistory((prev) => [...prev, { sender: "System", message: "Failed to get a response from chatbot. Please try again." }]);
        }
      }
  
      setCurrentMessage("");
    }
  };
  
  return (
    <div>
      <h1>Maintenance Request</h1>
      {user ? <p>Logged in as: {user.role}</p> : <p>Please log in</p>}

      <button onClick={() => setAutoSubmit(!autoSubmit)}>
        Switch to {autoSubmit ? "Manual" : "Automatic"} Submission
      </button>

      <div>
        <div style={{ marginBottom: '20px' }}>
          {!autoSubmit && (
            <>
              <label>Description of Issue:</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                style={{ width: '100%', marginBottom: '10px' }}
              />
            </>
          )}

          <label>Upload Photos/Videos:</label>
          <input type="file" multiple onChange={handleFileChange} style={{ marginBottom: '10px' }} />

          {!autoSubmit && <button onClick={handleManualSubmit}>Submit Maintenance Request</button>}
        </div>
      </div>

      <div className="chat-box" style={{ border: '1px solid #ccc', padding: '10px', height: '300px', overflowY: 'scroll', marginBottom: '20px' }}>
        {chatHistory.map((chat, index) => (
          <div key={index} style={{ marginBottom: '10px' }}>
            <strong>{chat.sender}:</strong> {chat.message}
          </div>
        ))}
      </div>

      <form onSubmit={handleSendMessage} style={{ marginBottom: '20px' }}>
        <div>
          <label>Enter Message:</label>
          <input
            type="text"
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            required
            style={{ width: '80%' }}
          />
          <button type="submit">Send</button>
        </div>
      </form>
    </div>
  );
}

export default MaintenanceRequest;

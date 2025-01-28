import React, { useState } from 'react';
import axios from 'axios';

function MaintenanceRequest() {
  const [description, setDescription] = useState("");
  const [media, setMedia] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [autoSubmit, setAutoSubmit] = useState(false);

  const handleFileChange = (e) => {
    setMedia([...e.target.files]);
  };

  const handleManualSubmit = async () => {
    const tenantId = localStorage.getItem("tenantId");
    if (!tenantId) {
      alert("User is not logged in. Please log in first.");
      return;
    }
  
    const formData = new FormData();
    formData.append("description", description);
    formData.append("tenantId", tenantId);
    media.forEach((file) => {
      formData.append("media", file);
    });
  
    setChatHistory(prev => [...prev, { sender: "User", message: description }]);
  
    try {
      const response = await axios.post("http://127.0.0.1:8081/maintenance-request", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
  
      if (response.data.message) {
        setChatHistory(prev => [...prev, { sender: "System", message: response.data.message }]);
      }
  
      if (response.data.aiPrediction) {
        setChatHistory(prev => [...prev, { sender: "AI", message: `AI Predicted Issue: ${response.data.aiPrediction}` }]);
      }
    } catch (error) {
      console.error("Error submitting maintenance request:", error);
      setChatHistory(prev => [...prev, { sender: "System", message: "Failed to submit request. Please try again." }]);
    }
  };
  
  const handleAutoSubmit = async () => {
    const tenantId = localStorage.getItem("tenantId");
    if (!tenantId) {
      alert("User is not logged in. Please log in first.");
      return;
    }
  
    try {
      const response = await axios.post("http://127.0.0.1:8081/chatbot", {
        message: currentMessage,
        tenantId, // Use dynamic tenantId
        media: media.map(file => ({ path: file.name })),
      }, {
        headers: {
          "Content-Type": "application/json",
        },
      });
  
      if (response.data.reply) {
        setChatHistory(prev => [...prev, { sender: "AI", message: response.data.reply }]);
  
        if (response.data.reply.toLowerCase().includes("ready to submit")) {
          const formData = new FormData();
          formData.append("description", description);
          formData.append("tenantId", tenantId);
          media.forEach(file => {
            formData.append("media", file);
          });
  
          const submitResponse = await axios.post("http://localhost:8081/maintenance-request", formData, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });
  
          if (submitResponse.data.message) {
            setChatHistory(prev => [...prev, { sender: "System", message: submitResponse.data.message }]);
          }
  
          if (submitResponse.data.aiPrediction) {
            setChatHistory(prev => [...prev, { sender: "AI", message: `AI Predicted Issue: ${submitResponse.data.aiPrediction}` }]);
          }
        }
      }
    } catch (error) {
      console.error("Error in AI auto-submit:", error);
      setChatHistory(prev => [...prev, { sender: "System", message: "Failed to process automatic submission. Please try again." }]);
    }
    setCurrentMessage("");
  };
  
  const handleSendMessage = async (e) => {
    e.preventDefault();
  
    if (currentMessage.trim() !== "") {
      setChatHistory((prev) => [...prev, { sender: "User", message: currentMessage }]);
  
      const tenantId = localStorage.getItem("tenantId");
      if (!tenantId) {
        setChatHistory((prev) => [
          ...prev,
          { sender: "System", message: "User is not logged in. Please log in first." },
        ]);
        return;
      }
  
      if (autoSubmit) {
        handleAutoSubmit();
      } else {
        try {
          const response = await axios.post("http://localhost:8081/chatbot", {
            message: currentMessage,
            tenantId, // Use dynamic tenant ID
            media: media ? media.map((file) => ({ path: file.name })) : [],
          }, {
            headers: {
              "Content-Type": "application/json",
            },
          });
  
          if (response.data.reply) {
            setChatHistory((prev) => [...prev, { sender: "AI", message: response.data.reply }]);
          }
        } catch (error) {
          console.error("Error communicating with chatbot:", error);
          setChatHistory((prev) => [
            ...prev,
            { sender: "System", message: "Failed to get a response from chatbot. Please try again." },
          ]);
        }
      }
  
      setCurrentMessage("");
    }
  };
  
  return (
    <div>
      <h1>Maintenance Request</h1>
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
          {!autoSubmit && (
            <button onClick={handleManualSubmit}>Submit Maintenance Request</button>
          )}
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

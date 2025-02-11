import React, { useState, useEffect } from "react";
import axios from "axios";

const MaintenancePage = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [bookings, setBookings] = useState([]);
  const [timers, setTimers] = useState({});
  const [availability, setAvailability] = useState("");
  const [workerId, setWorkerId] = useState(null);
  const [typeOfMaintenance, setTypeOfMaintenance] = useState(""); // New state for type selection
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user"));

    if (userData && userData.isMaintenance) {
      setWorkerId(userData.teamId);
      setTypeOfMaintenance(userData.typeOfMaintenance || ""); // Default if missing
    } else {
      setWorkerId(null);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (workerId) {
      fetchBookings();
      fetchAvailability();
    }
  }, [workerId, selectedDate]);

  const fetchBookings = async () => {
    if (!workerId) return;

    try {
      const response = await axios.get(`http://localhost:8081/bookings/${workerId}/${selectedDate}`);
      setBookings(response.data);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  };

  const fetchAvailability = async () => {
    if (!workerId) return;

    try {
      const response = await axios.get(`http://localhost:8081/get-availability/${workerId}`);
      if (response.data?.availability) {
        setAvailability(response.data.availability);
      }
    } catch (error) {
      console.error("Error fetching availability:", error);
    }
  };

  const updateAvailability = async () => {
    try {
      await axios.post("http://localhost:8081/update-availability", {
        workerId,
        availability,
      });
      alert("Availability updated successfully!");
    } catch (error) {
      console.error("Error updating availability:", error);
      alert("Failed to update availability.");
    }
  };

  const updateMaintenanceType = async (e) => {
    const newType = e.target.value;
    setTypeOfMaintenance(newType);

    try {
      await axios.post("http://localhost:8081/update-maintenance-type", {
        workerId,
        typeOfMaintenance: newType,
      });
      alert("Maintenance type updated successfully!");
    } catch (error) {
      console.error("Error updating maintenance type:", error);
      alert("Failed to update maintenance type.");
    }
  };

  const toggleMaintenance = async (requestId) => {
    setTimers((prev) => ({
      ...prev,
      [requestId]: prev[requestId]
        ? { ...prev[requestId], active: false } // Stop timer
        : { startTime: Date.now(), elapsed: 0, active: true }, // Start timer
    }));

    if (timers[requestId]) {
      const elapsedTime = Math.floor((Date.now() - timers[requestId].startTime) / 1000);
      const formattedTime = `${Math.floor(elapsedTime / 60)}:${(elapsedTime % 60).toString().padStart(2, "0")}`;

      try {
        await axios.post("http://localhost:8081/complete-request", {
          id: requestId,
          timeTaken: formattedTime,
        });

        setTimers((prev) => {
          const updated = { ...prev };
          delete updated[requestId];
          return updated;
        });

        fetchBookings();
      } catch (error) {
        console.error("Error marking request as completed:", error);
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prevTimers) => {
        const updatedTimers = { ...prevTimers };

        Object.keys(updatedTimers).forEach((requestId) => {
          if (updatedTimers[requestId]?.active) {
            updatedTimers[requestId] = {
              ...updatedTimers[requestId],
              elapsed: Math.floor((Date.now() - updatedTimers[requestId].startTime) / 1000),
            };
          }
        });

        return updatedTimers;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timers]);

  if (isLoading) return <h1>Loading...</h1>;
  if (!workerId) return <h1>Access Denied: Not a Maintenance Worker</h1>;

  return (
    <div>
      <h1>Maintenance Page</h1>
      <div>
        <h2>Update Maintenance Type</h2>
        <select value={typeOfMaintenance} onChange={updateMaintenanceType}>
          <option value="Plumber">Plumber</option>
          <option value="Electrician">Electrician</option>
          <option value="General">General</option>
        </select>
      </div>

      <div>
        <h2>Update Availability</h2>
        <input
          type="text"
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          placeholder="e.g., 09:00-17:00"
        />
        <button onClick={updateAvailability}>Update Availability</button>
      </div>

      <div>
        <label htmlFor="date">Select Date:</label>
        <input
          type="date"
          id="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      <h2>Bookings for {selectedDate}</h2>
      <ul>
        {bookings.map((booking) => (
          <li key={booking.request_id}>
            <p>Description: {booking.description}</p>
            <p>Time Scheduled: {booking.time_scheduled}</p>
            <p>
              Timer: {timers[booking.request_id]?.elapsed
                ? `${Math.floor(timers[booking.request_id].elapsed / 60)}:${(timers[booking.request_id].elapsed % 60).toString().padStart(2, "0")}`
                : "00:00"}
            </p>
            <button onClick={() => toggleMaintenance(booking.request_id)}>
              {timers[booking.request_id]?.active ? "Mark Request as Finished" : "Start Maintenance"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MaintenancePage;

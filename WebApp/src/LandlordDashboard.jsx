import React, { useEffect, useState } from "react";
import axios from "axios";

const Card = ({ children }) => <div className="border p-4 rounded-lg shadow bg-white">{children}</div>;
const CardContent = ({ children }) => <div className="p-4">{children}</div>;
const Button = ({ children, onClick }) => (
  <button className="px-4 py-2 bg-blue-500 text-white rounded" onClick={onClick}>
    {children}
  </button>
);

const LandlordDashboard = () => {
  const [landlordId, setLandlordId] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState([]);
  const [message, setMessage] = useState("");
  const [rentPrice, setRentPrice] = useState("");
  const [apartmentNumber, setApartmentNumber] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [isPayPalLinked, setIsPayPalLinked] = useState(false);

  useEffect(() => {
    fetchLandlordId();
  }, []);

  const fetchLandlordId = async () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user"));
  
      if (!storedUser || storedUser.role.toLowerCase() !== "landlord") {
        console.error(" Not a landlord or session missing!");
        return;
      }
  
      console.log(" Landlord ID from session:", storedUser.userId);
      setLandlordId(storedUser.userId); //  Correctly setting landlordId
  
      // Fetch additional landlord details
      await fetchPayPalEmail(storedUser.userId);
      await fetchTenants(storedUser.userId);
      await fetchMaintenanceRequests(storedUser.userId);
    } catch (error) {
      console.error(" Error fetching session data:", error.message);
    }
  };
  

  const fetchTenants = async () => {
    try {
      const response = await axios.get("http://localhost:8081/landlord/tenants", {
        withCredentials: true, //  Ensures session is sent
      });
      setTenants(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error(" Error fetching tenants:", error);
      setTenants([]);
    }
  };
  
  const fetchMaintenanceRequests = async (landlordId) => {
    try {
      const response = await axios.get("http://localhost:8081/landlord/maintenance-requests", {
        withCredentials: true, //  Ensures session is sent
      });
  
      console.log(" Fetched Maintenance Requests:", response.data);
      setMaintenanceRequests(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error(" Error fetching maintenance requests:", error);
      setMaintenanceRequests([]);
    }
  };

  const fetchPayPalEmail = async (landlordId) => {
    try {
      const response = await axios.get(`http://localhost:8081/get-paypal-email/${landlordId}`);
      setPaypalEmail(response.data.paypal_email || "");
      setIsPayPalLinked(!!response.data.paypal_email);
    } catch (error) {
      console.error(" Error fetching PayPal email:", error.response?.data || error.message);
    }
  };

  const linkPaypalAccount = async () => {
    if (!paypalEmail) {
      alert(" Please enter your PayPal email.");
      return;
    }

    try {
      console.log("🔄 Sending PayPal email update...");
      console.log("🆔 Landlord ID:", landlordId);
      console.log("💰 PayPal Email:", paypalEmail);

      await axios.post("http://localhost:8081/link-paypal", {
        landlordId,
        paypalEmail,
      });

      alert(" PayPal account linked successfully.");
      setIsPayPalLinked(true);
    } catch (error) {
      console.error(" Error linking PayPal account:", error.response?.data || error.message);
      alert(`Failed to link PayPal: ${error.response?.data?.error || "Unknown error"}`);
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h2 className="text-2xl font-bold mb-6 text-center">Landlord Dashboard</h2>

      {!isPayPalLinked && (
        <div className="bg-red-200 text-red-700 p-4 rounded mb-4">
          ⚠️ You have not linked a PayPal account. Payments will fail until you link one!
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold mb-4">Tenants</h3>
            {tenants.map((tenant) => (
              <div key={tenant.user_id} className="mb-4 p-4 border rounded bg-gray-50">
                <p><strong>Name:</strong> {tenant.name}</p>
                <p><strong>Email:</strong> {tenant.email}</p>
                <p><strong>Phone:</strong> {tenant.phone}</p>
                <p><strong>Apartment:</strong> {tenant.apartment_number || "Not set"}</p>
                <p><strong>Rent:</strong> ${tenant.rent_price || "Not set"}</p>

                <div className="mt-2 flex space-x-2">
                  <input
                    type="text"
                    placeholder="Rent Price"
                    value={rentPrice}
                    onChange={(e) => setRentPrice(e.target.value)}
                    className="border p-2 rounded"
                  />
                  <input
                    type="text"
                    placeholder="Apartment Number"
                    value={apartmentNumber}
                    onChange={(e) => setApartmentNumber(e.target.value)}
                    className="border p-2 rounded"
                  />
                  <Button onClick={() => updateTenant(tenant.user_id)}>Update</Button>
                </div>

                <div className="mt-2 flex space-x-2">
                  <input
                    type="text"
                    placeholder="Enter message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="border p-2 rounded w-full"
                  />
                  <Button onClick={() => sendMessage(tenant.user_id)}>Send</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold mb-4">Active Maintenance Requests</h3>
            {maintenanceRequests.length === 0 ? (
              <p>No active maintenance requests</p>
            ) : (
              maintenanceRequests.map((req) => (
                <div key={req.request_id} className="mb-4 p-4 border rounded bg-gray-50">
                  <p><strong>Description:</strong> {req.description}</p>
                  <p><strong>Status:</strong> {req.status}</p>
                  <p><strong>Priority:</strong> {req.priority}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold mb-4">Link PayPal Account</h3>
            <div className="flex space-x-2">
              <input
                type="email"
                placeholder="PayPal Email"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                className="border p-2 rounded w-full"
              />
              <Button onClick={linkPaypalAccount}>Link PayPal</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LandlordDashboard;

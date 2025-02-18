import React, { useState, useEffect } from "react";
import axios from "axios";

const PaymentPage = () => {
  const [rentAmount, setRentAmount] = useState(null);
  const [currency, setCurrency] = useState("USD");
  const [landlordId, setLandlordId] = useState(null);
  const [tenantId, setTenantId] = useState(null);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
  
    if (!storedUser || storedUser.role !== "tenant") {
      console.error(" Not a tenant or session missing!");
      return;
    }
  
    console.log(" Fetched Tenant ID from session:", storedUser.userId);
    setTenantId(storedUser.userId);
  
    //  Check localStorage first for landlordId
    const storedLandlordId = localStorage.getItem("landlordId");
    if (storedLandlordId) {
      console.log("🛠️ Using stored Landlord ID:", storedLandlordId);
      setLandlordId(storedLandlordId);
    } else {
      fetchLandlordId(storedUser.userId); // Fetch if not in storage
    }
  
    fetchRentAmount(storedUser.userId);
  }, []);
  

  //  Fetch Rent Amount from Backend
  const fetchRentAmount = async (tenantId) => {
    try {
      console.log(" Fetching rent for Tenant ID:", tenantId);
      const response = await axios.get(`http://localhost:8081/get-rent/${tenantId}`);
      console.log(" Rent Amount API Response:", response.data);
      setRentAmount(response.data.rent_price);
    } catch (error) {
      console.error(" Error fetching rent amount:", error.response?.data || error.message);
    }
  };

  const fetchLandlordId = async () => {
    try {
      console.log(" Fetching Landlord ID for Tenant ID:", tenantId);
  
      const response = await axios.get(`http://localhost:8081/get-landlord/${tenantId}`);
      
      if (response.data.landlord_id) {
        setLandlordId(response.data.landlord_id);
        localStorage.setItem("landlordId", response.data.landlord_id); // Store landlord ID in localStorage
        console.log(" Fetched Landlord ID:", response.data.landlord_id);
      } else {
        console.warn(" No landlord ID found in response!");
      }
    } catch (error) {
      console.error(" Error fetching landlord ID:", error.response?.data || error.message);
    }
  };
  
  
  
  const createPayment = async () => {
    console.log(" Initiating payment for Tenant ID:", tenantId);
    console.log(" Landlord ID:", landlordId);
    console.log(" Rent Amount:", rentAmount);
    console.log(" Currency:", currency);
  
    if (!rentAmount || !landlordId || !currency) {
      alert(" Missing required values! Check console for details.");
      return;
    }
  
    try {
      const response = await axios.post("http://localhost:8081/create-payment", {
        tenantId,
        currency,
        landlordId,
        amount: rentAmount, // Ensure amount is sent!
      });
  
      console.log(" Payment API Response:", response.data);
  
      //  Extract the approval URL and redirect the user to PayPal
      const approvalLink = response.data.links.find(link => link.rel === "approve");
      if (approvalLink) {
        window.location.href = approvalLink.href; // Redirect user to PayPal for payment
      } else {
        alert(" Failed to find PayPal approval link.");
      }
    } catch (error) {
      console.error(" Error creating payment:", error.response?.data || error.message);
      alert(`Payment failed: ${error.response?.data?.error || "Unknown error"}`);
    }
  };
  

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h2 className="text-2xl font-bold mb-6 text-center">Payment Page</h2>

      <div className="mb-6">
        <label className="block mb-2">Rent Amount</label>
        <input
          type="text"
          value={rentAmount ? `$${rentAmount}` : "Loading..."}
          disabled
          className="border p-2 rounded w-full bg-gray-200"
        />
      </div>

      <button onClick={createPayment} className="px-4 py-2 bg-blue-500 text-white rounded">
        Pay Rent
      </button>
    </div>
  );
};

export default PaymentPage;

// export default Home;
import React from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function Home() {
    const navigate = useNavigate();

    // Logout Function
    const handleLogout = async () => {
        try {
            await axios.post("http://localhost:8081/logout", {}, { withCredentials: true }); 
            localStorage.removeItem("user"); 
            navigate("/login"); 
        } catch (error) {
            console.error("Error during logout:", error);
        }
    };
    
    return (
        <>
            <header className="header">
                <div className="logo">TenantSync</div>
                <nav className="nav">
                    <a href="/landlord-dashboard">Dashboard</a>
                    <a href="/Payment-Page">Payments</a>
                    <a href="/maintenance-requests">Maintenance</a>
                    <a href="/bulletin-board">Bulletin</a>
                </nav>
                <div className="profile">
                    <span className="notification">🔔</span>
                    <button className="profile-button">Profile</button> 
                    <button className="logout-button" onClick={handleLogout}>Logout</button>
                </div>
            </header>

            <footer className="footer">
                <p>&copy; {new Date().getFullYear()} TenantSync. All rights reserved.</p>
                <nav className="footer-nav">
                    <a href="#about">About</a>
                    <a href="#contact">Contact</a>
                    <a href="#privacy">Privacy Policy</a>
                    <a href="#terms">Terms of Service</a>
                </nav>
            </footer>
        </>
    );
}

export default Home;
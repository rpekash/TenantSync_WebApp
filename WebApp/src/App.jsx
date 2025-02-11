import React from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./Home";
import MaintenanceRequest from "./MaintenanceRequest";
import Login from "./Login";
import Signup from "./Signup";
import MaintenancePage from "./MaintenancePage";
import BulletinBoard from "./BulletinBoard";


function App() {
  console.log("App component rendering");

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/home" element={<Home />} />
        <Route path="/maintenance-requests" element={<MaintenanceRequest />} />
        <Route path="/maintenance-page" element={<MaintenancePage />} />
        <Route path="/bulletin-board" element={<BulletinBoard />} /> 
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

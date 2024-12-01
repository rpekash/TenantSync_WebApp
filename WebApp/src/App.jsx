import Login from './Login.jsx'
import Signup from './Signup.jsx';
import Home from './Home.jsx';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
// import MaintenanceRequests from "./MaintenanceRequests";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Login />}></Route>
        <Route path='/signup' element={<Signup />}></Route>
        <Route path='/home' element={<Home />}></Route>
        {/* <Route path="/maintenance-requests" element={<MaintenanceRequests />} /> */}
      </Routes>
    </BrowserRouter>
  );
} 

export default App

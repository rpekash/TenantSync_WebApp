import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Validation from './SignupValidation';
import axios from 'axios';


function Signup() {

  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    role: ""
  });

  const navigate = useNavigate();

  const [errors, setErrors] = useState({});

  const handleInput = (event) => {
    setValues(prev => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setErrors(Validation(values));
    if (errors.name == "" && errors.email === "" && errors.password === "") {
      axios.post('http://localhost:8081/signup', { values })
        .then(res => {
          navigate('/login')
        })
        .catch(err => console.log(err));
    }
  };

  return (
    <div
      className='d-flex justify-content-center align-items-center'
      style={{
        backgroundColor: '#007bff', 
        height: '100vh',
        width: '100vw',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        className='bg-white p-4 rounded'
        style={{
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
        }}
      >
        <h2>Sign-Up</h2>
        <form action="" onSubmit={handleSubmit}>

          <div className='mb-3'>
            <label htmlFor='name'><strong>Name</strong></label>
            <input
              type='text'
              placeholder='Enter Name'
              name='name'
              onChange={handleInput}
              className='form-control rounded-0'
            />
            {errors.name && <span className='text-danger'>{errors.name}</span>}
          </div>

          <div className='mb-3'>
            <label htmlFor='email'><strong>Email</strong></label>
            <input
              type='email'
              placeholder='Enter Email'
              name='email'
              onChange={handleInput}
              className='form-control rounded-0'
            />
            {errors.email && <span className='text-danger'>{errors.email}</span>}
          </div>

          <div className='mb-3'>
            <label htmlFor='phone'><strong>Phone Number</strong></label>
            <input
              type='text'
              placeholder='Enter Phone Number'
              name='phone'
              onChange={handleInput}
              className='form-control rounded-0'
            />
            {errors.phone && <span className='text-danger'>{errors.phone}</span>}
          </div>

          <div className='mb-3'>
            <label htmlFor='password'><strong>Password</strong></label>
            <input
              type='password'
              placeholder='Enter Password'
              name='password'
              onChange={handleInput}
              className='form-control rounded-0'
            />
            {errors.password && <span className='text-danger'>{errors.password}</span>}
          </div>

          <div className='mb-3'>
            <label htmlFor='role'><strong>Role</strong></label>
            <select
              name='role'
              onChange={handleInput}
              className='form-control rounded-0'
            >
              <option value='tenant'>Tenant</option>
              <option value='landlord'>Landlord</option>
              <option value='maintenance'>Maintenance</option>

            </select>
            {errors.role && <span className='text-danger'>{errors.role}</span>}
          </div>

          <button type='submit' className='btn btn-success w-100 rounded-0'>Sign up</button>
          <p className='text-center'></p>
          <Link to='/login' className='btn btn-outline-secondary w-100 rounded-0 text-decoration-none'>Go back to login</Link>
        </form>
      </div>
    </div>
  );
}

export default Signup;

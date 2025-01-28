import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Validation from './LoginValidation';

function Login() {
  const [values, setValues] = useState({
    email: '',
    password: ''
  });

  const navigate = useNavigate();
  const [errors, setErrors] = useState({});

  const handleInput = (event) => {
    setValues(prev => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const validationErrors = Validation(values);
    setErrors(validationErrors);

    if (!validationErrors.email && !validationErrors.password) {
      axios.post('http://localhost:8081/login', values)
        .then(res => {
          if (res.data.message === "Success") {
            // Save tenantId in localStorage or state
            localStorage.setItem('tenantId', res.data.userId); // Save user ID for dynamic usage
            navigate('/home');
          } else {
            alert("No record existed");
          }
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
        <h2>Sign-In</h2>
        <form onSubmit={handleSubmit}>
          <div className='mb-3'>
            <label htmlFor='email'><strong>Email</strong></label>
            <input
              type='email'
              placeholder='Enter Email'
              name='email'
              onChange={handleInput}
              className='form-control'
            />
            {errors.email && <span className='text-danger'>{errors.email}</span>}
          </div>
          <div className='mb-3'>
            <label htmlFor='password'><strong>Password</strong></label>
            <input
              type='password'
              placeholder='Enter Password'
              name='password'
              onChange={handleInput}
              className='form-control'
            />
            {errors.password && <span className='text-danger'>{errors.password}</span>}
          </div>
          <button type='submit' className='btn btn-success w-100 mb-2'>
            <strong>Log in</strong>
          </button>
          <Link to="/signup" className='btn btn-outline-secondary w-100 text-decoration-none'>
            Create Account
          </Link>
        </form>
      </div>
    </div>
  );
}

export default Login;

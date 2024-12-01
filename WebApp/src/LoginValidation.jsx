
function Validation(values) {
    let error = {};
    const email_pattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    const password_pattern = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[a-zA-Z0-9]{8,}$/;
  
    if (values.email === "") {
      error.email = "Required";
    } else if (!email_pattern.test(values.email)) {
      error.email = "Incorrect Email";
    } else {
      error.email = "";
    }
  
    if (values.password === "") {
      error.password = "Required";
    } else if (!password_pattern.test(values.password)) {
      error.password = "Incorrect Password";
    } else {
      error.password = "";
    }
  
    return error;
  }
  
  export default Validation;
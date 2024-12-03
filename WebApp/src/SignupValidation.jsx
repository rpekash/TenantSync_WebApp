function Validation(values) {
  let error = {};
  const email_pattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const password_pattern = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[a-zA-Z0-9]{8,}$/;
  const phone_pattern = /^\d{10}$/;

  if (values.name === "") {
    error.name = "Required";
  } else {
    error.name = "";
  }

  if (values.email === "") {
    error.email = "Required";
  } else if (!email_pattern.test(values.email)) {
    error.email = "Incorrect Email";
  } else {
    error.email = "";
  }

  if (values.phone === "") {
    error.phone = "Required";
  } else if (!phone_pattern.test(values.phone)) {
    error.phone = "Invalid Phone Number";
  } else {
    error.phone = "";
  }

  if (values.password === "") {
    error.password = "Required";
  } else if (!password_pattern.test(values.password)) {
    error.password = "Incorrect Password";
  } else {
    error.password = "";
  }

  if (values.role === "") {
    error.role = "Required";
  } else if (!["tenant", "landlord"].includes(values.role)) {
    error.role = "Invalid Role";
  } else {
    error.role = "";
  }

  return error;
}

export default Validation;

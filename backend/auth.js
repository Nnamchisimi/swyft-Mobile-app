import express from 'express';
const router = express.Router();

const users = [
  { email: 'john@passenger.com', password: '1234', role: 'passenger' },
  { email: 'sarah@driver.com', password: '5678', role: 'driver' },
];

router.post('/signin', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.user = { email: user.email, role: user.role };

  const { password: pw, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

router.get('/profile', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }
  res.json(req.session.user);
});


router.post('/signup', (req, res) => {
  const { firstName, lastName, email, password, role, phone, vehiclePlate } = req.body;

  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const newUser = {
    firstName,
    lastName,
    email,
    password,
    role: role.toLowerCase(),
    phone: role.toLowerCase() === 'driver' ? phone : null,
    vehiclePlate: role.toLowerCase() === 'driver' ? vehiclePlate : null,
  };

  users.push(newUser);

  const { password: pw, ...userWithoutPassword } = newUser;
  res.status(201).json(userWithoutPassword);
});

export default router;

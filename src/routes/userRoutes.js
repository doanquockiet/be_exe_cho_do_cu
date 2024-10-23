const express = require('express');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Register User
router.post('/register', async (req, res) => {
    const { email, password, username } = req.body;

    try {
        const emailLowerCase = email.toLowerCase();

        // Check if the user with the email already exists
        let user = await User.findOne({ email: emailLowerCase });
        if (user) return res.status(400).json({ message: "Email already exists" });

        // Check if username exists, if provided
        if (username) {
            let userByUsername = await User.findOne({ username });
            if (userByUsername) return res.status(400).json({ message: "Username already exists" });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user
        user = new User({ email: emailLowerCase, password: hashedPassword, username: username || null });
        await user.save();

        // Generate a JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(201).json({ token, message: "Registration successful" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



// Login User
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Ensure email is in lowercase to avoid case-sensitivity issues
        const emailLowerCase = email.toLowerCase();

        // Find the user by email
        const user = await User.findOne({ email: emailLowerCase });
        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        // Compare the provided password with the stored hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        // Generate a JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ token, message: "Login successful" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;


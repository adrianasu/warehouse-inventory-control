const express = require('express');
const jwt = require('jsonwebtoken');

const { localPassportMiddleware, jwtPassportMiddleware } = require('../auth/auth.strategy');

const { JWT_SECRET, JWT_EXPIRY } = require('../config.js');

const authRouter = express.Router();

function createJWToken(user) {
    return jwt.sign({
        user
    },
    JWT_SECRET, {
        subject: user.email,
        expiresIn: JWT_EXPIRY,
        algorithm: 'HS256'
    });
}

// email and password authentication
authRouter.post('/login', 
 localPassportMiddleware, 
(req, res) => {
 
    const user = req.user.serializeLogIn();
    const authToken = createJWToken(user);
    console.log("tokenCreated")
    return res.json({
        authToken,
        user
    });
})

// create new JWT when the previous one is about to get expired
authRouter.post('/refresh', jwtPassportMiddleware, (req, res) => {
    const user = req.user;
    const authToken = createJWToken(user);
    return res.json({
        authToken,
        user
    });
})

module.exports = { authRouter };
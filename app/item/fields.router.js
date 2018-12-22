const express = require('express');
const Joi = require('Joi');

const { HTTP_STATUS_CODES } = require('../config');
// const { jwtPassportMiddleware } = require('../auth/auth.strategy');

const { searchableFields  } = require('./item.model');

const fieldsRouter = express.Router();

// get searchable fields
fieldsRouter.get('/', (req, res) => {
    return res.status(HTTP_STATUS_CODES.OK ).json(searchableFields);
})

module.exports = { fieldsRouter };
const express = require('express');
const Joi = require('Joi');

const { HTTP_STATUS_CODE } = require('../config');
const { jwtPassportMiddleware } = require('../auth/auth.strategy');

const { Item, ItemJoiSchema, Category } = require('./item.model');

const fieldsRouter = express.Router();

// get searchable fields
fieldsRouter.get('/', (req, res) => {
    let searchableFields = [];
    Category
        .find()
        .then(categories => {
            searchableFields.push(categories);
            return res.status(HTTP_STATUS_CODE.OK).json()
        })
})
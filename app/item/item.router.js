const express = require('express');
const Joi = require('Joi');
const mongoose = require('mongoose');

const { HTTP_STATUS_CODES } = require('../config');
const { jwtPassportMiddleware } = require('../auth/auth.strategy');
const User = require('../user/user.model');
const { Item, ItemJoiSchema } = require('./item.model');

const itemRouter = express.Router();

// create new item
itemRouter.post('/', jwtPassportMiddleware, User.hasAccess(User.ACCESS_PUBLIC), (req, res) => {
    const newItem = {
        name: req.body.name,
        barcode: req.body.barcode,
        category: req.body.category,
        manufacturer: req.body.manufacturer,
        model: req.body.model,
        serialNumber: req.body.serialNumber,
        registered: req.body.registered,
        consummable: req.body.consummable,
        minimumRequired: req.body.minimumRequired,
        checkedOut: req.body.checkedOut,
        checkedIn: req.body.checkedIn,
        location: req.body.location
    }
    
    // validate new item data using Joi
    const validation = Joi.validate( newItem, ItemJoiSchema );
    if( validation.error ){
        return res.status( HTTP_STATUS_CODES.BAD_REQUEST ).json({
            message: validation.error.details[0].message
        });
    }
    // verify if barcode exists already in our DB
     return Item
    .findOne({ barcode: newItem.barcode })
    .then( item => {
        if( item ){
            return res.status( HTTP_STATUS_CODES.BAD_REQUEST ).json({
                err: 'An item with that barcode already exists.'
            });
        }
    
        
        // attempt to create new item
    return Item
        .create( newItem )
        .then( createdItem => {
            //success
            return res.status( HTTP_STATUS_CODES.CREATED ).json( createdItem.serialize());
        })
        .catch( err => {
            return res.status( HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR ).json( err );
        });
        })    
})

// get all items
itemRouter.get('/', jwtPassportMiddleware, User.hasAccess(User.ACCESS_PUBLIC), (req, res) => {
    Item 
    .find()
    .then( items => {
        console.log('Getting all items');
        let serializedItems = [];
        items.forEach( item => {
            serializedItems.push( item.serialize() );
        })
        return serializedItems;
    })
    .then( serializedItems => {
        return res.status( HTTP_STATUS_CODES.OK ).json( serializedItems );
    })
    .catch( err => {
        return res.status( HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR ).json( err );
    });
});

// get items by...
itemRouter.get('/search/:searchTerm', jwtPassportMiddleware, (req, res) => {
    
    let searchBy = [];
    if( typeof req.body.searchTerm  === 'number' ){
        searchBy = ['barcode', 'serialNumber'];
    } else {
        searchBy = ['name', 'manufacturer', 'model'];
    }

    let query = [];
    // query[req.body.searchBy] = new RegExp(req.body.searchTerm, "i"); // req ex case insensitive
    searchBy.forEach(item => {
        query.push({[item]: new RegExp(req.body.searchTerm, 'i')});
    })
    
    
    Item 
    .find({ $or: query })
    .then( items => {
        console.log('Getting items');
        let serializedItems = [];
        items.forEach( item => {
            serializedItems.push( item.serialize() );
        })
        return serializedItems;
    })
    .then( serializedItems => {
        return res.status( HTTP_STATUS_CODES.OK ).json( serializedItems );
    })
    .catch( err => {
        return res.status( HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR ).json( err );
    });
});

module.exports = { itemRouter };
const express = require('express');
const Joi = require('Joi');
const mongoose = require('mongoose');

const { HTTP_STATUS_CODES } = require('../config');
const { jwtPassportMiddleware } = require('../auth/auth.strategy');
const User = require('../user/user.model');
const { Item, ItemJoiSchema, Category, Manufacturer } = require('./item.model');

const itemRouter = express.Router();

function getCollectionIds( searchTerm, collectionName ){
     return collectionName
        .find({ name: searchTerm })
        .then( items => {
            if( items.length > 0 ){
              return items.map( item => item._id )
            }
            return items;
        })
        .catch( err => console.log( err ))
}

function getAndSendItems( query ){
    return Item
        .find({
            $or: query
        }) // we use the OR operator to get all the occurrences
        .then(items => {
            let serialized = [];
            console.log('Getting items');
            if (items.length === 1) {
                return items[0].serialize();
               
            } else if (items.length > 1) {
                items.forEach(item => {
                    serialized.push(item.serialize());
                })
                return serialized;
            }
        })
        
        
}



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
itemRouter.get('/', (req, res) => {
    return Item 
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

// get items that contain a string within its properties
itemRouter.get('/search/:searchTerm', (req, res) => {
    let searchTerm = req.params.searchTerm;
    let searchBy = [];
    let query = [];
    let categoryIds;

    // if the search term is a number, look among the properties
    // that contain only numbers (barcode and serialNumber)
    if( typeof searchTerm  === 'number' ){
        searchBy = ['barcode', 'serialNumber'];
        searchBy.forEach(item => {
            query.push({[item]: searchTerm});
        })
       
        return getAndSendItems( query )
        .then(serializedItems => {
                return res.status(HTTP_STATUS_CODES.OK).json(serializedItems);
        })
        .catch(err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        });
    } else {
        searchTerm = new RegExp(searchTerm, 'i');
   
        // if the search term is a string, look among the item's  
        // string properties
        searchBy = ['name', 'model', 'location.warehouse'];
        searchBy.forEach(item => {
            query.push({ [item]: searchTerm });
        })
        // we have to go inside the Category and Manufacturer's 
        // collections to look for the searchTerm and, if we
        // find it, we should send back the ids of those documents
        // to include them in our item query
        return getCollectionIds( searchTerm, Category )
            .then( _categoryIds => {
                categoryIds = _categoryIds;
                return getCollectionIds( searchTerm, Manufacturer )
            })
            .then( manufacturerIds => {
                categoryIds.forEach(id => {
                    query.push({ category: id.toString() });
                });
                manufacturerIds.forEach(id => {
                    query.push({ manufacturer: id.toString() });
                })
                // Finally, look for our searchTerm inside the Item 
                // collection using our complete query
                return getAndSendItems( query )
            })
            .then(serializedItems => {
                return res.status(HTTP_STATUS_CODES.OK).json(serializedItems);
            })
            .catch(err => {
                return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
            });
    }
});

module.exports = { itemRouter };
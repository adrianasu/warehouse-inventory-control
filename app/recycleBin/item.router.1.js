const express = require('express');
const Joi = require('Joi');

const { HTTP_STATUS_CODES } = require('../config');
const { jwtPassportMiddleware } = require('../auth/auth.strategy');
const User = require('../user/user.model');
const { Item, ItemJoiSchema, Category, Manufacturer } = require('../item/item.model');
const { Product, Category, Manufacturer } = require('../product/product.model');

const itemRouter = express.Router();

function getCollectionIds( searchTerm, collectionName ){
    let collection = Category;
    if( collectionName === "manufacturer" ){
        collection = Manufacturer;
    }
     return collection
        .find({ name: searchTerm })
        .then( items => {
            if( items.length > 0 ){
              return items.map( item => item._id )
            }
            return items;
        })
        .catch( err => console.log( err ))
}

function getAndSendItems( items ){
    let serialized = [];
    console.log('Getting items');
    if( items.length === 0 ) {
        return { message: 'No items found. Please, try with another values.' };
    }
    else if ( items.length === 1 ) {
        return items[0].serialize();
    } else {
        items.forEach( item => {
            serialized.push( item.serialize() );
        })
        return serialized;
    }    
}

function findWithORoperator( query ) {
    return Item.find({
        $or: query
    })
    .then( items => {
        return getAndSendItems(items) })
}

function findWithANDoperator(queries) {
    return Item.find({
        $and: queries.query
    })
    .then(items => {
        if( queries.onShelf !== "Not in query" ){
            let onShelfItems = items.filter( item => 
                    item.isOnShelf() === queries.onShelf
                )
            return getAndSendItems( onShelfItems )
            }
        return getAndSendItems(items)
    })
}

function findAll( queries ){
    return Item.find()
        .then(items => {
            if ( queries && queries.onShelf !== "Not in query") {
                let onShelfItems = items.filter(item =>
                    item.isOnShelf() === queries.onShelf
                )
                return getAndSendItems(onShelfItems)
            }
            return getAndSendItems(items)
        })
}

function getOtherQueryValues( requestQuery, queries ){
    let mongoQuery = [];
    Object.keys(requestQuery).forEach(key => {
        let keyValue = requestQuery[key];
     
        // If onShelf was selected include its search value in the query
        if( key === "onShelf" ){  
         keyValue === "true" ?    Object.assign(queries, queries.onShelf = true) :
                                       Object.assign(queries, queries.onShelf = false);  
        // Convert consummable values into booleans
        } else if( key === 'consummable'){
             keyValue === "true" ?  
                mongoQuery.push({ [key]: true }):
                mongoQuery.push({ [key]: false });
        // Fields with a number value 
        } else if( key === "barcode" || key === "serialNumber" ){
            mongoQuery.push({ [key]: keyValue });
        // String values are converted to regex
        } else {
            keyValue = new RegExp(keyValue, 'i');
            if( key === "warehouse" ){
                mongoQuery.push({ ['location.warehouse']: keyValue });
            } else if( key !== "category" && key !== "manufacturer" ){
                mongoQuery.push({ [key]: keyValue });
            } 
        }
    });
    queries.query = [...queries.query, ...mongoQuery];
    return queries;
}

function selectQueryConstructorOption( requestQuery ){
    let option = [];
    Object.keys(requestQuery).forEach(key => {
        if (key === "category" || key === "manufacturer" || key === "productName"){
            option.push(key);
        }
    });
    return option;
}

function generateSearchQuery( requestQuery ){
    let queries = {};
    queries.query = [];
    queries.onShelf = "Not in query";
    // There are three different options for constructing our query
    // depending on the properties will be looking for because our item
    // includes three nested collections (product, manufacturer & category)
    let option = selectQueryConstructorOption( requestQuery );

    // In this option we don't execute any asynchronous function
    if( option.length === 0 ){
        queries = getOtherQueryValues( requestQuery, queries );
        // If the only query is onShelf get all items to check for
        // the ones on-shelf afterwards
        if( queries.query.length === 0 && queries.onShelf !== "Not in query"){
            return findAll( queries );
        } else {
            return findWithANDoperator(queries);
        }

    // In this option we'll execute one asynchronous function
    // to get the id(s) of either manufacturer or category 
    // corresponding to the search term and include them in our query
    } else if ( option.length === 1 ){
        let key = option[0];
        let keyValue = requestQuery[key];
        keyValue = new RegExp( keyValue, 'i' );
        return getCollectionIds( keyValue, key )
            .then(ids => {
                ids.forEach(id => {
                    queries.query.push({ [key]: id.toString() });
                })
                return getOtherQueryValues( requestQuery, queries );
            })
            .then(queries => {
                return findWithANDoperator(queries)
            })
     // In this option we'll execute two asynchronous functions
     // to get the id(s) of the manufacturer and  category 
     // corresponding to the search term and include them in our query
    } else if( option.length === 2 ){
        let key = option[0];
        let keyValue = requestQuery[key];
        keyValue = new RegExp(keyValue, 'i');
        return getCollectionIds(keyValue, key)
            .then(ids => {
                ids.forEach(id => {
                    queries.query.push({ [key]: id.toString() });
                })
                key = option[1];
                keyValue = requestQuery[key];
                keyValue = new RegExp(keyValue, 'i');
                return getCollectionIds(keyValue, key)
            })
            .then(ids => {
                ids.forEach(id => {
                    queries.query.push({ [key]: id.toString() });
                })
                return getOtherQueryValues(requestQuery, queries);
            })
            .then(queries => {
                return findWithANDoperator(queries)
            })
    }
}

// create new item
itemRouter.post('/', jwtPassportMiddleware, User.hasAccess(User.ACCESS_PUBLIC), (req, res) => {
    const newItem = {
        barcode: req.body.barcode,
        product: req.body.product,
        serialNumber: req.body.serialNumber,
        registered: req.body.registered,
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
itemRouter.get( '/', ( req, res ) => {
    return Item 
        .find()
        .then( items => {
            console.log('Getting all items');
            return items.map( item => item.serialize() );
            // let serializedItems = [];
            // items.forEach( item => {
            //     serializedItems.push( item.serialize() );
            // })
            // return serializedItems;
        })
        .then( serializedItems => {
            return res.status( HTTP_STATUS_CODES.OK ).json( serializedItems );
        })
        .catch( err => {
            return res.status( HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR ).json( err );
        });
});

// get items using different queries as filters including: category name, product name,
// manufacturer, warehouse, model, consummable and/or on-shelf.
itemRouter.get('/advancedSearch', (req, res) => {
 
    // if user didn't provide a query, send a message
    if( !req.query ){
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
             message: 'Enter at least one value to search for.'
            })
    }
    
    return generateSearchQuery( req.query )
        .then(serializedItems => {
                return res.status(HTTP_STATUS_CODES.OK).json(serializedItems);
        })
        .catch(err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        });
})

// get items that contain a string within its properties
itemRouter.get('/search/:searchTerm', (req, res) => {
    let searchTerm = req.params.searchTerm;
    let searchBy = [];
    let query = [];

    // if the search term is a number, look among the properties
    // that contain only numbers (barcode and serialNumber)
    if( typeof searchTerm  === 'number' ){
        searchBy = ['barcode', 'serialNumber'];
        searchBy.forEach(item => {
            query.push({[item]: searchTerm});
        })
       
        return findWithORoperator( query )
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
        return getCollectionIds( searchTerm, "category" )
            .then( categoryIds => {
                categoryIds.forEach(id => {
                    query.push({ category: id.toString() });
                });
                return getCollectionIds( searchTerm, "manufacturer" )
            })
            .then( manufacturerIds => {
                manufacturerIds.forEach(id => {
                    query.push({ manufacturer: id.toString() });
                })
                // Finally, look for our searchTerm inside the Item 
                // collection using our complete query
                return findWithORoperator( query )
            })
            .then(serializedItems => {
                return res.status(HTTP_STATUS_CODES.OK).json(serializedItems);
            })
            .catch(err => {
                return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
            });
    }
});

// get lists of all the models or warehouses 
itemRouter.get('/list/:field', (req, res) => {
    let fieldName = req.params.field;

    if( fieldName === "warehouse"){
        fieldName = "location.warehouse";
    }
    
    return Item
        .distinct( fieldName ) // returns an array with all the  different values of that field 
        .then(list => {
            console.log(`Getting all ${fieldName}s`);
            return res.status(HTTP_STATUS_CODES.OK).json(list.sort());
        })
        .catch(err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        });

})

// get item's usefulLife report
itemRouter.get('/usefulLife', 
    // jwtPassportMiddleware, 
    // User.hasAccess( User.ACCESS_PUBLIC ), 
    ( req, res ) => {

    return Item
        .find()
        .then( items => {
            return items.map( item => item.serializeWithUsefulLife())
        })
        .then( serializedItems => {
            return res.status( HTTP_STATUS_CODES.OK ).json( serializedItems )
        })
        .catch( err => {
            return res.status( HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR ).json({ message: err })
        })
})

// get items by availability (onShelf: true or false)
itemRouter.get('/onShelf/:booleanValue', 
    // jwtPassportMiddleware, 
    // User.hasAccess( User.ACCESS_PUBLIC ), 
    ( req, res ) => {

    const booleanVal = req.params.booleanValue;

    return Item
        .find()
        .then( items => {       
            return items.filter( item => item.isOnShelf() === booleanVal )
        })
        .then(items => {
            return items.map(item => item.serialize())
        })
        .then( serializedItems => {
            return res.status( HTTP_STATUS_CODES.OK ).json( serializedItems )
        })
        .catch( err => {
            return res.status( HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR ).json({ message: err })
        })
})

// get items whose stock is low (its minimumRequired is > 0
// and its current value is less than that)
itemRouter.get( '/lowStock', 
    // jwtPassportMiddleware, 
    // User.hasAccess( User.ACCESS_PUBLIC ), 
    ( req, res ) => {

    return Item
        .find({ minimumRequired: { $gt: 0 }})
        .then( items => {
            console.log("ITEMS ", items.length);      
            return items.filter( item => item.isStockLow() === true )
        })
        .then(items => {
             console.log("ITEMS 2", items.length);
            return items.map(item => item.serialize())
        })
        .then( serializedItems => {
            return res.status( HTTP_STATUS_CODES.OK ).json( serializedItems );
        })
})


// update item

// delete item


module.exports = { itemRouter };
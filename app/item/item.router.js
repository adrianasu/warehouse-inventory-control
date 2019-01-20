const express = require('express');
const Joi = require('Joi');


const { HTTP_STATUS_CODES } = require('../config');
const { jwtPassportMiddleware } = require('../auth/auth.strategy');
const User = require('../user/user.model');
const { Item, ItemJoiSchema, UpdateItemJoiSchema } = require('./item.model');
const { Employee } = require('../employee/employee.model');
const { Product } = require('../product/product.model');
const { Category } = require('../category/category.model');
const { Manufacturer } = require('../manufacturer/manufacturer.model');

const itemRouter = express.Router();

const CheckInJoiSchema = Joi.object().keys({
    barcode: Joi.number(),
    date: Joi.date(),
    employeeId: Joi.number(), 
    itemId: Joi.string(),

        });

const CheckOutJoiSchema = Joi.object().keys({
    barcode: Joi.number(),
    condition: Joi.string(),
    date: Joi.date(),
    employeeId: Joi.number(),
    itemId: Joi.string(),
})

function getCollectionIdsWithOR(searchQuery, collectionName) {
    return collectionName
        .find({ $or: searchQuery })
        .then(items => {
            if (items.length > 0) {
                return items.map(item => item._id)
            }
            return items;
        })
        .catch(err => console.log(err))
}

function getCollectionIds( queries, collectionName ){
     return collectionName
        .find( queries )
        .then( items => {
            if( items.length > 0 ){
              return items.map( item => item._id )
            }
            return items;
        })
        .catch( err => console.log( err ))
}

function getAndSendItems( items ){
   
    console.log('Getting items');

    if( items.length === 0 ) {
        let err ={ code: 400 };
        err.message = 'No items found. Please, try with another values.';
        throw err;
    }
    else if ( items.length === 1 ) {
        return items[0].serializeAll();
    } else {
        return items.map( item => item.serializeAll() )
    }    
}

function findWithORoperator( query ) {

    return Item.find({
        $or: query
    })
    .then( items => {
        return getAndSendItems(items) })
}


function groupQueryByCollections( requestedQuery ){
 
    let query = { 
        product: {
            collection: Product,
            queries: []
        },
        item: {
            collection: Item,
            queries: []
        },
        onShelf: undefined
    };

    Object.keys( requestedQuery ).forEach( field => {
        let fieldValue = requestedQuery[field];
        if( field === "product" ){
            query[field].queries.push({ 
                "name": new RegExp(fieldValue, 'i')
            });
        } else if( field === "warehouse") {
            query.item.queries.push({
                "location.warehouse": new RegExp(fieldValue, 'i')
            });
        } else if( field === "onShelf" ) {
              query.onShelf = requestedQuery.onShelf;
        }else if( field === "model"){
            query.product.queries.push({
                [field]: new RegExp(fieldValue, 'i')})
        } else {
            query.product.queries.push({
                [field]: fieldValue});
        }
    });

    return query;
}


function getItemsWithoutAsyncBefore( query ){ 
    let itemQuery = query.item.queries;
    // If the only query sent was onShelf, search 
    // all items and filter them afterwards
    if(  itemQuery.length === 0 && 
        query.onShelf !== undefined ){
        return Item
            .find()
            .then(items => {
                return items.filter(item =>
                    item.isOnShelf() === query.onShelf)  
            })
            .then(items => {
                return items.map(item => item.serializeAll());
            })
       // If search query includes warehouse     
    } else {
        return Item
        .find( itemQuery[0] )
        .then(items => { 
                // Check if onShelf is also included in the query
                if (items && items.length >= 1 && query.onShelf !== undefined) {
                    return items.filter(item =>
                        item.isOnShelf() === query.onShelf)
                } 
                // If onShelf is not included, return all items found
                return items;
            })
            .then( items => {
                if( items.length === 0 ){
                    let err ={ code: 400 };
                err.message = 'No items found. Please, try with another values.';
                throw err;
                }
                return items.map(item => item.serializeAll());
            })
    }
}


// In this case,  we'll execute an async search within
// the Product collection before searching into
// the Item collection.
function doOneAsyncAndGetItems( query ){
    let searchQuery;
    let productQuery = query.product.queries;
    let itemQuery = query.item.queries;
    let onShelfQuery = query.onShelf;
    // If only one query was sent, use that object to do the search
    if( productQuery.length === 1 ){
        searchQuery = productQuery[0]
    // If more than one queries were sent, use the $and operator
    } else {
        searchQuery = { $and: productQuery };
    }
    
    // Search product
    return getCollectionIds( searchQuery, Product )
        .then( id => {
            searchQuery = {};
            let numberOfQueries = 0;
            // If any Product ids were found, and there
            // are Item original queries, add them 
            // to the Item search query
            if ( id.length > 0 && itemQuery.length === 1 ) {
                let itemQueries = itemQuery;
                itemQueries.product = id;
 
                searchQuery = { $and: itemQueries };
                numberOfQueries = 2;
            // If any Product id was found and there
            // aren't Item original queries, add
            // that query
            } else if( id.length > 0 ) {
            searchQuery = { product: id };
            numberOfQueries = 1;
        // If no Product id was found
        // and there are Item original queries, add
        // that query
        } else if( itemQuery.length === 1 ){
            searchQuery = itemQuery;
            numberOfQueries = 1;
        }

        if( numberOfQueries === 0 && 
            onShelfQuery === undefined){
            let err ={ code: 400 };
            err.message = 'No items found. Please, try with another values.';
            throw err;
        }

        return Item
            .find( searchQuery )
        })
        .then(items => {
            // If items were found and "onShelf" was sent in the query,
            // determine which ones are equal to the sent value.
            if ( items && items.length > 0 && onShelfQuery !== undefined ) {
                return items.filter(item => item.isOnShelf() === onShelfQuery )
            }
            // If onShelf is not in the query return all items found.
            return items;
        })
        .then( items => {
             if( items && items.length === 0 ){
               let err ={ code: 400 };
                err.message = 'No items found. Please, try with another values.';
                throw err;
            }
            return items.map(item => item.serializeAll())
        })
        .catch( err => {
            throw err;
        })
}

function hasProduct( query ){
    if (query.product.queries && 
        query.product.queries.length > 0) {
            return true;
    }
    return  false;
}

function getItems( requestedQuery ){
   
    let query = groupQueryByCollections( requestedQuery ); // returns an array
    
    // If our query includes product name, model, category,
    // manufacturer or consummable fields, we'll have to find
    // the product id first
    if( hasProduct(query) ){
        return doOneAsyncAndGetItems( query );
    } else {
        return getItemsWithoutAsyncBefore( query );
    } 
}


// create new item
itemRouter.post('/', 
// jwtPassportMiddleware, 
// User.hasAccess(User.ACCESS_PUBLIC), 
(req, res) => {
    const newItem = {
        barcode: req.body.barcode,
        product: req.body.product,
        serialNumber: req.body.serialNumber,
        registered: req.body.registered,
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
                let err ={ code: 400 };
                err.message = 'An item with that barcode already exists.';
                throw err;
            } 
        })
        .then(() => {  
 
        // attempt to create new item
        return Item
            .create( newItem )
        })
        .then( createdItem => {
                //success
                return res.status( HTTP_STATUS_CODES.CREATED ).json( createdItem.serialize());
        })
        .catch( err => {
            if( !err.message ){
                err.message = 'Something went wrong. Please try again';
            }
            return res.status(err.code || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        })
       
})

// get all items
itemRouter.get('/', ( req, res ) => {
    return Item
        .find()
        .then( items => {
            console.log('Getting all items');
            return items.map( item => item.serializeAll() );
        })
        .then( serializedItems => {
            return res.status( HTTP_STATUS_CODES.OK ).json( serializedItems );
        })
        .catch( err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
                message: 'Something went wrong. Please try again'
            });
        });
});

// get items using different queries as filters including: 
// category name, product name,
// manufacturer, warehouse, model, consummable and/or on-shelf.
itemRouter.get('/advanced-search', (req, res) => {
   
    // if user didn't provide a query, send a message
    if( !req.query ){
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
             message: 'Enter at least one value to search for.'
            })
    }

    return getItems( req.query )
        .then(results => {
            return res.status(HTTP_STATUS_CODES.OK).json( results );
        })
        .catch(err => {
          
            if (!err.message) {
                err.message = 'Something went wrong. Please try again'
            }
            return res.status(err.code || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({message: err.message });
        });
})

// get items that contain a string within its properties
itemRouter.get('/search/:searchTerm', (req, res) => {
    let searchTerm = req.params.searchTerm;
    let searchBy = [];
    let query = [];

    let alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let isString = false; 

    // Determine if the search term is a number or a string
    for( let x= 0; x < searchTerm.length; x+=1 ){
        if( alphabet.includes(searchTerm.charAt(x)) ) {
            isString = true;
        }
    }
    
    // if the search term is a number, look among the properties
    // that contain only numbers (barcode and serialNumber)
    if( isString === false ){
        searchBy = ['barcode', 'serialNumber'];
        searchBy.forEach(item => {
            query.push({[item]: searchTerm});
        })
       
        return findWithORoperator( query )
        .then(serializedItems => {
                return res.status(HTTP_STATUS_CODES.OK).json(serializedItems);
        })
        .catch(err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
                message: 'Something went wrong. Please try again'
            });
        });
    } else {
        // if the search term is a string, look among the item's  
        // string properties
        searchTerm = new RegExp(searchTerm, 'i');
        searchBy = ['location.warehouse'];
        searchBy.forEach(item => {
            query.push({ [item]: searchTerm });
        })
        // we have to go inside the Category, Product and Manufacturer's 
        // collections to look for the searchTerm and, if we
        // find it, we should send back the ids of those documents
        // to include them in our item query
      
        let categoryIds, manufacturerIds;
        return getCollectionIds( {name: searchTerm}, Manufacturer )
            .then( Ids => {
                if( Ids ){
                    manufacturerIds = Ids;
                }
                return getCollectionIds( {name: searchTerm}, Category )
            })
            .then( Ids => {
                if( Ids ){
                    categoryIds = Ids;
                }
                let productQuery = [
                    { name: searchTerm },
                    { model: searchTerm },
                    { category: categoryIds },
                    { manufacturer: manufacturerIds }
                ]
                return getCollectionIdsWithOR( productQuery, Product )
            })
            .then( productIds => {
                    if( productIds ){
                        query.push({ product: productIds })
                    }
                // Finally, look for our searchTerm inside the Item 
                // collection using our complete query
                return findWithORoperator( query )
            })
            .then(serializedItems => {
                return res.status(HTTP_STATUS_CODES.OK).json(serializedItems);
            })
            .catch(err => {
                if( !err.message ){
                    err.message = 'Something went wrong. Please try again';
                }
                return res.status(err.code || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json( err );
            });
    }
});

// get lists of all the warehouses 
itemRouter.get('/warehouse', (req, res) => {
    
    return Item
        .distinct( 'location.warehouse' ) // returns an array  
        .then(list => {
            console.log(`Getting all warehouses`);
            return res.status(HTTP_STATUS_CODES.OK).json(list.sort());
        })
        .catch(err => {
                return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
                    message: 'Something went wrong. Please try again'
                });
        });

})

// get item's usefulLife report
itemRouter.get('/useful-life', 
    // jwtPassportMiddleware, 
    // User.hasAccess( User.ACCESS_PUBLIC ), 
    ( req, res ) => {
        
    return Item
        .find()
        .sort('product') // sort items by product
        .then( items => {
            return items.map( item => item.serializeWithUsefulLife())
        })
        .then( serializedItems => {
            return res.status( HTTP_STATUS_CODES.OK ).json( serializedItems )
        })
        .catch( err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
                message: 'Something went wrong. Please try again'
            });
        })
})

// get items that are or are not on shelf (onShelf: true or false)
itemRouter.get('/on-shelf/:booleanValue', 
    // jwtPassportMiddleware, 
    // User.hasAccess( User.ACCESS_PUBLIC ), 
    ( req, res ) => {

    const booleanVal = req.params.booleanValue;

    return Item
        .find()
        .sort('product') // sort items by product
        .then( items => {       
            return items.filter( item => item.isOnShelf() === booleanVal )
        })
        .then(items => {
            return items.map(item => item.serializeAll())
        })
        .then( serializedItems => {
            return res.status( HTTP_STATUS_CODES.OK ).json( serializedItems )
        })
        .catch( err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
                message: 'Something went wrong. Please try again'
            });
        })
})

// get item by Id
itemRouter.get('/:itemId',
        // jwtPassportMiddleware, 
        // User.hasAccess( User.ACCESS_PUBLIC ), 
        (req, res) => {
        
    return Item
        .findOne({
            _id: req.params.itemId
        })
        .then(item => {
      
            console.log(`Getting item with id: ${req.params.itemId}`);
            if( !item ){
                let err = { code: 400 };
                err.message = 'No item found with that id.';
                throw err;
            }
            return res.status( HTTP_STATUS_CODES.OK ).json( item.serialize() );
        })
        .catch(err => {
            if( !err.message ){
                message = 'Something went wrong. Please try again';
            }
            return res.status(err.code || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        })
});

// update item by Id
itemRouter.put('/:itemId',
        // jwtPassportMiddleware, 
        // User.hasAccess( User.ACCESS_PUBLIC ), 
        (req, res) => {

        // check that id in request body matches id in request path
    if (req.params.itemId !== req.body.id) {
        const message = `Request path id ${req.params.itemId} and request body id ${req.body.id} must match`;
        console.error(message);
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
            message
        });
    }

    // we only support a subset of fields being updateable
    // if the user sent over any of them 
    // we update those values on the database
    const updateableFields = ["location"];
    // check what fields were sent in the request body to update
    const toUpdate = {};
    updateableFields.forEach(field => {
        if (field in req.body) {
            toUpdate[field] = req.body[field];
        }
    });
    // if request body doesn't contain any updateable field send error message
    if (toUpdate.length === 0) {
        const message = `Missing \`${updateableFields.join('or ')}\` in request body`;
        console.error(message);
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
            message
        });
    }

    const validation = Joi.validate(toUpdate, UpdateItemJoiSchema);
    if (validation.error) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
            message: validation.error.details[0].message
        });
    }

    return Item
        // $set operator replaces the value of a field with the specified value
        .findOneAndUpdate({
            _id: req.params.itemId
        }, {
            $set: toUpdate
        }, {
            new: true
        })
        .then(updatedItem => {
            console.log(`Updating item with id: \`${req.params.itemId}\``);
            return res.status(HTTP_STATUS_CODES.OK).json(updatedItem.serialize());
        })
        .catch(err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).jsonjson({
                message: 'Something went wrong. Please try again'
            });
        });
    });

// checkIn an item
itemRouter.put('/check-in/:itemId',
    // jwtPassportMiddleware, 
    // User.hasAccess( User.ACCESS_PUBLIC ), 
    (req, res) => {

        let checkInData = {
            employeeId: req.body.employeeId,
            itemId: req.body.itemId,
            date: Date.now(),
            barcode: req.body.barcode,
            //authorizedBy: {
            //     employee: req.user.employee._id 
            // }
            
        }
        // check that id in request body matches id in request path
        if (req.params.itemId !== req.body.itemId) {
            const message = `Request path id ${req.params.itemId} and request body id ${req.body.itemId} must match`;
            console.error(message);
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                message
            });
        }
        
        // if request body doesn't contain employee 
        // field, send error message
        const requiredFields = ["employeeId"];
        
        requiredFields.forEach(field => {
            if (!field in req.body) {
                const message = `Missing ${field} in request body`;
                console.error(message);
                return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                    message
                });
            };
        })

        const validation = Joi.validate(checkInData, CheckInJoiSchema);
        if (validation.error) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                message: validation.error.details[0].message
            });
        }
        // check if employeeId exists
        return Employee
            .findOne({ employeeId: req.body.employeeId })
            .then(employee => {
                if (employee === null) {
                    let err = { code: 400 };
                    err.message = `Employee with id ${req.body.employeeId} doesn't exist`;
                    console.error(err.message);
                    throw err;
                }
                // add employee mongo id to check-out data
                checkInData.employee = employee.id;
                // check if item was checked out
                return Item
                    .findById(req.body.itemId)
            })
            .then(item => {
                if( item === null ){
                    let err = { code: 400 };
                    err.message = `Item with id ${req.params.itemId} doesn't exist.`;
                    throw err;
                }
                if( !item.isCheckedOut ){
                    let err = { code: 400 };
                    err.message = `Item with id ${req.params.itemId} was already checked in.`;
                    throw err;
                }
                // if item was checked-out before then do check-in
                item.checkedIn.unshift(checkInData);
                return item.save(); // save() returns a promise
            })
            .then(item => {
                // To send the item populated we get it from the db
                return Item
                    .findById(req.body.itemId)
            })
            .then( item => {
                console.log(`Checking in item with id: ${req.params.itemId}`);
                return res.status(HTTP_STATUS_CODES.OK).json( item.serializeAll() );
            })
            .catch(err => {                
                if( !err.message ){
                    err.message = 'Something went wrong. Please try again'
                }
                return res.status( err.code || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR ).json( err );
            });
    });

// checkOut an item. It will add a check out transaction at the
// beginning of the item.checkedOut array.
itemRouter.put('/check-out/:itemId',
    // jwtPassportMiddleware, 
    // User.hasAccess( User.ACCESS_BASIC ), 
    (req, res) => {
        
        let checkOutData = {
            itemId: req.body.itemId,
            employeeId: req.body.employeeId,
            date: Date.now(),
            barcode: req.body.barcode,
            condition: req.body.condition,
            //authorizedBy: req.user.employee._id,
        }
        // check that id in request body matches id in request path
        if (req.params.itemId !== req.body.itemId) {
            const message = `Request path id ${req.params.itemId} and request body id ${req.body.itemId} must match`;
            console.error(message);
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                message
            });
        }

        // if request body doesn't contain  employeeId
        // field, send error message
        const requiredFields = ["employeeId"];
    
        requiredFields.forEach(field => {
            if (!field in req.body) {
                const message = `Missing ${field} in request body`;
                console.error(message);
                return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                    message
                });
            };
        })

        const validation = Joi.validate(checkOutData, CheckOutJoiSchema);
        if (validation.error) {
           
            console.error(validation.error.details[0].message)
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                message: validation.error.details[0].message
            });
        }
        // check if employeeId exists
        return Employee
            .findOne({ employeeId: req.body.employeeId })
            .then( employee => {
                if( employee === null ){
                    let err = { code: 400 };
                    err.message = `Employee with id ${req.body.employeeId} doesn't exist`;
                       console.error(err.message);
                    throw err;
                }
                // add employee mongo id to check-out data
                checkOutData.employee = employee.id;
                // check if item is on shelf
                return Item
                    .findById( req.body.itemId )    
            })
            .then( item => {
      
                if( item === null ){
                    let err = { code: 400 };
                    err.message = `Item with id ${req.params.itemId} doesn't exist.`;
                     console.error(err.message);
                    throw err;
                }
                if( item.isCheckedOut ){
                    let err = { code: 400 };
                    err.message = `Item with id ${req.params.itemId} was already checked out.`;
                     console.error(err.message);
                    throw err;
                }

                // if item is available then do check-out
                item.checkedOut.unshift(checkOutData);
                return item.save();
            })
            .then(item => {
                // To send the item populated we get it from the db
               return Item
                   .findById(req.body.itemId)
            })
            .then( item => {
                console.log(`Checking out item with id: ${req.params.itemId}`);
                return res.status(HTTP_STATUS_CODES.OK).json( item.serializeAll() );
            
            })
            .catch(err => {
                if (!err.message) {
                    err.message = 'Something went wrong. Please try again'
                }
                return res.status(err.code || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json( err );
            });
    });


// delete item by Id
itemRouter.delete('/:itemId',
    // jwtPassportMiddleware, 
    // User.hasAccess( User.ACCESS_PUBLIC ), 
    (req, res) => {
        return Item
            .findOneAndDelete({
                _id: req.params.itemId
            })
            .then(item => {
                console.log(`Deleting item with id: ${req.params.itemId}`);
                return res.status(HTTP_STATUS_CODES.OK).json({
                    deleted: `${ req.params.itemId }`,
                    OK: "true"
                });
            })
            .catch(err => {
                return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
                    message: 'Something went wrong. Please try again'
                });
            })
    });


module.exports = { itemRouter };
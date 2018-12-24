const express = require('express');
const Joi = require('Joi');

const { HTTP_STATUS_CODES } = require('../config');
const { jwtPassportMiddleware } = require('../auth/auth.strategy');
const User = require('../user/user.model');
const { Item, ItemJoiSchema, UpdateItemJoiSchema } = require('./item.model');
const { Product, Category, Manufacturer } = require('../product/product.model');

const itemRouter = express.Router();

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

function transformObjectIntoArray( query ){
    let queryArray = [];
    Object.keys( query ).forEach( key => {
        if (query[key].queries && 
            query[key].queries.length > 0) {
            queryArray.push({[key]: query[key]});
        }
    })
    return queryArray;
}

function groupQueryByCollections( requestedQuery ){
    let names = ["product", "category", "manufacturer"];
    let query = { 
        manufacturer: { 
                collection: Manufacturer, 
                queries: [] 
        },
        category: {
            collection: Category,
            queries: []
        },
        product: {
            collection: Product,
            queries: []
        },
        item: {
            collection: Item,
            queries: []
        },
        onShelf: "NA"
    };

    Object.keys( requestedQuery ).forEach( field => {
        let fieldValue = requestedQuery[field];
        if( names.includes(field) ){
            query[field].queries.push({ 
                "name": new RegExp(fieldValue, 'i')
            });
        } else if( field === "warehouse") {
            query.item.queries.push({
                "location.warehouse": new RegExp(fieldValue, 'i')
            });
        } else if( field === "onShelf" ) {
              query.onShelf = requestedQuery.onShelf;
            }else if( field === "consummable"){
                query.product.queries.push({ [field]: fieldValue });
        } else {
            query.product.queries.push({
                [field]: new RegExp(fieldValue, 'i')
            });
        }
    })

    // transform object into array and eliminate properties with empty values
    let queryArray = transformObjectIntoArray( query );
    if( query.onShelf !== "NA"){
        queryArray.push({ onShelf: query.onShelf });
    }
    console.log("ARRAY ", queryArray);

    return queryArray;
}


function getItemsWithoutAsyncBefore( query ){ 
   
    // If the only query sent was onShelf, search all items
    // and filter them afterwards
    if( query.length === 1 && 
        query[0].onShelf ){
        return Item
            .find()
            .then(items => {
                return items.filter(item =>
                    item.isOnShelf() === query[0].onShelf)  
            })
            .then(items => {
                return items.map(item => item.serialize());
            })
       // Search query includes warehouse     
    } else {
        let searchQuery = query[0].queries[0];
        return Item
        .find( searchQuery )
        .then(items => { 
                // Check if onShelf is also included in the query
                if (items && items.length >= 1 && query[1] && query[1].onShelf) {
                    return items.filter(item =>
                        item.isOnShelf() === query[1].onShelf)
                } 
                return items;
            })
            .then( items => {
             if( items.length === 0 ){
                    return {message: 'No items found. Please try again with another values.'}
                }
                return items.map(item => item.serialize());
            })
    }
}


function doOneAsyncAndGetItems( queryGroup ){
    // The only option that requires one async search
    // before doing the final search is within the Product
    // collection
  let collectionName, productQueries, onShelfQuery;
  let itemQueries = [];
    queryGroup.forEach( query => {
        Object.keys( query ).forEach( key => {
            if(key === "product"){
                collectionName = query[key].collection;
                productQueries = query[key].queries[0];
            } else if( key === "item" ){
                itemQueries.push(query[key].queries[0]);
            } else if( key === "onShelf"){
                onShelfQuery = query[key];
            }
        })
    }) 

    return getCollectionIds( productQueries, collectionName )
    .then( ids => {
        let searchQuery = itemQueries[0];
        // If any product ids were found, add them to the Item query
        if( ids.length > 0 ){
            itemQueries.push({ product: ids });
            searchQuery = { $and: itemQueries };
        }
        return Item
        .find( searchQuery )
    })
    .then(items => {
        if (items.length > 0 && onShelfQuery !== undefined ) {
            return items.filter(item => item.isOnShelf() === onShelfQuery )
        }
        return items;
    })
    .then( items => {
        if( items.length > 0){
            return items.map(item => item.serialize())
        }
        return { message: 'No items found. Please, try again with another values.' }
    })
}

function doTwoAsyncAndGetItems(queryGroup){
// In this case, we have two different options. 
// In both options we'll execute an async search within
// the Product collection and the other async search
// could be either into the Manufacturer or Category collection.

    let otherCollectionName, otherQueries, productCollectionName, productQueries, onShelfQuery, manufacturerCollectionName, manufacturerQueries, categoryCollectionName, categoryQueries;
    let itemQueries = [];
    let field1 = "";
    let field2 = "";
    let field;

    queryGroup.forEach( query => {
        Object.keys( query ).forEach( key => {
            if( key === "item" ){
                itemQueries.push(query[key].queries[0]);
            } else if( key === "onShelf"){
                onShelfQuery = query[key];
            } else if(key === "product") {
                productCollectionName = query[key].collection;
                productQueries = query[key].queries[0];
            } else if( key === "manufacturer" ){
                manufacturerCollectionName = query[key].collection;
                manufacturerQueries = query[key].queries[0];
                field1 = "manufacturer";
            } else if (key === "category") {
                categoryCollectionName = query[key].collection;
                categoryQueries = query[key].queries[0];
                field2 = "category"
            }
        })
    }) 

 
    if( field1 ){
        field = field1;
        otherQueries = manufacturerQueries;
        otherCollectionName = manufacturerCollectionName;
    } else {
        field = field2;
        otherQueries = categoryQueries;
        otherCollectionName = categoryCollectionName;
    }


    return getCollectionIds(otherQueries, otherCollectionName)
        .then(ids => {
            let searchQuery = [productQueries];
             console.log("searchquery ", searchQuery);
            // If any ids were found, add them to the Product query
            if (ids.length > 0) {
                searchQuery.push({
                    [field]: ids
                });
                searchQuery = {
                    $and: searchQuery
                };
            }
            console.log("searchquery ", searchQuery);
    
    return getCollectionIds( searchQuery, productCollectionName )
        })
    .then( ids => {
        let searchQuery = itemQueries[0];
        // If any product ids were found, add them to the Item query
        if( ids.length > 0 ){
            itemQueries.push({ product: ids });
            searchQuery = { $and: itemQueries };
        }
        return Item
        .find( searchQuery )
    })
    .then(items => {
        if (items.length > 0 && onShelfQuery !== undefined ) {
            return items.filter(item => item.isOnShelf() === onShelfQuery )
        }
        return items;
    })
    .then( items => {
        if( items.length > 0){
            return items.map(item => item.serialize())
        }
        return { message: 'No items found. Please, try again with another values.' }
    })

}

function doThreeAsyncAndGetItems(queryGroup){
// In this case, we'll be doing async searches in all of the
// collections. First, Manufacturer or Category, then Product and 
// last Item, adding the ids found into the parent's query.

    let otherCollectionName, otherQueries, productCollectionName, productQueries, onShelfQuery, manufacturerCollectionName, manufacturerQueries, categoryCollectionName, categoryQueries;
    let itemQueries = [];
    let field1 = "";
    let field2 = "";
    let field;

    queryGroup.forEach( query => {
        Object.keys( query ).forEach( key => {
            if( key === "item" ){
                itemQueries.push(query[key].queries[0]);
            } else if( key === "onShelf"){
                onShelfQuery = query[key];
            } else if(key === "product") {
                productCollectionName = query[key].collection;
                productQueries = query[key].queries[0];
            } else if( key === "manufacturer" ){
                manufacturerCollectionName = query[key].collection;
                manufacturerQueries = query[key].queries[0];
                field1 = "manufacturer";
            } else if (key === "category") {
                categoryCollectionName = query[key].collection;
                categoryQueries = query[key].queries[0];
                field2 = "category"
            }
        })
    }) 

    let productQuery = [productQueries];
      return getCollectionIds(manufacturerQueries, manufacturerCollectionName)
        .then(ids => {
            // If any ids were found, add them to the Product query
            if (ids.length > 0) {
                productQuery.push({
                    [field1]: ids
                });
            }

    return getCollectionIds(categoryQueries, categoryCollectionName)
        })
        .then(ids => {
          
            // If any ids were found, add them to the Product query
            if (ids.length > 0) {
                productQuery.push({
                    [field2]: ids
                });
            }
                    productQuery = {
                        $and: productQuery
                    };
    
    return getCollectionIds( productQuery, productCollectionName )
        })
    .then( ids => {
        let searchQuery = itemQueries[0];
        // If any product ids were found, add them to the Item query
        if( ids.length > 0 ){
            itemQueries.push({ product: ids });
            searchQuery = { $and: itemQueries };
        }
        return Item
        .find( searchQuery )
    })
    .then(items => {
        if (items.length > 0 && onShelfQuery !== undefined ) {
            return items.filter(item => item.isOnShelf() === onShelfQuery )
        }
        return items;
    })
    .then( items => {
        if( items.length > 0){
            return items.map(item => item.serialize())
        }
        return { message: 'No items found. Please, try again with another values.' }
    })

}


function calculateNumberOfAsyncFunc( queryGroup ){
    let numberOfAsync = 0;
    let collections = [];
    queryGroup.forEach( query => {
        Object.keys(query).forEach( key =>{
            if( key !== "onShelf"){
                numberOfAsync += 1;
                collections.push( key );
            }
        })
    })
  
    // Category and Manufacturer is nested in Product
    // so if we have to query one of them we'll have to 
    // query in the Product collection too.
   
    if( (collections.includes("category") ||
        collections.includes("manufacturer")) 
        && !(collections.includes("product")) ){
            numberOfAsync += 1;
        }
    
    return numberOfAsync;
}

function getItems( requestedQuery ){
   
    // Define what async functions will be executed to
    // since we have nested fields in
    // our original query ( Manufacturer, Category and Product)
    let queryGroup = groupQueryByCollections( requestedQuery ); // returns an array
    let numberofAsyncFunc = calculateNumberOfAsyncFunc( queryGroup );

    if( numberofAsyncFunc === 1 || (
        numberofAsyncFunc === 0 && 
        queryGroup[0].onShelf )){
        return getItemsWithoutAsyncBefore( queryGroup );
    } else if( numberofAsyncFunc === 2 ){
        return doOneAsyncAndGetItems( queryGroup );
    } else if( numberofAsyncFunc === 3 ){
        return doTwoAsyncAndGetItems(queryGroup);
    } else if (numberofAsyncFunc === 4 ) {
        return doThreeAsyncAndGetItems(queryGroup);
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
        })
        .then( serializedItems => {
            return res.status( HTTP_STATUS_CODES.OK ).json( serializedItems );
        })
        .catch( err => {
            return res.status( HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR ).json( err );
        });
});

// get items using different queries as filters including: 
// category name, product name,
// manufacturer, warehouse, model, consummable and/or on-shelf.
itemRouter.get('/advancedSearch', (req, res) => {
   
    // if user didn't provide a query, send a message
    if( !req.query ){
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
             message: 'Enter at least one value to search for.'
            })
    }
    
  //getItems(req.query)
    return getItems( req.query )
        .then(serializedItems => {
            console.log("HERE 10", serializedItems.length);
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
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
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
                return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
            });
    }
});

// get lists of all the warehouses 
itemRouter.get('/warehouses', (req, res) => {
    
    return Item
        .distinct( warehouses ) // returns an array with all the  different values of that field 
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
            return res.status( HTTP_STATUS_CODES.OK ).json( item.serialize() );
        })
        .catch(err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json( err );
        })
});

// update item by Id
itemRouter.put('/:itemId',
        // jwtPassportMiddleware, 
        // User.hasAccess( User.ACCESS_PUBLIC ), 
        (req, res) => {

        // check that id in request body matches id in request path
    if (req.params.itemId !== req.body.itemId) {
        const message = `Request path id ${req.params.itemId} and request body id ${req.body.itemId} must match`;
        console.error(message);
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
            err: message
        });
    }

    // we only support a subset of fields being updateable
    // if the user sent over any of them 
    // we update those values on the database
    const updateableFields = ["location", "checkedOut", "checkedIn"];
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
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
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
                return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
            })
    });

module.exports = { itemRouter };
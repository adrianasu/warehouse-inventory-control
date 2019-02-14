const express = require('express');
const Joi = require('joi');
const { HTTP_STATUS_CODES } = require('../config');
const { jwtPassportMiddleware } = require('../auth/auth.strategy');
const User = require('../user/user.model');
const { Product, ProductJoiSchema, UpdateProductJoiSchema } = require('../product/product.model');
const { Item } = require('../item/item.model');

const productRouter = express.Router();

function getItems(product, items){
    return items && items.length > 0 ?
        items.filter( item => item.product.name === product.name)
        : [];
}

// Return all items that are the same product
function addTotalItems( product, items ){
    let thisProductItems = getItems(product, items);
    let ids = thisProductItems.map(item => item.id);
    product.items = ids;
    return product;
}

// get all products
productRouter.get('/', (req, res) => {
    let products;
    return Product
        .find( {}, null, { sort: { name: 1 }}) // sort alphabetically by name
        .then( _products => {
            products = _products.map( prod => prod.serialize() );
            return Item
                .find()
        })
        .then(items => {
            return products.map( prod => addTotalItems(prod, items) )
        })
        .then( products => {
            return res.status(HTTP_STATUS_CODES.OK).json(products);
        })
        .catch(err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        });
});

// create a product
productRouter.post('/', 
    jwtPassportMiddleware, 
    User.hasAccess(User.ACCESS_PUBLIC), 
    (req, res ) => {
    // we can access req,body payload bc we defined express.json
    // middleware in server.js
    const newProduct = {
        name: req.body.name,
        manufacturer: req.body.manufacturer,
        model: req.body.model,
        consummable: req.body.consummable,
        minimumRequired: {
            quantity: req.body.quantity,
            units: req.body.units
        },
        category: req.body.category,
    };
    // validate newProduct data using Joi schema
    const validation = Joi.validate( newProduct, ProductJoiSchema );
    if( validation.error ){
        return res.status( HTTP_STATUS_CODES.BAD_REQUEST ).json({
            message: validation.error.details[0].message
        });
    }

    // check if product name already exists
    return Product
        .findOne({
            name: req.body.name
        })
        .then( product => {
            if( product ){
                let err = { code: 400 };
                err.message = `A product ${req.body.name} already exists.`;
                throw err;
            }
        })
        .then(() => {
            // attempt to create a new Product
            return Product
                .create( newProduct )
        })
        .then( createdProduct => {
            console.log(`Creating new product`);
            return res.status(HTTP_STATUS_CODES.CREATED).json({
                        created: createdProduct.serialize() });
        })
        .catch(err => {
            if( !err.message ){
                err.message = 'Something went wrong. Please, try again.';
            }
            return res.status(err.code || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        });
        
})

// get products with low stock (its minimumRequired is > 0
// and its current quantity is less than that)
productRouter.get('/low-stock',
    jwtPassportMiddleware, 
    User.hasAccess( User.ACCESS_PUBLIC ), 
    (req, res) => {
        let lowStock ={};
        // find all consummable products required
        // to have more than zero in stock
        return Product
            .find({ $and: [
                { consummable: true }, 
                { 'minimumRequired.quantity': { $gt: 0 }}
            ]})
            .then(products => {
                 if( products.length === 0 ){
                    let err = { code: 400 };
                    err.message = `No consummable products with a minimum required quantity found.`;
                    throw err;
                }
                // add products found in lowStock object. Define
                // inStock and shortfall properties to fill later.
                products.forEach( product =>{
                    let id = product._id;
                    lowStock[id] = {
                        product: product,
                        minimumRequired: product.minimumRequired.quantity,
                        inStock: [],
                        shortfall: 0
                    } 
                })

                return products.map(product => product._id)
            })
            .then( productIds => {
                // Search items with product ids found above
                // that are still on shelf.
                return Item
                .find({ $and: [{
                    "product": { $in: productIds }
                },{
                    "isCheckedOut": false
                }
                ]})
            })
            .then(items => {
                // fill inStock array that belongs to a product
                // with the items found on shelf.
                items.forEach( item => {
                    let id = item.product._id;
                    lowStock[id].inStock.push(item.serializeAll());

                })
                return lowStock;
            })
            .then(lowStock=> {
                // put all our products
                let toArray =[];
                Object.keys(lowStock).forEach(productId => {
                    lowStock[productId].shortfall = lowStock[productId].inStock.length - lowStock[productId].minimumRequired;
                    
                    toArray.push(lowStock[productId]);
                })
                return toArray;
            })
            .then( toArray => {     
                return res.status(HTTP_STATUS_CODES.OK).json(toArray);
            })

            .catch(err => {
                if (!err.message) {
                    err.message = 'Something went wrong. Please, try again.';
                }
                return res.status(err.code || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
            });
})

// get product by Id
productRouter.get('/:productId',
        (req, res) => {
        
    return Product
        .findOne({
            _id: req.params.productId
        })
        .then(product => {
            console.log(`Getting item with id: ${req.params.productId}`);
            if( !product ){
                let err = { code: 400 };
                err.message = 'No product found with that id.';
                throw err;
            }
             
          return res.status( HTTP_STATUS_CODES.OK ).json( product.serialize() );
        })
        .catch(err => {
            if (!err.message) {
                err.message = 'Something went wrong. Please, try again.';
            }
            return res.status(err.code || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        });
});



// update product by Id
productRouter.put('/:productId', 
    jwtPassportMiddleware,
    User.hasAccess(User.ACCESS_PUBLIC),
    (req, res) => {
        // check that id in request body matches id in request path
        if (req.params.productId !== req.body.id) {
            const message = `Request path id ${req.params.productId} and request body id ${req.body.id} must match`;
            console.error(message);
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                message
            });
        }


        const minimumReq = ["minimumRequiredQuantity", "minimumRequiredUnits"];
        const updateableFields = ["name", "manufacturer", "model", "consummable", "minimumRequiredQuantity", "minimumRequiredUnits", "category"];
        // check what fields were sent in the request body to update
        const toUpdate = {};
        
        updateableFields.forEach(field => {
            if (field in req.body && !minimumReq.includes(field)) {
                toUpdate[field] = req.body[field];
            } else if (field in req.body && minimumReq.includes(field)){
                // get field name ( remove minimumRequired prefix)
                let myField = field.slice(field.indexOf('d')+1).toLowerCase();
                toUpdate.minimumRequired = {
                    [myField]: req.body[field]
                }
            }
        });
        // if request body doesn't contain any updateable field send error message
        if (Object.keys(toUpdate).length === 0) {
            const message = `Missing \`${updateableFields.join('or ')}\` in request body`;
            console.error(message);
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                message
            });
        }

        const validation = Joi.validate(toUpdate, UpdateProductJoiSchema);
        if (validation.error) {
            console.log(validation.error);
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                message: validation.error.details[0].message
            });
        }
        return Product
            // $set operator replaces the value of a field with the specified value
            .findOneAndUpdate({
                _id: req.params.productId
            }, {
                $set: toUpdate
            }, {
                new: true
            })
            .then(updatedProduct => {
                console.log(`Updating product with id: \`${req.params.productId}\``);
                return res.status(HTTP_STATUS_CODES.OK).json({updated: updatedProduct.serialize()});
            })
            .catch(err => {
                return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
            });
    })

// delete product
productRouter.delete('/:productId',
    jwtPassportMiddleware,
    User.hasAccess(User.ACCESS_ADMIN),
    (req, res) => {

        // Items that contain that product
        // will be deleted too.
        return Item
            .deleteMany({
                product: req.params.productId
        })
        .then( items => {
            return Product
                .findOneAndDelete({
                    _id: req.params.productId
                })
        })
        .then(deletedProduct => {
            return res.status(HTTP_STATUS_CODES.OK).json({
                deleted: `${req.params.productId}`,
                OK: "true"
            });
        })
        .catch(err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        });

    });



module.exports = { productRouter };


const express = require('express');
const Joi = require('joi');
const { HTTP_STATUS_CODES } = require('../config');
const { jwtPassportMiddleware } = require('../auth/auth.strategy');
const User = require('../user/user.model');
const { Product, ProductJoiSchema } = require('../product/product.model');
const { Item } = require('../item/item.model');

const productRouter = express.Router();


// get all products
productRouter.get('/', (req, res) => {
    return Product
        .find( {}, null, { sort: { name: 1 }}) // sort alphabetically by name
        .then( products => {
            console.log('Getting all  products');
            return products.map( prod => prod.serialize() );
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
    User.hasAccess(User.ACCESS_ADMIN), 
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

    // check if product already exists
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
            return res.status(HTTP_STATUS_CODES.CREATED).json(createdProduct.serialize());
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
    // jwtPassportMiddleware, 
    // User.hasAccess( User.ACCESS_PUBLIC ), 
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
                // inStock and difference properties to fill later.
                products.forEach( product =>{
                    let id = product._id;
                    lowStock[id] = {
                        product: product,
                        minimumRequired: product.minimumRequired.quantity,
                        inStock: [],
                        difference: 0
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
                    lowStock[productId].difference = lowStock[productId].inStock.length - lowStock[productId].minimumRequired;
                    
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
        // jwtPassportMiddleware, 
        // User.hasAccess( User.ACCESS_PUBLIC ), 
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
//jwtPassportMiddleware,
  //  User.hasAccess(User.ACCESS_ADMIN),
    (req, res) => {
        //console.log("BODY ", req.body);
        // check that id in request body matches id in request path
        if (req.params.productId !== req.body.id) {
            const message = `Request path id ${req.params.productId} and request body id ${req.body.id} must match`;
            console.error(message);
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                message
            });
        }


        const minimumReq = ["quantity", "units"];
        const updateableFields = ["name", "manufacturer", "model", "consummable", "quantity", "units", "category"];
        // check what fields were sent in the request body to update
        const toUpdate = {};
        
        updateableFields.forEach(field => {
            if (field in req.body && !minimumReq.includes(field)) {
                toUpdate[field] = req.body[field];
            } else if (field in req.body && minimumReq.includes(field)){
                toUpdate.minimumRequired = {
                    [field]: req.body[field]
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

        const validation = Joi.validate(toUpdate, ProductJoiSchema);
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
    //jwtPassportMiddleware,
    //User.hasAccess(User.ACCESS_ADMIN),
    (req, res) => {

        console.log(`Deleting Product with id: \`${req.params.productId}\` and items that contain that product.`);
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


const express = require('express');
const Joi = require('joi');
const { HTTP_STATUS_CODES } = require('../config');
const { jwtPassportMiddleware } = require('../auth/auth.strategy');
const User = require('../user/user.model');
const { Product, ProductJoiSchema } = require('../product/product.model');

const productRouter = express.Router();


// get all products
productRouter.get('/', (req, res) => {
    return Product
        .find( {}, null, { sort: { name: 1 }}) // sort alphabetically by name
        .then( products => {
            console.log('Getting all  products');
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
        minimumRequired: req.body.minimumRequired,
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
                return res.status( HTTP_STATUS_CODES.BAD_REQUEST ).json({
                    message: `A product ${req.body.name} already exists.`
                });
            }
            // attempt to create a new Product
            return Product
                .create( newProduct )
                .then( createdProduct => {
                    console.log(`Creating new product`);
                    return res.status(HTTP_STATUS_CODES.CREATED).json(createdProduct);
                })
                .catch(err => {
                    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
                });
        })
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
                return res.status( HTTP_STATUS_CODES.BAD_REQUEST ).json({
                    message: 'No product found with that id.'
                });
            }
            return res.status( HTTP_STATUS_CODES.OK ).json( product.serialize() );
        })
        .catch(err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json( err );
        })
});



// update product by Id
productRouter.put('/:productId', jwtPassportMiddleware,
    User.hasAccess(User.ACCESS_ADMIN),
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

    
        const updateableFields = ["name", "manufacturer", "model", "consummable", "minimumRequired", "category"];
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
                return res.status(HTTP_STATUS_CODES.OK).json(updatedProduct);
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
        return Product
            .findOneAndDelete({
                _id: req.params.productId
            })
            .then(deletedProduct => {
                console.log(`Deleting Product with id: \`${req.params.productId}\``);
                return res.status(HTTP_STATUS_CODES.OK).json({
                    deleted: `${req.params.productId}`,
                    OK: "true"
                });
            })
            .catch(err => {
                return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).res(err);
            });

    });

module.exports = { productRouter };


const express = require('express');
const Joi = require('joi');
const { HTTP_STATUS_CODES } = require('../config');
const { jwtPassportMiddleware } = require('../auth/auth.strategy');
const User = require('../user/user.model');
const { Product } = require('../item/item.model');

const productRouter = express.Router();

// schema to validate product content
const ProductJoiSchema = Joi.object().keys({
    _id: Joi.string(),
    __v: Joi.number(),
    name: Joi.string(),
    addedBy: Joi.object().keys({
        _id: Joi.string(),
        firstName: Joi.string(),
        lastName: Joi.string(),
        username: Joi.string(),
        accessLevel: Joi.number()
    })
});

// get all categories
ProductRouter.get('/', (req, res) => {
    return Product
        .find( {}, null, { sort: { name: 1 }}) // sort alphabetically by name
        .then(categories => {
            console.log('Getting all categories');
            return res.status(HTTP_STATUS_CODES.OK).json(categories);
        })
        .catch(err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        });
});

// create Product
ProductRouter.post('/', 
    jwtPassportMiddleware, 
    User.hasAccess(User.ACCESS_ADMIN), 
    (req, res ) => {
    // we can access req,body payload bc we defined express.json
    // middleware in server.js
    const newProduct = {
        name: req.body.name,
        addedBy: req.body.addedBy
    };

    // validate newProduct data using Joi schema
    const validation = Joi.validate( newProduct, ProductJoiSchema );
    if( validation.error ){
        return res.status( HTTP_STATUS_CODES.BAD_REQUEST ).json({
            message: validation.error.details[0].message
        });
    }

    // check if Product already exists
    return Product
        .findOne({
            name: req.body.name
        })
        .then( Product => {
            if( Product ){
                return res.status( HTTP_STATUS_CODES.BAD_REQUEST ).json({
                    message: `A Product ${req.body.name} already exists.`
                });
            }
            // attempt to create a new Product
            return Product
                .create( newProduct )
                .then( createdProduct => {
                    console.log(`Creating new Product`);
                    return res.status(HTTP_STATUS_CODES.CREATED).json(createdProduct);
                })
                .catch(err => {
                    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
                });
        })
})


// get products whose stock is low (its minimumRequired is > 0
// and its current value is less than that)
productRouter.get('/lowStock',
    // jwtPassportMiddleware, 
    // User.hasAccess( User.ACCESS_PUBLIC ), 
    (req, res) => {

        return Product
            .find({
                minimumRequired: {
                    $gt: 0
                }
            })
            .then(items => {
                console.log("ITEMS ", items.length);
                return items.filter(item => item.isStockLow() === true)
            })
            .then(items => {
                console.log("ITEMS 2", items.length);
                return items.map(item => item.serialize())
            })
            .then(serializedItems => {
                return res.status(HTTP_STATUS_CODES.OK).json(serializedItems);
            })
    })





// update Product by Id
ProductRouter.put('/:ProductId', jwtPassportMiddleware,
    User.hasAccess(User.ACCESS_ADMIN),
    (req, res) => {
        // check that id in request body matches id in request path
        if (req.params.ProductId !== req.body.id) {
            const message = `Request path id ${req.params.ProductId} and request body id ${req.body.ProductId} must match`;
            console.error(message);
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                message
            });
        }

    
        const updateableFields = ["name", "addedBy"];
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

        Product
            // $set operator replaces the value of a field with the specified value
            .findOneAndUpdate({
                _id: req.params.ProductId
            }, {
                $set: toUpdate
            }, {
                new: true
            })
            .then(updatedProduct => {
                console.log(`Updating Product with id: \`${req.params.ProductId}\``);
                return res.status(HTTP_STATUS_CODES.OK).json(updatedProduct);
            })
            .catch(err => {
                return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
            });
    })

// delete Product
ProductRouter.delete('/:ProductId',
    //jwtPassportMiddleware,
    //User.hasAccess(User.ACCESS_ADMIN),
    (req, res) => {
        return Product
            .findOneAndDelete({
                _id: req.params.ProductId
            })
            .then(deletedProduct => {
                console.log(`Deleting Product with id: \`${req.params.ProductId}\``);
                return res.status(HTTP_STATUS_CODES.OK).json({
                    deleted: `${req.params.ProductId}`,
                    OK: "true"
                });
            })
            .catch(err => {
                return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).res(err);
            });

    });

module.exports = { ProductRouter };


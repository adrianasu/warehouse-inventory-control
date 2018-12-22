const express = require('express');
const Joi = require('joi');
const { HTTP_STATUS_CODES } = require('../config');
const { jwtPassportMiddleware } = require('../auth/auth.strategy');
const User = require('../user/user.model');
const { Category } = require('../item/item.model');

const categoryRouter = express.Router();

// schema to validate category content
const CategoryJoiSchema = Joi.object().keys({
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
categoryRouter.get('/', (req, res) => {
    return Category
        .find()
        .then(categories => {
            console.log('Getting all categories');
            return res.status(HTTP_STATUS_CODES.OK).json(categories);
        })
        .catch(err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        });
});

// create category
categoryRouter.post('/', 
    jwtPassportMiddleware, 
    User.hasAccess(User.ACCESS_ADMIN), 
    (req, res ) => {
    // we can access req,body payload bc we defined express.json
    // middleware in server.js
    const newCategory = {
        name: req.body.name,
        addedBy: req.body.addedBy
    };

    // validate newCategory data using Joi schema
    const validation = Joi.validate( newCategory, CategoryJoiSchema );
    if( validation.error ){
        return res.status( HTTP_STATUS_CODES.BAD_REQUEST ).json({
            message: validation.error.details[0].message
        });
    }

    // check if category already exists
    return Category
        .findOne({
            name: req.body.name
        })
        .then( category => {
            if( category ){
                return res.status( HTTP_STATUS_CODES.BAD_REQUEST ).json({
                    message: `A category ${req.body.name} already exists.`
                });
            }
            // attempt to create a new category
            return Category
                .create( newCategory )
                .then( createdCategory => {
                    console.log(`Creating new category`);
                    return res.status(HTTP_STATUS_CODES.CREATED).json(createdCategory);
                })
                .catch(err => {
                    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
                });
        })
})

// update category by Id
categoryRouter.put('/:categoryId', jwtPassportMiddleware,
    User.hasAccess(User.ACCESS_ADMIN),
    (req, res) => {
        // check that id in request body matches id in request path
        if (req.params.categoryId !== req.body.id) {
            const message = `Request path id ${req.params.categoryId} and request body id ${req.body.categoryId} must match`;
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

        const validation = Joi.validate(toUpdate, CategoryJoiSchema);
        if (validation.error) {
            console.log(validation.error);
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                message: validation.error.details[0].message
            });
        }

        Category
            // $set operator replaces the value of a field with the specified value
            .findOneAndUpdate({
                _id: req.params.categoryId
            }, {
                $set: toUpdate
            }, {
                new: true
            })
            .then(updatedCategory => {
                console.log(`Updating category with id: \`${req.params.categoryId}\``);
                return res.status(HTTP_STATUS_CODES.OK).json(updatedCategory);
            })
            .catch(err => {
                return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
            });
    })

// delete category
categoryRouter.delete('/:categoryId',
    //jwtPassportMiddleware,
    //User.hasAccess(User.ACCESS_ADMIN),
    (req, res) => {
        return Category
            .findOneAndDelete({
                _id: req.params.categoryId
            })
            .then(deletedCategory => {
                console.log(`Deleting category with id: \`${req.params.categoryId}\``);
                return res.status(HTTP_STATUS_CODES.OK).json({
                    deleted: `${req.params.categoryId}`,
                    OK: "true"
                });
            })
            .catch(err => {
                return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).res(err);
            });

    });

module.exports = { categoryRouter };


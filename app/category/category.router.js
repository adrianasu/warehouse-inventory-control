const express = require('express');
const Joi = require('joi');
const { HTTP_STATUS_CODES } = require('../config');
const { jwtPassportMiddleware } = require('../auth/auth.strategy');
const User = require('../user/user.model');
const { Category } = require('../category/category.model');
const { Item } = require('../item/item.model');
const { Product } = require('../product/product.model');
 
const categoryRouter = express.Router();

// schema to validate category content
const CategoryJoiSchema = Joi.object().keys({
    _id: Joi.string(),
    __v: Joi.number(),
    name: Joi.string()
});

// get all categories
categoryRouter.get('/', (req, res) => {
    return Category
        .find( {}, null, { sort: { name: 1 }}) // sort alphabetically by name
        .then(categories => {
            console.log('Getting all categories');
            return categories.map( cat => cat.serialize())
        })
        .then(categories => {
            return res.status(HTTP_STATUS_CODES.OK).json(categories);
        })
        .catch(err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        });
});

// get category by Id
categoryRouter.get('/:categoryId',
        // jwtPassportMiddleware, 
        // User.hasAccess( User.ACCESS_PUBLIC ), 
        (req, res) => {
            return Category
            .findOne({
                _id: req.params.categoryId
            })
            .then(category => {
              
                if( !category ){
                     let err = { code: 400 };
                    err.message = 'No department found with that id.';
                    throw err;
                }
                console.log(`Getting category with id: ${req.params.categoryId}`);
                return res.status( HTTP_STATUS_CODES.OK ).json( category.serialize() );
        })
        .catch(err => {
             if (!err.message) {
                 err.message = 'Something went wrong. Please try again';
             }
             return res.status(err.code || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        })
});


// create category
categoryRouter.post('/', 
   jwtPassportMiddleware, 
   User.hasAccess(User.ACCESS_PUBLIC), 
    (req, res ) => {
    // we can access req,body payload bc we defined express.json
    // middleware in server.js
    const newCategory = {
        name: req.body.name
    };

    // validate newcategory data using Joi schema
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
                let err = { code: 400 };
                err.message = `A category ${req.body.name} already exists.`;
                throw err;
            }
        })
        .then(() => {
            // attempt to create a new category
            return Category
                .create( newCategory )
        })
        .then( createdCategory => {
            console.log(`Creating new category`);
            return res.status(HTTP_STATUS_CODES.CREATED).json({
                        created: createdCategory.serialize( ) } );
        })
        .catch(err => {
             if (!err.message) {
                 err.message = 'Something went wrong. Please try again';
             }
             return res.status(err.code || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        })
})

// update category by Id
categoryRouter.put('/:categoryId', 
    jwtPassportMiddleware,
    User.hasAccess(User.ACCESS_PUBLIC),
    (req, res) => {
        const toUpdate = {
            name: req.body.name
        }

        // check that id in request body matches id in request path
        if (req.params.categoryId !== req.body.id) {
            const message = `Request path id ${req.params.categoryId} and request body id ${req.body.categoryId} must match`;
            console.error(message);
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                message
            });
        }    
      
        // if request body doesn't contain a "name" to update send error message
        if (!toUpdate) {
            const message = `Missing updated name in request body`;
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
                return res.status(HTTP_STATUS_CODES.OK).json({updated: updatedCategory.serialize()});
            })
            .catch(err => {
                return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
            });
    }
)

// delete category
categoryRouter.delete('/:categoryId',
    jwtPassportMiddleware,
    User.hasAccess(User.ACCESS_ADMIN),
    (req, res) => {

    // Products and items containing this 
    // category will be deleted as well.
    return Product
        .find({
            category: req.params.categoryId
        })
        .then(products => {
            return products.map(product => product.id);
        })
        .then(productIds => {
            return Item
                .deleteMany({
                    product: {
                        $in: productIds
                    } // $in selects all the documents  where the val of product equals any value in the Ids array.
                })
        })
        .then(items => {
            return Product
            .deleteMany({
                category: req.params.categoryId
            })
        })
        .then( prod => {
            return Category
                .findOneAndDelete({
                    _id: req.params.categoryId
                })
            })
            .then( cat => {
                return res.status(HTTP_STATUS_CODES.OK).json({
                    deleted: `${req.params.categoryId}`,
                    OK: "true"
                });
            })
            .catch(err => {
                return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
            });

    });

module.exports = { categoryRouter };
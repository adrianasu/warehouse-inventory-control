const express = require('express');
const Joi = require('joi');
const { HTTP_STATUS_CODES } = require('../config');
const { jwtPassportMiddleware } = require('../auth/auth.strategy');
const User = require('../user/user.model');
const { Manufacturer } = require('../item/item.model');

const manufacturerRouter = express.Router();

// schema to validate manufacturer content
const ManufacturerJoiSchema = Joi.object().keys({
    _id: Joi.string(),
    __v: Joi.number(),
    name: Joi.string()
});

// get all manufacturers
manufacturerRouter.get('/', (req, res) => {
    return Manufacturer
        .find()
        .then(manufacturers => {
            console.log('Getting all manufacturers');
            return res.status(HTTP_STATUS_CODES.OK).json(manufacturers);
        })
        .catch(err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        });
});

// create manufacturer
manufacturerRouter.post('/', 
   // jwtPassportMiddleware, 
  //  User.hasAccess(User.ACCESS_ADMIN), 
    (req, res ) => {
    // we can access req,body payload bc we defined express.json
    // middleware in server.js
    const newManufacturer = {
        name: req.body.name
    };

    // validate newmanufacturer data using Joi schema
    const validation = Joi.validate( newManufacturer, ManufacturerJoiSchema );
    if( validation.error ){
        return res.status( HTTP_STATUS_CODES.BAD_REQUEST ).json({
            message: validation.error.details[0].message
        });
    }

    // check if manufacturer already exists
    return Manufacturer
        .findOne({
            name: req.body.name
        })
        .then( manufacturer => {
            if( manufacturer ){
                return res.status( HTTP_STATUS_CODES.BAD_REQUEST ).json({
                    message: `A manufacturer ${req.body.name} already exists.`
                });
            }
            // attempt to create a new manufacturer
            return Manufacturer
                .create( newManufacturer )
                .then( createdManufacturer => {
                    console.log(`Creating new manufacturer`);
                    return res.status(HTTP_STATUS_CODES.CREATED).json(createdManufacturer);
                })
                .catch(err => {
                    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
                });
        })
})

// update manufacturer by Id
manufacturerRouter.put('/:manufacturerId', 
    //jwtPassportMiddleware,
    //  User.hasAccess(User.ACCESS_ADMIN),
    (req, res) => {
        const toUpdate = {
            name: req.body.name
        }

        // check that id in request body matches id in request path
        if (req.params.manufacturerId !== req.body.id) {
            const message = `Request path id ${req.params.manufacturerId} and request body id ${req.body.manufacturerId} must match`;
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

        const validation = Joi.validate(toUpdate, ManufacturerJoiSchema);
        if (validation.error) {
            console.log(validation.error);
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                message: validation.error.details[0].message
            });
        }

        Manufacturer
            // $set operator replaces the value of a field with the specified value
            .findOneAndUpdate({
                _id: req.params.manufacturerId
            }, {
                $set: toUpdate
            }, {
                new: true
            })
            .then(updatedManufacturer => {
                console.log(`Updating manufacturer with id: \`${req.params.manufacturerId}\``);
                return res.status(HTTP_STATUS_CODES.OK).json(updatedManufacturer);
            })
            .catch(err => {
                return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
            });
    }
)

// delete manufacturer
manufacturerRouter.delete('/:manufacturerId',
    //jwtPassportMiddleware,
    //User.hasAccess(User.ACCESS_ADMIN),
    (req, res) => {
        return Manufacturer
            .findOneAndDelete({
                _id: req.params.manufacturerId
            })
            .then(deletedManufacturer => {
                console.log(`Deleting manufacturer with id: \`${req.params.manufacturerId}\``);
                return res.status(HTTP_STATUS_CODES.OK).json({
                    deleted: `${req.params.manufacturerId}`,
                    OK: "true"
                });
            })
            .catch(err => {
                return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).res(err);
            });

    });

module.exports = { manufacturerRouter };
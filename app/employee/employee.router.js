const express = require('express');
const Joi = require('joi');
const { HTTP_STATUS_CODES } = require('../config');
const { jwtPassportMiddleware } = require('../auth/auth.strategy');
const User = require('../user/user.model');
const { Employee } = require('../employee/employee.model');
const { Department } = require('../department/department.model');

const employeeRouter = express.Router();

// schema to validate employee content
const EmployeeJoiSchema = Joi.object().keys({
    employeeId: Joi.string().required(),
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    department: Joi.string().required(),
});

const UpdateEmployeeJoiSchema = Joi.object().keys({
    firstName: Joi.string(),
    lastName: Joi.string(),
    department: Joi.string(),
});

// get all employees
employeeRouter.get('/', (req, res) => {
    return Employee
        .find( {}, null, { sort: { lastName: 1 }}) // sort alphabetically by last name
        .then(employees => {
            console.log('Getting all employees');
            return employees.map( employee => employee.serialize())
        })
        .then( employees => {
            return res.status(HTTP_STATUS_CODES.OK).json(employees);
        })
        .catch(err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        });
});

// get employee by Id
employeeRouter.get('/:employeeId',
        (req, res) => {
        return Employee
        .findOne({
            employeeId: req.params.employeeId
        })
        .then(employee => {
            if( !employee ){
                let err = { code: 400 };
                err.message = 'No employee found with that id.';
                throw err;
            }
            console.log(`Getting employee with id: ${req.params.employeeId}`);
            return res.status( HTTP_STATUS_CODES.OK ).json( employee.serialize() );
        })
        .catch(err => {
            if (!err.message) {
                err.message = 'Something went wrong. Please try again';
            }
            return res.status(err.code || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        })
});


// create employee
employeeRouter.post('/', 
    jwtPassportMiddleware, 
    User.hasAccess(User.ACCESS_PUBLIC), 
    (req, res ) => {
    // we can access req,body payload bc we defined express.json
    // middleware in server.js
    const newEmployee = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        employeeId: req.body.employeeId,
        department: req.body.department,
    };

    // validate new employee data using Joi schema
    const validation = Joi.validate( newEmployee, EmployeeJoiSchema );
    if( validation.error ){
        console.log(validation.error.details[0].message)
        return res.status( HTTP_STATUS_CODES.BAD_REQUEST ).json({
            message: validation.error.details[0].message
        });
    }

    // check if employee already exists
    return Employee
        .findOne({
            employeeId: req.body.employeeId
        })
        .then( employee => {
            if( employee ){
                let err = { code: 400 };
                err.message = `An employee with ID ${req.body.employeeId} already exists.`;
                throw err;
            }
        })
        .then(() => {
            // attempt to create a new employee
            return Employee
                .create( newEmployee )
        })
        .then( createdEmployee => {
            return Employee
                .findOne({
                    employeeId: req.body.employeeId
                })
        })
        .then(employee => {
            console.log(`Creating new employee`);
            return res.status(HTTP_STATUS_CODES.CREATED).json({
                        created: employee.serialize() });
        })
        .catch(err => {
            if (!err.message) {
                err.message = 'Something went wrong. Please try again';
            }
            return res.status(err.code || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        })
})

// update employee by Id
employeeRouter.put('/:employeeId', 
    jwtPassportMiddleware,
    User.hasAccess(User.ACCESS_PUBLIC),
    (req, res) => {

        // check that id in request body matches id in request path
        if (req.params.employeeId != req.body.employeeId) {
            const message = `Request path id ${req.params.employeeId} and request body id ${req.body.employeeId} must match`;
            console.error(message);
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                message
            });
        }    
      
        // we only support a subset of fields being updateable
        // if the user sent over any of them 
        // we update those values on the database
        const updateableFields = ["firstName", "lastName", "department"];
        // check what fields were sent in the request body to update
        const toUpdate = {};
        updateableFields.forEach(field => {
            if (field in req.body ) {
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

        

        const validation = Joi.validate(toUpdate, UpdateEmployeeJoiSchema);
        if (validation.error) {
            console.log(validation.error);
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                message: validation.error.details[0].message
            });
        }

        return Employee
            // $set operator replaces the value of a field with the specified value
            .findOneAndUpdate({
                employeeId: req.params.employeeId
            }, {
                $set: toUpdate
            }, {
                new: true
            })
            .then(updatedEmployee => {
                console.log(`Updating employee with id: \`${req.params.employeeId}\``);
                return res.status(HTTP_STATUS_CODES.OK).json({updated: updatedEmployee});
            })
            .catch(err => {
                return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
            });
    }
)

// delete employee
employeeRouter.delete('/:employeeId',
    jwtPassportMiddleware,
    User.hasAccess(User.ACCESS_ADMIN),
    (req, res) => {

    // The correspondent user will be deleted too.

    return Employee
        .findOne({
            employeeId: req.params.employeeId
        })
        .then( employee => {
            return User.User
            .findOneAndDelete({ 
                id: employee.id 
            })
        })
        .then(() => {     
            return Employee
            .findOneAndDelete({
                employeeId: req.params.employeeId
            })
        })
        .then(deletedEmployee => {
            return res.status(HTTP_STATUS_CODES.OK).json({
                deleted: `${req.params.employeeId}`,
                OK: "true"
            });
        })
        .catch(err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        });

    });

module.exports = { employeeRouter };
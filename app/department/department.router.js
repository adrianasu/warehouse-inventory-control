const express = require('express');
const Joi = require('joi');
const { HTTP_STATUS_CODES } = require('../config');
const { jwtPassportMiddleware } = require('../auth/auth.strategy');
const User = require('../user/user.model');
const { Department } = require('../department/department.model');
const { Employee } = require('../employee/employee.model');
 
const departmentRouter = express.Router();

// schema to validate department content
const DepartmentJoiSchema = Joi.object().keys({
    _id: Joi.string(),
    __v: Joi.number(),
    name: Joi.string()
});

// get all departments
departmentRouter.get('/', (req, res) => {
    return Department
        .find( {}, null, { sort: { name: 1 }}) // sort alphabetically by name
        .then(departments => {
            return departments.map(dep => dep.serialize())
        })
        .then(departments => {
            console.log('Getting all departments');
            return res.status(HTTP_STATUS_CODES.OK).json(departments);
        })
        .catch(err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        });
});

// get department by Id
departmentRouter.get('/:departmentId',
        // jwtPassportMiddleware, 
        // User.hasAccess( User.ACCESS_PUBLIC ), 
        (req, res) => {
        return Department
        .findOne({
            _id: req.params.departmentId
        })
        .then(department => {
            if( !department ){
                let err = { code: 400 };
                err.message = 'No department found with that id.';
                throw err;
            }
            console.log(`Getting department with id: ${req.params.departmentId}`);
            return res.status( HTTP_STATUS_CODES.OK ).json( department.serialize());
        })
        .catch(err => {
            if (!err.message) {
                err.message = 'Something went wrong. Please try again';
            }
            return res.status(err.code || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        })
});


// create department
departmentRouter.post('/', 
   // jwtPassportMiddleware, 
  //  User.hasAccess(User.ACCESS_ADMIN), 
    (req, res ) => {
    // we can access req,body payload bc we defined express.json
    // middleware in server.js
    const newDepartment = {
        name: req.body.name
    };

    // validate newdepartment data using Joi schema
    const validation = Joi.validate( newDepartment, DepartmentJoiSchema );
    if( validation.error ){
        return res.status( HTTP_STATUS_CODES.BAD_REQUEST ).json({
            message: validation.error.details[0].message
        });
    }

    // check if department already exists
    return Department
        .findOne({
            name: req.body.name
        })
        .then( department => {
            if( department ){
                let err = { code: 400 };
                err.message = `A department ${req.body.name} already exists.`;
                throw err;
            }
        })
            // attempt to create a new department
        .then(() => {
            return Department
                .create( newDepartment )
        })
        .then( createdDepartment => {
            console.log(`Creating new department`);
            return res.status(HTTP_STATUS_CODES.CREATED).json(createdDepartment.serialize());
        })
        .catch(err => {
            if (!err.message) {
                err.message = 'Something went wrong. Please try again';
            }
            return res.status(err.code || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        })

})

// update department by Id
departmentRouter.put('/:departmentId', 
    //jwtPassportMiddleware,
    //  User.hasAccess(User.ACCESS_ADMIN),
    (req, res) => {
        const toUpdate = {
            name: req.body.name
        }

        // check that id in request body matches id in request path
        if (req.params.departmentId !== req.body.id) {
            const message = `Request path id ${req.params.departmentId} and request body id ${req.body.departmentId} must match`;
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

        const validation = Joi.validate(toUpdate, DepartmentJoiSchema);
        if (validation.error) {
            console.log(validation.error);
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                message: validation.error.details[0].message
            });
        }

        Department
            // $set operator replaces the value of a field with the specified value
            .findOneAndUpdate({
                _id: req.params.departmentId
            }, {
                $set: toUpdate
            }, {
                new: true
            })
            .then(updatedDepartment => {
                console.log(`Updating department with id: \`${req.params.departmentId}\``);
                return res.status(HTTP_STATUS_CODES.OK).json(updatedDepartment.serialize());
            })
            .catch(err => {
                return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
            });
    }
)

// delete department
departmentRouter.delete('/:departmentId',
    //jwtPassportMiddleware,
    //User.hasAccess(User.ACCESS_ADMIN),
    (req, res) => {
        console.log(`Deleting department with id: \`${req.params.departmentId}\` and all the employees in that department and their users.`);
        
        return Employee
        .find({ 
            department: req.params.departmentId
        })
        .then(employees => {
            return employees.map(employee => employee.id)
        })
        .then( employeeIds => {
            return User.User
                .deleteMany({ employee: {
                        $in: employeeIds
                    }
                })
        })
        .then( () => {
            return Employee
                .deleteMany({
                    department: req.params.departmentId
                })
        })
        .then(employees => {
            return Department
            .findOneAndDelete({
                _id: req.params.departmentId
            })
        })
        .then(deletedDepartment => {
            return res.status(HTTP_STATUS_CODES.OK).json({
                deleted: `${req.params.departmentId}`,
                OK: "true"
            });
        })
        .catch(err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        });

    });

module.exports = { departmentRouter };
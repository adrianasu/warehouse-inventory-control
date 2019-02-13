const express = require('express');
const Joi = require('joi');

const { HTTP_STATUS_CODES } = require('../config');
const { jwtPassportMiddleware } = require('../auth/auth.strategy');
const { Employee } = require('../employee/employee.model');
const User = require('./user.model');
const Users = User.User;

const userRouter = express.Router();

//create new user
userRouter.post('/', (req, res) => {
    const newUser = {
        employeeId: req.body.employeeId,
        email: req.body.email,
        password: req.body.password,
    };
    // validate new user data using Joi
    const validation = Joi.validate( newUser, User.UserJoiSchema );
    if( validation.error ){
        let err = { code: HTTP_STATUS_CODES.BAD_REQUEST };
        err.message = validation.error.details[0].message;
        throw err;
    }

    // verify if employeeId exists
    return Employee
    .findOne({ employeeId: req.body.employeeId })
    .then( employee => {
        if( !employee ){
            let err = { code: 400 };
            err.message = `Employee ID doesn't exist.`;
            throw err;
        }
        // employee exists so add it to newUser data
        newUser.employee = employee.id;
        // verify if employee already has an account
        return Users
        .findOne({ employee: newUser.employee })
    })
    .then( user => {
        if( user ){
            let err = { code: 400 };
            err.message = `An account with employee ID ${req.body.employeeId} already exists.`;
            throw err;
        }
        // verify if email exists already in our DB
        return Users
        .findOne({ email: newUser.email })
    })
    
    .then( user => {
        if( user ){
            let err = { code: 400 };
            err.message = 'A user with that email already exists.';
            throw err;
        }
        // email non existent so hash password
        return Users.hashPassword(newUser.password);
    })
    .then(passwordHash => {
        newUser.password = passwordHash;
        // attempt to create new user
        return Users
            .create(newUser)
    })
    .then(createdUser => {
        // Success! Get populated user to send back to client.
        return Users
        .findOne({ email: req.body.email })
    })
    .then( user => {
        return res.status(HTTP_STATUS_CODES.CREATED).json(user.serialize());
    })
    .catch(err => {
        console.error(err)
        if (!err.message) {
            err.message = 'Something went wrong. Please try again'
        }
        return res.status(err.code || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
    })
      
});

// retrieve all users' employee, email and access level
userRouter.get('/', 
    jwtPassportMiddleware, 
    User.hasAccess(User.ACCESS_PUBLIC), 
(req, res) => {
    
    return Users
        .find({}, null, { sort: { accessLevel: -1 }}) // sort by access level in descendent order
        .then(users => {
            return res.status(HTTP_STATUS_CODES.OK).json(users.map(user => user.serialize()));
        })
        .catch(err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        });
});

userRouter.get('/:userId', 
    jwtPassportMiddleware, 
    User.hasAccess(User.ACCESS_OVERVIEW), 
    (req, res) => {
    return Users    
        .findById(req.params.userId)
        .then(user => {
            return res.status(HTTP_STATUS_CODES.OK).json(user.serialize());
        })
        .catch(err => {
            return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        });
});

// update user's name, or accessLevel by id
userRouter.put('/:userId', 
    jwtPassportMiddleware, 
    User.hasAccess(User.ACCESS_OVERVIEW),
    (req, res) => {

    // check that id in request body matches id in request path
    if (req.params.userId !== req.body.id) {
        let err = { code: HTTP_STATUS_CODES.BAD_REQUEST };
        err.message = `Request path id ${req.params.userId} and request body id ${req.body.id} must match`;
        throw err;
    }
    // we only support a subset of fields being updateable.
    // If the user sent over any of them 
    // we update those values on the database
    const updateableFields = ["email", "accessLevel"];

    // check what fields were sent in the request body to update
    const toUpdate = {};
    updateableFields.forEach(field => {
        if (field in req.body) {
            toUpdate[field] = req.body[field];
        }
    });
    // if request body doesn't contain any updateable field send error message
    if (toUpdate.length === 0) {
        let err = { code: HTTP_STATUS_CODES.BAD_REQUEST };
        err.message = `Missing \`${updateableFields.join('or ')}\` in request body`;
        throw err;
    }
  
    return Users
    .findById(req.params.userId)
    .then(user => {
        // if user is attempting to change "accessLevel" check if
        // user's level is greater than the one to update and greater 
        // than or equal to the new value
        if (user.accessLevel > req.user.accessLevel ||
            req.user.accessLevel < req.body.accessLevel) {
                let err = { code: HTTP_STATUS_CODES.UNAUTHORIZED };
                err.message = `Unauthorized to change that information`;
                throw err;
          
        }
        // users are allowed to update their own email only.
        if( req.body.email && (req.user.email !== user.email) ){
                let err = { code: HTTP_STATUS_CODES.UNAUTHORIZED };
                err.message = `Unauthorized.`;
                throw err;
        }

                
        // do not allow to update "admin", "overview" or "public" demo users
        let email = user.email;
   
        if (email === "admin@m.com" 
            || email === "public@m.com" 
            || email === "overview@m.com") {
            let err = { code: HTTP_STATUS_CODES.UNAUTHORIZED };
            err.message = `Unauthorized to edit demo user`;
            throw err;
        }
                
        const validation = Joi.validate(toUpdate, User.UpdateUserJoiSchema);
        if (validation.error) {
            let err = { code: HTTP_STATUS_CODES.UNAUTHORIZED };
            err.message = validation.error.details[0].message;
            throw err;
        }
        return Users
            // $set operator replaces the value of a field with the specified value
            .findByIdAndUpdate(req.params.userId, {
                $set: toUpdate
            }, {
                new: true
            })
        })
        .then(updatedUser => {
            // Find user using mongoose findOne to populate our data.
            return Users
                .findOne({ _id: req.params.userId })
        })
        .then( user => {
            console.log(`Updating user with id: \`${req.params.userId}\``);
            return res.status(HTTP_STATUS_CODES.OK).json({
                        updated: user.serialize()});
        })
         
        .catch(err => {
            console.error(err)
            if( !err.message ){
                err.message = 'Something went wrong. Please try again';
            }
            return res.status(err.code || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
        });
});

// delete one 'user' using mongoose function findByIdAndDelete
userRouter.delete('/:userId', 
    jwtPassportMiddleware,
    User.hasAccess(User.ACCESS_ADMIN),
    (req, res) => {

    return Users
        .findByIdAndDelete(req.params.userId)
        .then(deletedUser => {
            res.status(HTTP_STATUS_CODES.OK).json({
                deleted: `${req.params.userId}`,
                OK: "true"
            });
            
    })
    .catch(err => {
        console.error(err)
        if (!err.message) {
            err.message = 'Something went wrong. Please try again';
        }
        return res.status(err.code || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(err);
    });
   
});


module.exports = {
    userRouter
};




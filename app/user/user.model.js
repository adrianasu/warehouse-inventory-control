const mongoose = require('mongoose');
// bcrypt is a password hashing function that incorporates salt
const bcrypt = require('bcryptjs');
// joi allows to create schemas for JS objects to ensure validation of data
const Joi = require('joi');
mongoose.Promise = global.Promise;

const ACCESS_BASIC = 0;
const ACCESS_OVERVIEW = 10;
const ACCESS_PUBLIC = 20;
const ACCESS_ADMIN = 30;

const levels = { ACCESS_BASIC, ACCESS_OVERVIEW, ACCESS_PUBLIC, ACCESS_ADMIN };

// mongoose schema to define the structure of our user documents within a collection
const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    accessLevel: {
        type: Number,
        default: ACCESS_OVERVIEW
    }
});

// mongoose serialize method to define the structure of the user data
// we're sending in the response body
userSchema.methods.serialize = function(){
    return {
        id: this._id,
        firstName: this.firstName,
        lastName: this.lastName,
        username: this.username,
        accessLevel: this.accessLevel,
        levels
    };
};

userSchema.methods.serializePublic = function () {
    return {
        id: this._id,
        firstName: this.firstName,
        lastName: this.lastName,
        accessLevel: this.accessLevel,
        levels
    };
};

// method to hash a password before storing it
userSchema.statics.hashPassword = function( password ){
    return bcrypt.hash( password, 10 );
};

// validate a password by hashing and comparing it to the one stored
userSchema.methods.validatePassword = function( password ){
    return bcrypt.compare( password, this.password );
};

//check if user is allowed to access an endpoint
userSchema.statics.hasAccess = function( accessLevel ){
    //express expects a function with req, res, next
    return function( req, res, next ){
        console.log(`Checking if ${req.user.username} is allowed`);
        if( req.user && req.user.accessLevel >= accessLevel ){
            next();
        } else{
            const err = new Error ("Access not allowed. To increase your access level contact an admin.");
            err.code = 403;
            next(err); 
        }
    }
}

// use Joi to determine that some data is valid to create a new user
const UserJoiSchema = Joi.object().keys({
    firstName: Joi.string().min(1).trim().required(),
    lastName: Joi.string().min(1).trim().required(),
    username: Joi.string().min(4).max(30).trim().required(),
    password: Joi.string().min(7).max(30).trim().required(),
    accessLevel: Joi.number().optional()
});

const UpdateUserJoiSchema = Joi.object().keys({
    firstName: Joi.string().min(1).trim(),
    lastName: Joi.string().min(1).trim(),
    username: Joi.string().min(4).max(30).trim(),
    accessLevel: Joi.number().optional()
});

userSchema.statics.ACCESS_BASIC = ACCESS_BASIC;
userSchema.statics.ACCESS_OVERVIEW = ACCESS_OVERVIEW;
userSchema.statics.ACCESS_PUBLIC = ACCESS_PUBLIC;
userSchema.statics.ACCESS_ADMIN = ACCESS_ADMIN;

const User = mongoose.model( 'user', userSchema );

module.exports = {
    User, UserJoiSchema, UpdateUserJoiSchema, hasAccess: userSchema.statics.hasAccess, ACCESS_BASIC, ACCESS_OVERVIEW, ACCESS_PUBLIC, ACCESS_ADMIN
};
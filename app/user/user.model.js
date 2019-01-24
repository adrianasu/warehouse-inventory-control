const mongoose = require('mongoose');
// bcrypt is a password hashing function that incorporates salt
const bcrypt = require('bcryptjs');
// joi allows to create schemas for JS objects to ensure validation of data
const Joi = require('joi');
mongoose.Promise = global.Promise;
const ObjectId = mongoose.Schema.Types.ObjectId;

const ACCESS_BASIC = 0;
const ACCESS_OVERVIEW = 10;
const ACCESS_PUBLIC = 20;
const ACCESS_ADMIN = 30;

const levels = { ACCESS_BASIC, ACCESS_OVERVIEW, ACCESS_PUBLIC, ACCESS_ADMIN };

// mongoose schema to define the structure of our user documents within a collection
const userSchema = new mongoose.Schema({
    employee: {
        type: ObjectId,
        ref: "Employee"
    },
    email: { // we'll use email as username
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
        employeeId: this.employee.employeeId,
        firstName: this.employee.firstName,
        lastName: this.employee.lastName,
        department: this.employee.department.name,
        email: this.email,
        accessLevel: this.accessLevel,
    
    };
};

userSchema.methods.serializeLogIn = function () {
    return {
        id: this._id,
        employee: this.employee,
        email: this.email,
        accessLevel: this.accessLevel,
   
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
        console.log(`Checking if ${req.user.email} is allowed`);
        if( req.user && req.user.accessLevel >= accessLevel ){
            next();
        } else{
            const err = new Error ("Access not allowed. To increase your access level contact an admin.");
            err.code = 403;
            next(err); 
        }
    }
}

userSchema.pre('find', function (next) {
    this.populate('employee');
    next();
});

userSchema.pre('findOne', function (next) {
    this.populate('employee');
    next();
});

// use Joi to determine that some data is valid to create a new user
const UserJoiSchema = Joi.object().keys({
    employeeId: Joi.number().required(),
    email: Joi.string().required(),
    password: Joi.string().min(7).max(30).trim().required(),
    accessLevel: Joi.number().optional()
});

const UpdateUserJoiSchema = Joi.object().keys({
    email: Joi.string().min(4).max(30).trim(),
    accessLevel: Joi.number().optional()
});

userSchema.statics.ACCESS_BASIC = ACCESS_BASIC;
userSchema.statics.ACCESS_OVERVIEW = ACCESS_OVERVIEW;
userSchema.statics.ACCESS_PUBLIC = ACCESS_PUBLIC;
userSchema.statics.ACCESS_ADMIN = ACCESS_ADMIN;

const User = mongoose.model( 'user', userSchema );

module.exports = {
    User, UserJoiSchema, UpdateUserJoiSchema, hasAccess: userSchema.statics.hasAccess, ACCESS_BASIC, ACCESS_OVERVIEW, ACCESS_PUBLIC, ACCESS_ADMIN, levels
};
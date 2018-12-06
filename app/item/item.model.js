const mongoose = require('mongoose');
const Joi = require('joi');
const { User } = require('../user/user.model')

mongoose.Promise = global.Promise;
const ObjectId = mongoose.Schema.Types.ObjectId;

const categorySchema = mongoose.Schema({
    name: String,
    addedBy: {
        type: ObjectId,
        ref: "User"
    }
});

const checkInSchema = mongoose.Schema({
    user: {
        type: ObjectId,
        ref: "User"
    },
    barcode: Number,
    date: Date
})

const checkOutSchema = mongoose.Schema({
    user: {
        type: ObjectId,
        ref: "User"
    },
    barcode: Number,
    date: Date,
    status: String
})


const itemSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    barcode: {
        type: Number,
        unique: true
    },
    category: {
        type: ObjectId,
        ref: "Category"
    },
    manufacturer: String,
    modelNumber: String,
    serialNumber: Number,
    registrationDate: Date,
    checkedOut: {
        type: ObjectId,
        ref: "CheckOut"
    },
    checkedIn: {
        type: ObjectId,
        ref: "CheckIn"
    },
    location: {
        warehouse: Number,
        aisle: Number,
        shelf: Number,
        bin: Number
    },
});

const ItemJoiSchema = Joi.object().keys({
    _id: Joi.string(),
    name: Joi.string(),
    barcode: Joi.number(),
    category: Joi.object().keys({
        name: Joi.string(),
        addedBy: Joi.string()
    }),
    manufacturer: Joi.string(),
    modelNumber: Joi.string(),
    serialNumber: Joi.number(),
    registrationDate: Joi.date(),
    checkedOut: Joi.object().keys({
        user: Joi.string(),
        date: Joi.date(),
        barcode: Joi.number(),
        status: Joi.string()
    }),
    checkedIn: Joi.object().keys({
        user: Joi.string(),
        date: Joi.date(),
        barcode: Joi.number()
    }),
    location: Joi.object().keys({
        warehouse: Joi.string(),
        aisle: Joi.number(),
        shelf: Joi.number(),
        bin: Joi.number()
    })
})

itemSchema.methods.serialize = function(){
    return {
        id: this._id,
        name: this.name,
        barcode: this.barcode,
        category: this.category,
        manufacturer: this.manufacturer,
        modelNumber: this.modelNumber,
        serialNumber: this.serialNumber,
        registrationDate: this.registrationDate,
        checkedOut: this.checkedOut,
        checkedIn: this.checkedIn,
        location: this.location
    }
}

itemSchema.pre( 'find', function( next ){
    this.populate( 'category checkedIn checkedOut' );
    next();
});

itemSchema.pre( 'findOne', function( next ){
    this.populate( 'category checkedIn checkedOut' );
    next();
});

categorySchema.pre( 'find', function( next ){
    this.populate( 'user' );
    next();
});

categorySchema.pre( 'findOne', function( next ){
    this.populate( 'user' );
    next();
});

checkInSchema.pre( 'find', function( next ){
    this.populate( 'user' );
    next();
});

checkInSchema.pre( 'findOne', function( next ){
    this.populate( 'user' );
    next();
});

checkOutSchema.pre( 'find', function( next ){
    this.populate( 'user' );
    next();
});

checkOutSchema.pre( 'findOne', function( next ){
    this.populate( 'user' );
    next();
});

// instance method to calculate the useful life of an item

itemSchema.methods.usefulLife = function(status){
    if( status === "broken" ){
        return this.checkedOut.date - this.registrationDate;
    };
    return "Unknown";
}

const Item = mongoose.model( "Item", itemSchema );
const Category = mongoose.model( "Category", categorySchema );
const CheckIn = mongoose.model( "CheckIn", checkInSchema );
const CheckOut = mongoose.model( "CheckOut", checkOutSchema );

module.exports ={
    Item, Category, CheckIn, CheckOut
};
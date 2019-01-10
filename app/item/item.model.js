const mongoose = require('mongoose');
const Joi = require('joi');

mongoose.Promise = global.Promise;
const ObjectId = mongoose.Schema.Types.ObjectId;

const departmentSchema = mongoose.Schema({
    departmentName: {
        type: String,
        required: true,
        unique: true,
        default: "NA"
    }
})

const employeeSchema = mongoose.Schema({
    employeeId: String,
    firstName: String,
    lastName: String,
    department: {
        type: ObjectId,
        ref: "Department"
    }
})

const itemSchema = mongoose.Schema({
    barcode: {
        type: Number,
        unique: true
    },
    product: {
        type: ObjectId,
        ref: "Product"
    },
    serialNumber: Number,
    registered: {
        date: {
            type: Date,
            default: Date.now()
        },
        condition: {
            type: String,
            default: "New"
        }
    },
    checkedOut: [{
        employee: {
            type: ObjectId,
            ref: "Employee"
        },
        barcode: Number,
        date: Date,
        condition: {
            type: String,
            default: "in-use" // in-use, lost, stolen, broken
        },
        authorizedBy: {
            type: ObjectId,
            ref: "Employee"
        }
    }],
    checkedIn: [{  
        employee: {
            type: ObjectId,
            ref: "Employee"
        },
        barcode: Number,
        date: Date,
        authorizedBy: {
            type: ObjectId,
            ref: "Employee"
        }
    }],
    location: {
        warehouse: String,
        aisle: String,
        shelf: Number,
        bin: Number
    },
   isCheckedOut: Boolean,
});


const ItemJoiSchema = Joi.object().keys({
    __v: Joi.string(),
    _id: Joi.string(),
    barcode: Joi.number(),
    product: Joi.object().keys({
        _id: Joi.string(),
        name: Joi.string(), 
        manufacturer: Joi.object().keys({
                _id: Joi.string(),
                name: Joi.string(),
                __v: Joi.number()
        }),
        model: Joi.string(),
        consummable: Joi.boolean(),
        minimumRequired: Joi.object().keys({
            quantity: Joi.number(),
            units: Joi.string()
        }),
        category: Joi.object().keys({
            name: Joi.string(),
            addedBy: Joi.object().keys({
                _id: Joi.string(),
                firstName: Joi.string().min(1).trim(),
                lastName: Joi.string().min(1).trim(),
                username: Joi.string().min(4).max(30).trim(),
                password: Joi.string().min(7).max(30).trim(),
                accessLevel: Joi.number().optional(),
                __v: Joi.number()
            }),
        }),
        __v: Joi.number()
    }),
    serialNumber: Joi.number(),
    registered: Joi.object().keys({
        date: Joi.date(),
        condition: Joi.string()
    }),
    checkedOut: Joi.array().items(
        Joi.object().keys({
        employee: Joi.object().keys({
            _id: Joi.string(),
            firstName: Joi.string(),
            lastName: Joi.string(), 
            department: Joi.object().keys({
                _id: Joi.string(),
                departmentName: Joi.string(),
                __v: Joi.number()
            }),
            __v: Joi.number()
        }),
        date: Joi.date(),
        barcode: Joi.number(),
        condition: Joi.string(),
        authorizedBy: Joi.object().keys({
            _id: Joi.string(),
            firstName: Joi.string(),
            lastName: Joi.string(),
            department: Joi.object().keys({
                _id: Joi.string(),
                departmentName: Joi.string(),
                __v: Joi.number()
            }),
            __v: Joi.number()
        }),
    })),
    checkedIn: Joi.array().items(
        Joi.object().keys({
        employee: Joi.object().keys({
            _id: Joi.string(),
            firstName: Joi.string(),
            lastName: Joi.string(), 
            department: Joi.object().keys({
                _id: Joi.string(),
                departmentName: Joi.string(),
                __v: Joi.number()
        }),
        authorizedBy: Joi.object().keys({
            _id: Joi.string(),
            firstName: Joi.string(),
            lastName: Joi.string(),
            department: Joi.object().keys({
                _id: Joi.string(),
                departmentName: Joi.string(),
                __v: Joi.number()
            }),
            __v: Joi.number()
        }),
            __v: Joi.number()
        }),
        date: Joi.date(),
        barcode: Joi.number()
    })),
    location: Joi.object().keys({
        warehouse: Joi.string(),
        aisle: Joi.string(),
        shelf: Joi.number(),
        bin: Joi.number()
    }),
    isCheckedOut: Joi.boolean()
})

const UpdateItemJoiSchema = Joi.object().keys({
    checkedOut: Joi.array().items(
        Joi.object().keys({
        employee: Joi.object().keys({
            _id: Joi.string(),
            firstName: Joi.string(),
            lastName: Joi.string(),
            department: Joi.object().keys({
                _id: Joi.string(),
                departmentName: Joi.string(),
                __v: Joi.number()
            }),
            __v: Joi.number()
        }),
        date: Joi.date(),
        barcode: Joi.number(),
        condition: Joi.string(),
        authorizedBy: Joi.object().keys({
            _id: Joi.string(),
            firstName: Joi.string(),
            lastName: Joi.string(),
            department: Joi.object().keys({
                _id: Joi.string(),
                departmentName: Joi.string(),
                __v: Joi.number()
            }),
            __v: Joi.number()
        })
    })),
    checkedIn: Joi.array().items(
        Joi.object().keys({
        employee: Joi.object().keys({
            _id: Joi.string(),
            firstName: Joi.string(),
            lastName: Joi.string(),
            department: Joi.object().keys({
                _id: Joi.string(),
                departmentName: Joi.string(),
                __v: Joi.number()
            }),
        authorizedBy: Joi.object().keys({
            _id: Joi.string(),
            firstName: Joi.string(),
            lastName: Joi.string(),
            department: Joi.object().keys({
                _id: Joi.string(),
                departmentName: Joi.string(),
                __v: Joi.number()
            }),
            __v: Joi.number()
        }),
            __v: Joi.number()
        }),
        date: Joi.date(),
        barcode: Joi.number()
    })),
    location: Joi.object().keys({
        warehouse: Joi.string(),
        aisle: Joi.string(),
        shelf: Joi.number(),
        bin: Joi.number()
    }),
    isCheckedOut: Joi.boolean()
})


itemSchema.methods.serialize = function(){
    return {
        id: this._id,
        barcode: this.barcode,
        product: this.product,
        serialNumber: this.serialNumber,
        registered: this.registered,
        checkedOut: this.checkedOut,
        checkedIn: this.checkedIn,
        location: this.location,
        isCheckedOut: this.isCheckedOut 
    }
}

// Returns the number of days since its registration until 
// declared as broken (inside the checkedOut.status field)
itemSchema.methods.calculateUsefulLife = function(){
    if( this.checkedOut.length === 0 ||
        this.checkedOut[this.checkedOut.length-1].condition !== "broken"){
        return "NA";
    }
    return Math.floor((this.checkedOut[this.checkedOut.length - 1].date - this.registered.date) / (1000 * 60 * 60 * 24));
}

itemSchema.methods.serializeWithUsefulLife = function () {
    return {
        id: this._id,
        barcode: this.barcode,
        product: this.product,
        serialNumber: this.serialNumber,
        registered: this.registered,
        checkedOut: this.checkedOut,
        checkedIn: this.checkedIn,
        location: this.location,
        usefulLife: this.calculateUsefulLife()
    }
}


// Instance method to determine if an item is on shelf
itemSchema.methods.isOnShelf = function () {
    // If item has never been checked out or if its more recent operation
    // is "checked in" then it will be considered to be on shelf
    if ((this.checkedOut.length === 0 && this.checkedIn.length === 0 ) 
        || (this.checkedOut.length > 0 && this.checkedIn.length > 0
            && this.checkedOut[0].date < this.checkedIn[0].date)) {
            return "true";
        } 
        return "false";
}
   
itemSchema.pre('save', function(next){
    if( this.isOnShelf() === "true" ){
        this.isCheckedOut = false;
    } else {
        this.isCheckedOut = true;
    }
    next();
});



employeeSchema.pre('find', function (next) {
    this.populate('department');
    next();
});

employeeSchema.pre('findOne', function (next) {
    this.populate('department');
    next();
});

itemSchema.pre( 'find', function( next ){
    this.populate('product checkedIn.employee checkedOut.employee');
    next();
});

itemSchema.pre( 'findOne', function( next ){
    this.populate('product checkedIn.employee checkedOut.employee');
    next();
});

const Item = mongoose.model( "Item", itemSchema );
const Employee = mongoose.model("Employee", employeeSchema);
const Department = mongoose.model("Department", departmentSchema);

module.exports ={
    Item, Employee, Department, ItemJoiSchema, UpdateItemJoiSchema };
const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
const ObjectId = mongoose.Schema.Types.ObjectId;

const employeeSchema = mongoose.Schema({
    employeeId: Number,
    firstName: String,
    lastName: String,
    department: {
        type: ObjectId,
        ref: "Department"
    }
})

employeeSchema.methods.serialize = function () {
    return {
        id: this._id,
        firstName: this.firstName,
        lastName: this.lastName,
        employeeId: this.employeeId,
        department: this.department
    }
}

employeeSchema.pre('find', function (next) {
    this.populate('department');
    next();
});

employeeSchema.pre('findOne', function (next) {
    this.populate('department');
    next();
});
const Employee = mongoose.model("Employee", employeeSchema);

module.exports ={ Employee };
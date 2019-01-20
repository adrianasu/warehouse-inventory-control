const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
const ObjectId = mongoose.Schema.Types.ObjectId;

const employeeSchema = mongoose.Schema({
    employeeId: String,
    firstName: String,
    lastName: String,
    department: {
        type: ObjectId,
        ref: "Department"
    }
})


employeeSchema.pre('find', function (next) {
    this.populate('department');
    next();
});

employeeSchema.pre('findOne', function (next) {
    this.populate('department');
    next();
});

employeeSchema.methods.serialize = function () {
    return {
        id: this._id,
        employeeId: this.employeeId,
        firstName: this.firstName,
        lastName: this.lastName,
        department: this.department.name
    }
}
const Employee = mongoose.model("Employee", employeeSchema);

module.exports ={ Employee };
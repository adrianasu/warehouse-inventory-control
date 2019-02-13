const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

const departmentSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        default: "NA"
    }
});

departmentSchema.methods.serialize = function () {
    return {
        id: this._id,
        name: this.name,
    }
}


const Department = mongoose.model("Department", departmentSchema);

module.exports = {
    Department
};
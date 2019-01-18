const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
const ObjectId = mongoose.Schema.Types.ObjectId;

const departmentSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        default: "NA"
    }
})


const Department = mongoose.model("Department", departmentSchema);

module.exports = {
    Department
};
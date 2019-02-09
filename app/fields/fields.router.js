const express = require('express');

const { HTTP_STATUS_CODES } = require('../config');
// const { jwtPassportMiddleware } = require('../auth/auth.strategy');

const { Category } = require('../category/category.model');
const { Department } = require('../department/department.model');
const { Employee } = require('../employee/employee.model');
const { Item, condition } = require('../item/item.model');
const { Manufacturer } = require('../manufacturer/manufacturer.model');
const { Product } = require('../product/product.model');
const { User } = require('../user/user.model');
const { levels } = require('../user/user.model');


const fieldsRouter = express.Router();

function findAllNamesAndIds( CollectionName ){

    return CollectionName
        .find()
        .sort({ name: 1 })
        .then( allDocuments => {
            if( CollectionName === Employee && allDocuments ){
                return allDocuments.map(docum => {
                    return {
                        name: `${docum.firstName} ${docum.lastName}`,
                        id: docum.employeeId
                    }
                })
            } else if( allDocuments ){
                return allDocuments.map( docum => {
                    return {
                        name: docum.name,
                        id: docum._id
                    }
                })
            } else {
                return [];
            }
        })
}

// get searchable fields: Categories, Products, Manufacturers,
// Employees, Departments, AccessLevels, Units(from Product.minimumRequired)
// Warehouses and EmployeeIds with no user account
fieldsRouter.get('/', (req, res) => {
    let fields = {};
   
    return findAllNamesAndIds(Category)
        .then( categories =>  {
            fields.category = categories;
            return findAllNamesAndIds(Manufacturer);
        })
        .then( manufacturers => {
            fields.manufacturer = manufacturers;
            return findAllNamesAndIds(Employee);
        })
        .then(employees => {
            // The array contains objects as:
            // { name: firstName + lastName, id: employeeId }
            fields.employee = employees;
            // Get employee Ids from the User collection
            return User
            .find()
        })
        .then( users => {
            users = users.map(
                user => user.serialize());
            let idWithAccount = users.map(
                user => user.employeeId);
            // Compare ALL employee Ids registered
            // against employeeIds with user account 
            // and send the ones with no account
            return fields.employee.filter(employee => 
                !idWithAccount.includes(employee.id.toString()))
        })
        .then( idsWithNoAccount => {
            fields.idsWithNoAccount = idsWithNoAccount;
            return findAllNamesAndIds(Department);
        })
        .then(departments => {
            fields.department = departments;  
            return Item
            .distinct('location.warehouse')
        })
        .then(warehouses => {
            fields.warehouse = warehouses.sort();
            // To find the "unit" fields, we'll get the
            // products that have a minimumRequired quantity specified.
            return Product
            .find({"minimumRequired.quantity": { $gt: 0 }})
        })
        .then(products => {
            let units = products.map( product => product.minimumRequired.units )
            // send a list of units with no repeated values
            fields.units = units.filter((unit, index, self) => self.indexOf(unit) === index)
            // send accessLevels
            fields.accessLevel = levels;
            // send condition options for registering items
            fields.condition = condition;
            // Send barcodes of items that are currently checked-out
            return Item
                .find({ isCheckedOut: true })
        })
        .then( items => {
            return items.map(item => { return { barcode: item.barcode } })
        })
        .then( barcodes => {
            // If more than 5 barcodes were found, send 5.
            if( barcodes && barcodes.length > 5){
                fields.checkedOut = barcodes.slice(0, 5);
            } else {
                fields.checkedOut = barcodes;
            }
            // Send barcodes of items that are currently checked-in
            return Item
            .find({ isCheckedOut: false })
        })
        .then( items => {
            return items.map(item => { return { barcode: item.barcode } })
        })
        .then( barcodes => {
            // If more than 5 barcodes were found, send 5.
            if( barcodes && barcodes.length > 5){
                fields.checkedIn = barcodes.slice(0, 5);
            } else {
                fields.checkedIn = barcodes;
            }
            return Product
            .find()
        })
        .then( products => {
            fields.product = products.map(product => product.serialize());
            return res.status(HTTP_STATUS_CODES.OK ).json( fields );
        })
        .catch( err => {
            return res.status( HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR ).json({
                message: 'Something went wrong. Please try again'
            })
        });

});

module.exports = { fieldsRouter };
const express = require('express');

const { HTTP_STATUS_CODES } = require('../config');
const { jwtPassportMiddleware } = require('../auth/auth.strategy');

const { Item } = require('../item/item.model');
const { Employee } = require('../employee/employee.model');
const User = require('../user/user.model');
const Users = User.User;

const myAccountRouter = express.Router();

myAccountRouter.get('/:employeeId',
    // jwtPassportMiddleware,
    // Users.hasAccess(User.ACCESS_OVERVIEW),
    (req, res) => {
        let employee;
    return Employee
    .findOne({
        employeeId: req.params.employeeId
    })
    .then( _employee => {
        employee = _employee;
        if( !employee ){
            let err = { code: HTTP_STATUS_CODES.BAD_REQUEST };
            err.message = `Employee ID ${ req.params.employeeId } doesn't exist.`;
            throw err;
        }
        // Employee found. Search employee's current checked-out items.
        return Item
        .find({ $and : [
            { isCheckedOut: true },
            {'checkedOut.0.employee': employee._id },
        ]})
    })
    .then( items => {
        let serializedItems = items.map( item => item.serialize() );
        return res.status( HTTP_STATUS_CODES.OK ).json({ employee, items: serializedItems });
   
    })
    .catch( err => {
        if( !err.message ){
            err.message = 'Something went wrong. Please try again.';
        }
        return res.status( err.code || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json( err );
    })
    




});

module.exports = {
    myAccountRouter
};
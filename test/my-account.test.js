const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const { app, runServer, closeServer } = require('../app/server');
const { TEST_DATABASE_URL, HTTP_STATUS_CODES } = require('../app/config');
const { Item } = require('../app/item/item.model');
const { User } = require('../app/user/user.model');
const { Employee } = require('../app/employee/employee.model');
const { getTestUserToken } = require('./fakeUser');
const { seedItemsDb } = require('./fakeData');

const expect = chai.expect;

// allow us to use chai.request() method
chai.use(chaiHttp);

let jwToken;


function checkResponse( res, statusCode, resType ){
    expect(res).to.have.status(statusCode);
    expect(res).to.be.json;
    expect(res.body).to.be.a(resType);
}

function checkObjectContent( res, userKeys, newUser ){
    expect(res.body).to.include.keys(userKeys);
    userKeys.forEach( function( key ) {
        expect(res.body[key]).to.equal(newUser[key]);
    });
}

function checkArrayContent( res, userKeys ){
    expect(res.body).to.have.lengthOf.at.least(1);
    expect(res.body[0]).to.include.keys(userKeys);
    expect(res.body[0]).to.not.include.keys('password');
}

function tearDownDb(){
    console.warn('Deleting database');
    return mongoose.connection.dropDatabase();
}

describe( 'Users API resource tests', function(){

    before( function(){
        return runServer( TEST_DATABASE_URL )
    });

    beforeEach(function () {
        return seedItemsDb()
            .then(() =>
                getTestUserToken()
            )
            .then(_jwToken => {
                jwToken = _jwToken
            })
    });

    afterEach( function(){
        return tearDownDb();
    });

    after(function(){
        return closeServer();
    });

    it( 'Should return one item checked-out by newEmployee', function(){
        let checkedOutData = {
            date: new Date(Date.now()),
        };
        let newEmployee = {
            firstName: "Name",
            lastName: "Last",
            employeeId: 123456789,
        }
     
        return Employee
            .create(newEmployee)
            .then( employee => {
                checkedOutData.employee = employee.id;
                return Item
                    .find()
            })
            .then( items => {
                // Find an item that is not currently checked-out
                return items.find(item => item.isOnShelf());
            })
            .then(item => {
                item.checkedOut.unshift(checkedOutData);
                return item.save();
            })
            .then( () => {
                return chai.request( app )
                .get( `/api/my-account/${newEmployee.employeeId}` )
                .set("Authorization", `Bearer ${jwToken}`)
            })
            .then(function( res ){
                checkResponse( res, HTTP_STATUS_CODES.OK, 'object' );
                expect(res.body).to.contain.keys("employee", "items");
            })
            .catch( err => console.error(err))
    })
})
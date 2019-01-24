const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const { app, runServer, closeServer } = require('../app/server');
const { TEST_DATABASE_URL, HTTP_STATUS_CODES } = require('../app/config');
const { Department } = require('../app/department/department.model');
const { Employee } = require('../app/employee/employee.model');
const { User } = require('../app/user/user.model');
const { getTestUserToken } = require('./fakeUser');
const { seedItemsDb } = require('./fakeData');

const expect = chai.expect;

// allow us to use chai.request() method
chai.use(chaiHttp);

let jwToken;
const userKeys = ['id', 'email', 'accessLevel', 'department', 'employeeId','firstName', 'lastName'];
const newUserKeys = ['email'];

function checkResponse( res, statusCode, resType ){
    expect(res).to.have.status(statusCode);
    expect(res).to.be.json;
    expect(res.body).to.be.a(resType);
}

function checkObjectContent( res, userKeys, newUser ){
    expect(res).to.include.keys(userKeys);
    userKeys.forEach( function( key ) {
        expect(res[key]).to.equal(newUser[key]);
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

    it( 'Should create a new user', function(){
        let newUser = {
            email: "abc@mail.com",
            password: "test123",
        };
        let newEmployee = {
            firstName: "Name",
            lastName: "Last",
            employeeId: 123456789
        }
        return Department
            .findOne()
        .then( department =>{
            newEmployee.department = department.id;
        
            return Employee
            .create(newEmployee)
        })
            .then( employee => {
                newUser.employeeId = newEmployee.employeeId;
            })
            .then(() => {
                return chai.request( app )
                .post( '/api/user' )
                .set("Authorization", `Bearer ${jwToken}`)
                .send( newUser )
            })
            .then(function( res ){
                checkResponse( res, HTTP_STATUS_CODES.CREATED, 'object' );
                checkObjectContent( res.body, newUserKeys, newUser );
            });
    });

    it( 'Should return all users', function(){
        return chai.request( app )
            .get( '/api/user' )
            .set( "Authorization", `Bearer ${jwToken}` )
            .then(function( res ){
                checkResponse( res, HTTP_STATUS_CODES.OK, 'array' );
                checkArrayContent( res, userKeys );
            });
    });

    it( 'Should return a user by id', function(){
        let user;
        return User
            .findOne()
            .then( _user => {
                user = _user;
                return chai.request( app )
                .get( `/api/user/${user.id}` )
                .set( "Authorization", `Bearer ${jwToken}` )
            })
            .then(function( res ) {
                checkResponse( res, HTTP_STATUS_CODES.OK, 'object' );
                expect( res.body ).to.include.keys( userKeys );
                expect( res.body.id ).to.equal( user.id );
            });
    });

    it( 'Should update a user by id', function(){
        let updateUser = {
            email: "mail@mail.com"            
        }

        return User
            .findOne()
            .then( user => {
                updateUser.id = user.id;
                return chai.request( app )
                    .put( `/api/user/${user.id}` )
                    .set( "Authorization", `Bearer ${jwToken}` )
                    .send( updateUser )
            })
            .then(function( res ){
                checkResponse( res, HTTP_STATUS_CODES.OK, 'object' );
                checkObjectContent( res.body.updated, Object.keys( updateUser ), updateUser );
            })
            .catch(function( err ){
                console.log( err );
            });
    });

    it( 'Should delete user by id', function(){
        let user;
        return User
        .findOne()
        .then( _user => {
            user =_user;
            return chai.request( app )
                .delete( `/api/user/${user.id}` )
                .set( "Authorization", `Bearer ${jwToken}` )
        })
        .then(function( res ){
            checkResponse( res, HTTP_STATUS_CODES.OK, 'object' );
            expect( res.body.deleted ).to.equal( user.id );
        })
        .catch(function( err ){
            console.log( err );
        });
    })


});
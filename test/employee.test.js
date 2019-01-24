const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const { Department } = require('../app/department/department.model');
const { Employee } = require('../app/employee/employee.model');
const { TEST_DATABASE_URL, HTTP_STATUS_CODES } = require('../app/config');
const { app, runServer, closeServer } = require('../app/server');

const { getTestUserToken } = require('./fakeUser');
const { seedItemsDb } = require('./fakeData');

const expect = chai.expect;

// allow us to use chai.request() method
chai.use(chaiHttp);

let jwToken;

const employeeKeys = ["employeeId", "firstName", "lastName"];

function checkResponse(res, statusCode, resType) {
    expect(res).to.have.status(statusCode);
    expect(res).to.be.json;
    expect(res.body).to.be.a(resType);
}

function checkObjectContent( res, employeeKeys, newEmployee ){
    expect(res).to.include.keys(employeeKeys);
    employeeKeys.forEach( function( key ) {
        expect(res[key]).to.equal(newEmployee[key]);
    });
}

function checkArrayContent( res, employeeKeys ){
    expect(res.body).to.have.lengthOf.at.least(1);
    expect(res.body[0]).to.include.keys(employeeKeys);
}

function tearDownDb(){
    console.warn('Deleting database');
    return mongoose.connection.dropDatabase();
}
 
describe( 'Employee API resource tests', function(){

    before( function(){
        return runServer( TEST_DATABASE_URL )
        .then(() => {
            return tearDownDb();
        }        )
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

    after( function(){
        return closeServer();
    });

    it( 'Should create a new employee', function(){
       let newEmployee = {
            firstName: "newEmployee",
            lastName: "lastEmployee",
            employeeId: "123456",
        };

        return Department
        .findOne()
        .then(department => {
            newEmployee.department = department.id
            return chai.request( app )
                .post('/api/employee')
                .set('Authorization', `Bearer ${ jwToken }`)
                .send( newEmployee )
        })
        .then( function( res ){
            checkResponse( res, HTTP_STATUS_CODES.CREATED, 'object' );
            checkObjectContent( res.body.created, employeeKeys, newEmployee );
        })
        .catch( function( err ){
            console.log( err );
        });
    });

    it("Should not create a new employee bc already exists", function(){
        let newEmployee = {
            firstName: "New",
            lastName: "Employee"
        };
        
        return Employee 
        .findOne()
        .then( employee => {
            newEmployee.employeeId = employee.employeeId;
            newEmployee.department = employee.department.id
            return chai.request( app )
                .post('/api/employee')
                .set('Authorization', `Bearer ${ jwToken }`)
                .send(newEmployee)
                .then( function( res ){
                    checkResponse( res, HTTP_STATUS_CODES.BAD_REQUEST, 'object' );
                    expect( res.body ).to.include({message: `An employee with ID ${newEmployee.employeeId} already exists.`});
                })
        })
        .catch( function( err ){
             console.log( err )
        });
    });

    it('Should return all employees', function(){
        return chai.request( app )
            .get('/api/employee')
            .then( function( res ){
                checkResponse( res, HTTP_STATUS_CODES.OK, 'array' );
                checkArrayContent( res, employeeKeys );
            })
            .catch( function( err ){
                console.log( err );
            });
    });

    it('Should return a employee by id', function(){
        
        return Employee
            .findOne()
            .then(function (foundEmployee) {
                return chai.request(app)
                    .get(`/api/employee/${foundEmployee.employeeId}`)
                    .set("Authorization", `Bearer ${jwToken}`)
                })
                .then(function(res) {
                  
                checkResponse(res, HTTP_STATUS_CODES.OK, 'object')
                expect(res.body).to.include.keys(employeeKeys);
            })
            .catch(function (err) {
                console.log(err);
            })
    })

    

    it('Should update employee by employeeId', function () {

        let updateEmployee = {
            lastName: "Update employee"
        }

        return Employee
            .findOne()
            .then(function(foundEmployee) {
                updateEmployee.employeeId = foundEmployee.employeeId;
                return chai.request(app)
                    .put(`/api/employee/${updateEmployee.employeeId}`)
                    .set("Authorization", `Bearer ${jwToken}`)
                    .send(updateEmployee)
            })
            .then(function (res) {
               
                checkResponse(res, HTTP_STATUS_CODES.OK, 'object')
                checkObjectContent(res.body.updated, ['lastName'], updateEmployee);
            })
            .catch(function (err) {
                console.log(err);
            });
    });

    it('Should delete employee by employeeId', function () {
      
        return Employee
            .findOne()
            .then(function (employee) {

                return chai.request(app)
                .delete(`/api/employee/${employee.employeeId}`)
                .set("Authorization", `Bearer ${jwToken}`)
            })
            .then(function (res) {
                checkResponse(res, HTTP_STATUS_CODES.OK, 'object');
                let responseKeys = ["deleted", "OK"];
                expect(res.body).to.include.keys(responseKeys);
            })
            .catch(function( err ) {
                console.log( err );
            });
    });

})
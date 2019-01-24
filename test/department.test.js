const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const { Department } = require('../app/department/department.model');
const { TEST_DATABASE_URL, HTTP_STATUS_CODES } = require('../app/config');
const { app, runServer, closeServer } = require('../app/server');

const { getTestUserToken } = require('./fakeUser');
const { seedItemsDb } = require('./fakeData');

const expect = chai.expect;

// allow us to use chai.request() method
chai.use(chaiHttp);

let jwToken;

const departmentKeys = ["name"];

function checkResponse(res, statusCode, resType) {
    expect(res).to.have.status(statusCode);
    expect(res).to.be.json;
    expect(res.body).to.be.a(resType);
}

function checkObjectContent( res, departmentKeys, newdepartment ){
    expect(res).to.include.keys(departmentKeys);
    departmentKeys.forEach( function( key ) {
        expect(res[key]).to.equal(newdepartment[key]);
    });
}

function checkArrayContent( res, departmentKeys ){
    expect(res.body).to.have.lengthOf.at.least(1);
    expect(res.body[0]).to.include.keys(departmentKeys);
}

function tearDownDb(){
    console.warn('Deleting database');
    return mongoose.connection.dropDatabase();
}
 
describe( 'department API resource tests', function(){

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

    it( 'Should create a new department', function(){
       let newDepartment = {
            name: "newDepartment"
        };
       
        return chai.request( app )
            .post('/api/department')
            .set('Authorization', `Bearer ${ jwToken }`)
            .send( newDepartment )
            .then( function( res ){
                checkResponse( res, HTTP_STATUS_CODES.CREATED, 'object' );
                checkObjectContent( res.body.created, departmentKeys, newDepartment );
            })
            .catch( function( err ){
                console.log( err );
            });
    });

    it("Should not create a new department bc already exists", function(){
        let newDepartment = {};
        
        return Department 
        .findOne()
        .then( department => {
            newDepartment.name = department.name;
        
            return chai.request( app )
                .post('/api/department')
                .set('Authorization', `Bearer ${ jwToken }`)
                .send(newDepartment)
                .then( function( res ){
                    checkResponse( res, HTTP_STATUS_CODES.BAD_REQUEST, 'object' );
                    expect( res.body ).to.include({message: `A department ${newDepartment.name} already exists.`});
                })
        })
        .catch( function( err ){
             console.log( err )
        });
    });

    it('Should return all departments', function(){
        return chai.request( app )
            .get('/api/department')
            .then( function( res ){
                checkResponse( res, HTTP_STATUS_CODES.OK, 'array' );
                checkArrayContent( res, departmentKeys );
            })
            .catch( function( err ){
                console.log( err );
            });
    });

    it('Should return a department by id', function(){
        
        return Department
            .findOne()
            .then(function (foundDepartment) {
                return chai.request(app)
                    .get(`/api/department/${foundDepartment._id}`)
                    .set("Authorization", `Bearer ${jwToken}`)
                })
                .then(function(res) {
                  
                checkResponse(res, HTTP_STATUS_CODES.OK, 'object')
                expect(res.body).to.include.keys("name");
            })
            .catch(function (err) {
                console.log(err);
            })
    })

    

    it('Should update department by departmentId', function () {

        let foundDepartment, updateDepartment;
        updateDepartment = {
            name: "Update department"
        }

        return Department
            .findOne()
            .then(function(_foundDepartment) {
                foundDepartment = _foundDepartment;
                updateDepartment.id = foundDepartment.id;
                return chai.request(app)
                    .put(`/api/department/${updateDepartment.id}`)
                    .set("Authorization", `Bearer ${jwToken}`)
                    .send(updateDepartment)
            })
            .then(function (res) {
                checkResponse(res, HTTP_STATUS_CODES.OK, 'object')
                checkObjectContent(res.body.updated, ["name"], updateDepartment);
            })
            .catch(function (err) {
                console.log(err);
            });
    });

    it('Should delete department by departmentId', function () {
      
        return Department
            .findOne()
            .then(function (department) {

                return chai.request(app)
                .delete(`/api/department/${department._id}`)
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
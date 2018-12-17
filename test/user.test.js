const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const { app, runServer, closeServer } = require('../app/server');
const { TEST_DATABASE_URL, HTTP_STATUS_CODES } = require('../app/config');
const User = require('../app/user/user.model');

const { generateTestUser, generateToken } = require('./fakeUser');

const expect = chai.expect;

// allow us to use chai.request() method
chai.use(chaiHttp);

let testUser, jwToken;
const userKeys = ['id', 'firstName', 'lastName', 'accessLevel', 'levels'];
const newUserKeys = ['firstName', 'lastName', 'username'];
const publicUserKeys = ['id', 'firstName', 'lastName', 'accessLevel', 'levels'];

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

    beforeEach( function(){
        testUser = generateTestUser();
        return generateToken( testUser )
            .then(function( _jwToken ){
                jwToken = _jwToken;
            })
    });

    afterEach( function(){
        return tearDownDb();
    });

    after(function(){
        return closeServer();
    });

    it( 'Should create a new user', function(){
        let newUser = generateTestUser();
        return chai.request( app )
            .post( '/api/user' )
            .send( newUser )
            .then(function( res ){
                checkResponse( res, HTTP_STATUS_CODES.CREATED, 'object' );
                checkObjectContent( res, newUserKeys, newUser );
            });
    });

    it( 'Should return all users', function(){
        return chai.request( app )
            .get( '/api/user' )
            .set( "Authorization", `Bearer ${jwToken}` )
            .then(function( res ){
                checkResponse( res, HTTP_STATUS_CODES.OK, 'array' );
                checkArrayContent( res, publicUserKeys );
            });
    });

    it( 'Should return a user by id', function(){
        let foundUser;
        return chai.request( app )
            .get( '/api/user' )
            .set( "Authorization", `Bearer ${jwToken}` )
            .then( function( res ){
                foundUser = res.body[0];
                return chai.request( app )
                .get( `/api/user/${foundUser.id}` )
                .set( "Authorization", `Bearer ${jwToken}` )
            })
            .then(function( res ) {
                checkResponse( res, HTTP_STATUS_CODES.OK, 'object' );
                expect( res.body ).to.include.keys( userKeys );
                expect( res.body.id ).to.equal( foundUser.id );
            });
    });

    it( 'Should update a user by id', function(){
        let foundUser;
        let updateUser = {
            firstName: "NewName",
            lastName: "OtherName",
            accessLevel: 10
        }

        return chai.request( app )
            .get( '/api/user' )
            .set( "Authorization", `Bearer ${jwToken}` )
            .then(function( res ){
                checkResponse( res, HTTP_STATUS_CODES.OK, 'array' );
                foundUser = res.body[0];
                updateUser.id = foundUser.id;

                return chai.request( app )
                    .put( `/api/user/${updateUser.id}` )
                    .set( "Authorization", `Bearer ${jwToken}` )
                    .send( updateUser )
            })
            .then(function( res ){
                //console.log("UPDATE ", res);
                checkResponse( res, HTTP_STATUS_CODES.OK, 'object' );
                checkObjectContent( res, Object.keys( updateUser ), updateUser );
            })
            .catch(function( err ){
                console.log( err );
            });
    });

    it( 'Should delete user by id', function(){
        let foundUser;

        return chai.request( app )
            .get( '/api/user' )
            .set( "Authorization", `Bearer ${jwToken}` )
            .then(function( res ){
                checkResponse( res, HTTP_STATUS_CODES.OK, 'array' );
                foundUser = res.body[0];
                return chai.request( app )
                    .delete( `/api/user/${foundUser.id}` )
                    .set( "Authorization", `Bearer ${jwToken}` )
            })
            .then(function( res ){
                checkResponse( res, HTTP_STATUS_CODES.OK, 'object' );
                expect( res.body.deleted ).to.equal( foundUser.id );
            })
            .catch(function( err ){
                console.log( err );
            });
        });


});
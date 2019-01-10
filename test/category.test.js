const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const { Category } = require('../app/product/product.model');
const { TEST_DATABASE_URL, HTTP_STATUS_CODES } = require('../app/config');
const { app, runServer, closeServer } = require('../app/server');

const { getTestUserToken } = require('./fakeUser');
const { seedItemsDb } = require('./fakeData');

const expect = chai.expect;

// allow us to use chai.request() method
chai.use(chaiHttp);

let jwToken;

const categoryKeys = ["name"];

function checkResponse(res, statusCode, resType) {
    expect(res).to.have.status(statusCode);
    expect(res).to.be.json;
    expect(res.body).to.be.a(resType);
}

function checkObjectContent( res, categoryKeys, newCategory ){
    expect(res.body).to.include.keys(categoryKeys);
    categoryKeys.forEach( function( key ) {
        expect(res.body[key]).to.equal(newCategory[key]);
    });
}

function checkArrayContent( res, categoryKeys ){
    expect(res.body).to.have.lengthOf.at.least(1);
    expect(res.body[0]).to.include.keys(categoryKeys);
}

function tearDownDb(){
    console.warn('Deleting database');
    return mongoose.connection.dropDatabase();
}
 
describe( 'Category API resource tests', function(){

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

    it( 'Should create a new category', function(){
       let newCategory = {
            name: "newCat"
        };
       
        return chai.request( app )
            .post('/api/category')
            .set('Authorization', `Bearer ${ jwToken }`)
            .send( newCategory )
            .then( function( res ){
                checkResponse( res, HTTP_STATUS_CODES.CREATED, 'object' );
                checkObjectContent( res, categoryKeys, newCategory );
            })
            .catch( function( err ){
                console.log( err );
            });
    });

    it("Should not create a new category bc already exists", function(){
        let newCategory = {};
        
        return Category 
        .findOne()
        .then( category => {
            newCategory.name = category.name;
        
            return chai.request( app )
                .post('/api/category')
                .set('Authorization', `Bearer ${ jwToken }`)
                .send(newCategory)
                .then( function( res ){
                    checkResponse( res, HTTP_STATUS_CODES.BAD_REQUEST, 'object' );
                    expect( res.body ).to.include({message: `A category ${newCategory.name} already exists.`});
                })
        })
        .catch( function( err ){
             console.log( err )
        });
    });

    it('Should return all categories', function(){
        return chai.request( app )
            .get('/api/category')
            .then( function( res ){
                checkResponse( res, HTTP_STATUS_CODES.OK, 'array' );
                checkArrayContent( res, categoryKeys );
            })
            .catch( function( err ){
                console.log( err );
            });
    });

    it('Should return a category by id', function(){
        
        return Category
            .findOne()
            .then(function (foundCategory) {
                return chai.request(app)
                    .get(`/api/category/${foundCategory._id}`)
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

    

    it('Should update category by categoryId', function () {

        let foundCategory, updateCategory;
        updateCategory = {
            name: "Update Category"
        }

        return Category
            .findOne()
            .then(function(_foundCategory) {
                foundCategory = _foundCategory;
                updateCategory.id = foundCategory.id;
                return chai.request(app)
                    .put(`/api/category/${updateCategory.id}`)
                    .set("Authorization", `Bearer ${jwToken}`)
                    .send(updateCategory)
            })
            .then(function (res) {
                checkResponse(res, HTTP_STATUS_CODES.OK, 'object')
                checkObjectContent(res, ["name"], updateCategory);
            })
            .catch(function (err) {
                console.log(err);
            });
    });

    it('Should delete category by categoryId', function () {
      
        return Category
            .findOne()
            .then(function (category) {

                return chai.request(app)
                .delete(`/api/category/${category.id}`)
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
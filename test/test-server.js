const chai = require('chai');
const chaiHttp = require('chai-http');

const { app } = require('../server');

const should = chai.should();
chai.use(chaiHttp);

describe('API', function() {

    it('Should 200 on GET requests', function() {
        return chai.request(app)
            .get('/api/fooo')
            .then(function(res){
                res.should.have.status(200);
                res.should.be.json;
            });
    });
})
const faker = require( 'faker' );
const jsonwebtoken = require( 'jsonwebtoken' );
const mongoose = require( 'mongoose' );
mongoose.Promise = global.Promise;

const { JWT_SECRET, JWT_EXPIRY } = require( '../app/config' );
const {
    User
} = require('../app/user/user.model');

function getTestUserToken(){
    return User.findOne()
    .then( user => {
        return signJwToken( user )
    })
}

function signJwToken( user ){
 
    return jsonwebtoken.sign({
        user: {
            id: user.id,
            employee: user.employee,
            username: user.username,
            accessLevel: user.accessLevel
        }
    },
    JWT_SECRET,
    {
        algorithm: 'HS256',
        expiresIn: JWT_EXPIRY,
        subject: user.username
    }
    );
}
 

module.exports = { getTestUserToken };
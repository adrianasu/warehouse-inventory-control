const passport = require('passport');
// strategies are middleware to authenticate endpoints
// local strategy when user provides username and password
const { Strategy: LocalStrategy } = require('passport-local');
// jwt strategy for other endpoints when user sends only a JWToken
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');

const { User } = require('../user/user.model');
const { JWT_SECRET } = require('../config');

// local strategy used while trying to access an endpoint using user and password
const localStrategy = new LocalStrategy(( username, password, passportVerify ) => {
    let user;
    //verify that the username exists
    User
        .findOne({ username: username })
        .then(_user => {
            user = _user;
            if( !user ){
                return Promise.reject({
                    reason: 'Login Error',
                    message: 'Incorrect username or password'
                });
            }
            // username found. Compare password against the hashed password stored
            // by using the validatePassword method created at the user.model module
            return user.validatePassword(password);
        })
        .then(isValid => {
            if( !isValid ){
                return Promise.reject({
                    reason: 'Login Error',
                    message: 'Incorrect username or password'
                })
            }
            // succesfull authentication. Supply Passport with the authenticated user
            return passportVerify(null, user);
        })
        .catch(error => {
            // execute the passportVerify callback correctly if an error occurred
            if( error.reason === 'LoginError' ){
                return passportVerify(null, false, error);
            }
            return passportVerify(error, false);
        });
});

// jwtStrategy is used when trying to access an endpoint using a JSON web token
const jwtStrategy = new JwtStrategy({
        secretOrKey: JWT_SECRET,
        jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("Bearer"),
        algorithms: ['HS256']
    },
    (token, done) => {
        done(null, token.user);
    }
);

// middleware
const localPassportMiddleware = passport.authenticate('local', { session: false });
const jwtPassportMiddleware = passport.authenticate('jwt', { session: false });

module.exports = {
    localStrategy, jwtStrategy, localPassportMiddleware, jwtPassportMiddleware
};
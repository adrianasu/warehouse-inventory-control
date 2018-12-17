"use strict";
exports.DATABASE_URL =
     process.env.DATABASE_URL || 'mongodb://localhost/warehouse-app';

exports.TEST_DATABASE_URL =
    process.env.DATABASE_URL || 'mongodb://localhost/warehouse-app';
 
exports.PORT = process.env.PORT || 3000;

exports.CLIENT_ORIGIN = 'http://localhost:3000';

exports.HTTP_STATUS_CODES = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500
}
exports.JWT_SECRET = process.env.JWT_SECRET || 'default';
exports.JWT_EXPIRY = '20d';
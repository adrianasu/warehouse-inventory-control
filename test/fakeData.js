const faker = require('faker');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const { Item, Employee, Department } = require('../app/item/item.model');
const { Product, Category, Manufacturer } = require('../app/product/product.model');
const { User, ACCESS_ADMIN } = require('../app/user/user.model');

function getRandomFromArray( arr ) {
    return arr[ Math.floor( Math.random() * arr.length )];
}

function generateCheck( employeeIds, checkedOut ){
    const status = ["in-use", "lost", "stolen", "broken"];
    let check = {
        employee: getRandomFromArray( employeeIds ),
        barcode: faker.random.number( 99999 ),
        date: faker.date.past()
    }
    if( checkedOut ){
        check.status = getRandomFromArray( status );
    }
    return check;
}

function generateWarehouseArray(){
    let arr = [];
    for (let x = 0; x < 3; x++) {
        arr.push(faker.address.city());
    }
    return arr;
}

function generateLocation( warehouses ){
    let alphab = 'abcdefghijklmnopqrstuvwxyz';
  
    return {
        warehouse: getRandomFromArray( warehouses ),
        aisle: alphab.charAt(Math.floor(Math.random()* alphab.length)).toUpperCase(),
        shelf: faker.random.number(4),
        bin: faker.random.number(10)
    }
}

function generateOneItem( employeeIds, productIds, warehouses ) {
    let itemCondition = ['New', 'Used'];
    return {
        product: getRandomFromArray(productIds),
        barcode: faker.random.number(100000), // number between 0 and 1000
        serialNumber: faker.random.number(100000),
        registered: {
            date: faker.date.past(),
            condition: getRandomFromArray(itemCondition)
        },
        checkedOut: generateCheck( employeeIds, "out" ),
        checkedIn: generateCheck( employeeIds ),
        location: generateLocation(warehouses)
    }
}

function generateOneProduct( categoryIds, manufacturerIds ) {
    return {
        name: faker.commerce.productName(),
        category: getRandomFromArray(categoryIds),
        manufacturer: getRandomFromArray(manufacturerIds),
        model: faker.random.alphaNumeric(7),
        consummable: faker.random.boolean(),
        minimumRequired: {
            quantity: faker.random.number(5),
            units: "pieces"
        }
    }
}

function generateManufacturers() {
    let arr = [];
    for( let x=0; x < 5; x++ ){
        arr.push({ name: faker.company.companyName() });
    }
    return arr;
}

function generateCategories(userIds) {
    let arr = [];
    for (let x = 0; x < 5; x++) {
        arr.push({
            name: faker.commerce.department(),
            addedBy: getRandomFromArray(userIds)
        });
    }
    return arr;
}

function generateDepartments(){
    let departments = [];
    for (let x = 0; x < 5; x++) {
        departments.push({
            departmentName: faker.name.jobArea()
        });
    }
    return departments;
}

function generateEmployees( departmentIds ){
     let employees = [];
     for (let x = 0; x < 5; x++){
         employees.push({
            employeeId: faker.random.number(999999),
            firstName: faker.name.firstName(),
            lastName: faker.name.lastName(),
            department: getRandomFromArray(departmentIds)
         });
    }
    return employees;
}

function generateOneUser(userAccessLevel = ACCESS_ADMIN) {
    return {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        username: faker.internet.userName(),
        password: faker.internet.password(),
        accessLevel: userAccessLevel
    };
}

function generateUsers(){
    let users = [];
    for (let x = 0; x < 10; x++) {
        users.push(generateOneUser());
    }
    return users;
}

function seedItemsDb(){
    let manufacturerIds, categoryIds, departmentIds, employeeIds, userIds, productIds;
    let users = generateUsers();
    let departments = generateDepartments();
  

    return User
        .insertMany(users)
        .then(_userIds => {
            userIds =_userIds;
         
            return Department.insertMany(departments)
        })
        .then(_departmentIds => {
            departmentIds = _departmentIds;
          
            return Employee.insertMany(generateEmployees(departmentIds))
        })
        .then(_employeeIds => {
            employeeIds = _employeeIds;
          
            return Manufacturer.insertMany(generateManufacturers())
        })
        .then(_manufacturerIds => {
            manufacturerIds = _manufacturerIds;
  
            return Category.insertMany(generateCategories(userIds))
        })
        .then(_categoryIds => {
            let products = [];
            categoryIds = _categoryIds;
            for (let x = 0; x < 15; x++) {
                products.push(generateOneProduct(categoryIds, manufacturerIds));
            }
         
            return Product.insertMany(products);
        })
        .then(_productIds => {
            let items = [];
            productIds = _productIds;
            let warehouses = generateWarehouseArray();
            for( let x=0; x<40; x++ ){
                items.push(generateOneItem(employeeIds, productIds, warehouses));
            }
            console.log('Generating database');
            return Item.insertMany(items);
        })
        .catch( err => {
            console.log("Error here: ", err)});
}

module.exports = {
    seedItemsDb
}
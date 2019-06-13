'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();


const usedTokens = new Set();

const users = new mongoose.Schema({
  username: {type:String, required:true, unique:true},
  password: {type:String, required:true},
  email: {type: String},
  role: {type: String, default:'user', enum: ['admin','editor','user']},
});

users.pre('save', function(next) {
  bcrypt.hash(this.password, 10)
    .then(hashedPassword => {
      this.password = hashedPassword;
      next();
    })
    .catch(console.error);
});

users.statics.createFromOauth = function(email) {

  if(! email) { return Promise.reject('Validation Error'); }

  return this.findOne( {email} )
    .then(user => {
      if( !user ) { throw new Error('User Not Found'); }
      console.log('Welcome Back', user.username);
      return user;
    })
    .catch( error => {
      console.log('Creating new user');
      let username = email;
      let password = 'none';
      return this.create({username, password, email});
    });

};

users.statics.authenticateBasic = function(auth) {
  let query = {username:auth.username};
  return this.findOne(query)
    .then( user => user && user.comparePassword(auth.password) )
    .catch(error => {throw error;});
};

users.statics.authenticateBearer = function(token){
  if(usedTokens.has(token)){
    return Promise.reject('Invalid token');
  }
  let parsedToken = jwt.verify(token, process.env.SECRET);
  parsedToken.type !== 'key' && usedTokens.add(token);

  let query = {_id: parsedToken.id};
  return this.findOne(query);
};

//eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVkMDE3NGE5NmEyNzBmZjg2MzYxODcxMSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTU2MDM3NjQ5MH0.LqL8L7kPcn7TkaC9Yzq-e38hkUFfHx6N8m4TNRVit9M

users.methods.comparePassword = function(password) {
  return bcrypt.compare( password, this.password )
    .then( valid => valid ? this : null);
};

users.methods.generateToken = function() {
  
  let token = {
    id: this._id,
    role: this.role,
  };
  
  return jwt.sign(token, process.env.SECRET);
};

module.exports = mongoose.model('users', users);

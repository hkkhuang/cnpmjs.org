/*!
 * cnpmjs.org - controllers/registry/user.js
 *
 * Copyright(c) cnpmjs.org and other contributors.
 * MIT Licensed
 *
 * Authors:
 *  dead_horse <dead_horse@qq.com>
 *  fengmk2 <fengmk2@gmail.com> (http://fengmk2.github.com)
 */

'use strict';

/**
 * Module dependencies.
 */

var debug = require('debug')('cnpmjs.org:controllers:registry');
var logger = require('../../common/logger');
var User = require('../../proxy/user');

exports.show = function (req, res, next) {
  var name = req.params.name || '';
  name = name.split(':')[1];
  User.get(name, function (err, row) {
    if (err) {
      return next(err);
    }
    if (!row) {
      return next();
    }

    res.setHeader('etag', '"' + row.rev + '"');
    var data = {
      _id: 'org.couchdb.user:' + row.name,
      _rev: row.rev,
      name: row.name,
      email: row.email,
      type: 'user',
      roles: [],
      date: row.gmt_modified,
    };
    res.json(data);
  });
};

// json:
//  { name: 'fengmk2',
//    salt: 'f95a3f750bc29b7312bc6bd35622f07785c7e10b97b860b3662d700f3f5b',
//    password_sha: 'ccd48f7cdddb5a96647e5f9002b7398e2d5f0f23',
//    email: 'fengmk2@gmail.com',
//    _id: 'org.couchdb.user:fengmk2',
//    type: 'user',
//    roles: [],
//    date: '2013-12-04T12:56:13.714Z' } }
exports.add = function (req, res, next) {
  var name = req.params.name || '';
  name = name.split(':')[1];
  if (!name) {
    return next();
  }

  var body = req.body || {};
  var user = {
    name: body.name,
    salt: body.salt,
    password_sha: body.password_sha,
    email: body.email,
    ip: req.socket && req.socket.remoteAddress || '0.0.0.0',
    // roles: body.roles || [],
  };
  if (!user.name || !user.salt || !user.password_sha || !user.email) {
    return res.json(422, {
      error: 'paramError',
      reason: 'params missing'
    });
  }
  debug('add user: %j', user);
  User.get(name, function (err, row) {
    if (err) {
      return next(err);
    }
    if (row) {
      return res.json(409, {
        error: 'conflict',
        reason: 'Document update conflict.'
      });
    }

    User.add(user, function (err, result) {
      if (err) {
        return next(err);
      }
      res.setHeader('etag', '"' + result.rev + '"');
      // location: 'http://registry.npmjs.org/_users/org.couchdb.user:cnpmjstest1',
      res.json(201, {
        ok: true,
        id: 'org.couchdb.user:' + name,
        rev: result.rev
      });
    });
  });
};

exports.authSession = function (req, res, next) {
  // body: {"name":"foo","password":"****"}
  var body = req.body || {};
  var name = body.name;
  var password = body.password;
  debug('authSession %j', body);
  User.auth(name, password, function (err, user) {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.json(401, {ok: false, name: null, roles: []});
    }

    req.session.name = user.name;
    res.json(200, {ok: true, name: user.name, roles: []});
  });
};

exports.upload = function (req, res, next) {
  var name = req.params.name || '';
  name = name.split(':')[1];
  var rev = req.params.rev;
  if (!name || !rev) {
    return next();
  }

  debug('upload: %s, rev: %s, session.name: %s', name, rev, req.session.name);

  if (name !== req.session.name) {
    // must authSession first
    res.statusCode = 401;
    return res.json({
      error: 'unauthorized',
      reason: 'Name is incorrect.'
    });
  }

  var body = req.body || {};

  var user = {
    name: body.name,
    salt: body.salt,
    password_sha: body.password_sha,
    email: body.email,
    ip: req.socket && req.socket.remoteAddress || '0.0.0.0',
    rev: body.rev || body._rev,
    // roles: body.roles || [],
  };
  User.update(user, function (err, result) {
    if (err) {
      return next(err);
    }
    res.json(201, {
      ok: true,
      id: 'org.couchdb.user:' + user.name,
      rev: result.rev
    });
  });
};

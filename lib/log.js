/*
 * willitmerge log
 * https://github.com/shama/willitmerge
 *
 * Copyright (c) 2012 Kyle Robinson Young
 * Licensed under the MIT license.
 */
'use strict';

var colors = require('colors');

var log = module.exports = {
  write: function(msg) {
    process.stdout.write(msg || '');
    return this;
  },
  writeln: function(msg) {
    return this.write((msg || '') + '\n');
  },
  error: function(msg) {
    msg = msg || '';
    return this.writeln('>> '.red + msg.replace(/\n/g, '\n>> '.red));
  },
  ok: function(msg) {
    msg = msg || '';
    return this.writeln('>> '.green + msg.replace(/\n/g, '\n>> '.green));
  },
  success: function(msg) {
    return this.writeln(msg.green);
  },
  fail: function(msg) {
    return this.writeln(msg.red);
  }
};
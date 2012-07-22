'use strict';

var wim = require('../lib/willitmerge');

var oldStdout;

exports['willitmerge'] = {
  setUp: function(done) {
    oldStdout = process.stdout.write;
    process.stdout.write = function(msg) {};
    done();
  },
  tearDown: function(done) {
    process.stdout.write = oldStdout;
    done();
  },
  'get current user and repo': function(test) {
    test.expect(2);
    var oldFunc = wim.getIssues;
    wim.getIssues = function() {
      test.equal(this.options.user, 'shama');
      test.equal(this.options.repo, 'willitmerge');
      wim.getIssues = oldFunc;
      test.done();
    };
    wim.run();
  }
};

'use strict';

var wim = require('../lib/willitmerge');
var grunt = require('grunt');

var oldStdout;

exports['willitmerge'] = {
  setUp: function(done) {
    oldStdout = process.stdout.write;
    process.stdout.write = function(msg) {};
    done();
  },
  tearDown: function(done) {
    process.stdout.write = oldStdout;
    wim.onEnd();
    done();
  },
  'find remote, user and repo': function(test) {
    test.expect(3);
    wim.findRemote(function(err, remote) {
      test.equal(remote, 'origin');
      test.equal(wim.options.user, 'shama');
      test.equal(wim.options.repo, 'willitmerge');
      test.done();
    });
  },
  'get issues from github': function(test) {
    test.expect(1);
    wim.options.repo = 'Hello-World';
    wim.options.user = 'octocat';
    wim.options.perpage = 1;
    wim.once('issues', function(issues) {
      test.ok(issues.length === 1);
      test.done();
    });
    wim.getIssues();
  },
  'test issues': function(test) {
    test.expect(2);
    var fixture = grunt.file.readJSON('test/fixtures/issues.json');
    wim.once('end', function(issues) {
      test.equal(issues[0].willitmerge.status, 'success');
      test.equal(issues[0].willitmerge.impact, 0);
      test.done();
    });
    wim.testIssues(fixture);
  }
};

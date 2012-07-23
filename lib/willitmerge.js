/*
 * willitmerge
 * https://github.com/shama/willitmerge
 *
 * Copyright (c) 2012 Kyle Robinson Young
 * Licensed under the MIT license.
 */
'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var path = require('path');
var fs = require('fs');
var exec = require('child_process').exec;

var _ = require('lodash');
var async = require('async');
var request = require('request');
var GitHubApi = require('github');

// private globals
var github = new GitHubApi({version: '3.0.0', debug: false});
var isAuthed = false;
var origBranch = 'master';

// willitmerge
var willitmerge = module.exports = new EventEmitter();

// defaults
willitmerge.options = {
  user: '',
  repo: '',
  ignore: [],
  tmp: '',
  remote: '',
  branchPrepend: 'willitmerge-',
  page: 0,
  perpage: 30
};

// add additional libs
willitmerge.file = require('./file');
willitmerge.log = require('./log');

// onError - hard error
willitmerge.onError = function(err) {
  this.log.error(err.message);
  this.emit('end', []);
};

// run the command
willitmerge.run = function(opts) {
  var that = this;
  
  this.options = _.defaults(opts || {}, this.options);
  isAuthed = !_.isEmpty(this.options.auth);

  // default tmp dir
  if (_.isEmpty(this.options.tmp)) {
    this.options.tmp = path.join(process.cwd(), '_tmp') + path.sep;
  }

  // find remote, user and repo then get going
  this.findRemote(function(err, remote) {
    that.getIssues();
  });
};

// find remote, user and repo if not specified
willitmerge.findRemote = function(done) {
  var that = this;
  var remotes = ['upstream', 'origin'];
  if (!_.isEmpty(this.options.remote)) {
    remotes = [this.options.remote];
  }
  async.forEachSeries(remotes, function(remote, next) {
    exec('git remote show -n ' + remote, function(err, stdout, stderr) {
      var found = /.*github\.com[:\/](.*\/.*)/i.exec(stdout);
      if (found) {
        var res = found[1]
          .replace('.git', '')
          .split('/')
        ;
        that.options.remote = remote;
        if (_.isEmpty(that.options.user)) {
          that.options.user = res[0];
        }
        if (_.isEmpty(that.options.repo)) {
          that.options.repo = res[1];
        }
        done(null, remote);
      }
      next();
    });
  }, function() {
    done(new Error('A valid remote source could not be found.'));
  });
};

// search github for open repo issues
willitmerge.getIssues = function() {
  var that = this;
  var msg = {
    user: that.options.user,
    repo: that.options.repo,
    state: 'open',
    page: that.options.page,
    per_page: that.options.perpage
  };
  github.pullRequests.getAll(msg, function githubRepoIssues(err, issues) {
    if (err) {
      throw new Error('Unable to retrieve issues from that github.com/' + msg.user + '/' + msg.repo);
    }
    that.emit('issues', issues);
  });
};

// when we get issues, test them
willitmerge.testIssues = function(issues) {
  var that = this;
  var testedIssues = [];
  var where = 'github.com/' + this.options.user + '/' + this.options.repo;

  // filter out bogus
  issues = _.filter(issues, function(iss) {
    return _.has(iss || {}, 'number');
  });

  // quit if no prs
  if (issues.length < 1) {
    this.log.writeln('Found 0 open pull requests on ' + where + '.');
    this.emit('end', []);
  }

  this.log
    .writeln('Found ' + issues.length + ' open pull requests on ' + where + '.')
    .write('Checking')
  ;

  // create tmp folder
  that.file.mkdir(that.options.tmp);

  async.series([
    function isValidGitRepo(next) {
      exec('git status', function(err, stdout, stderr) {
        if (err || stderr) {that.emit('error', new Error(err || stderr));}
        next();
      });
    },
    function getOrigBranch(next) {
      exec('git branch', function(err, stdout, stderr) {
        if (err || stderr) {that.emit('error', new Error(err || stderr));}
        _.invoke(stdout.split('\n'), 'trim').forEach(function(branch) {
          if (branch.substr(0, 2) === '* ') {
            origBranch = branch.substr(2);
          }
        });
        next();
      });
    },
    function fetchOrigin(next) {
      exec('git fetch ' + that.options.remote, function(err, stdout, stderr) {
        next();
      });
    },
    function willIssuesMerge(next) {
      async.forEach(issues, function(iss, n) {

        that.testIssue(iss, function(err, testedIssue) {
          if (err) {n(err);}
          testedIssues.push(testedIssue);
          n();
        });

      }, function(err) {
        if (err) {next(err);}
        next();
      });
    }
  ], function doneTestingIssues(err, result) {
    if (err) {
      that.log.error(err.message);
    }
    that.log.writeln('DONE'.cyan).writeln();
    that.emit('end', testedIssues);
  });
};

// test an issue
willitmerge.testIssue = function(iss, done) {
  var that = this;

  // issue skipped
  if (_.indexOf(that.options.ignore, Number(iss.number)) !== -1) {
    iss.willitmerge = {
      status: 'skipped',
      msg: '',
      impact: 0
    };
    that.log.write('.'.cyan);
    return done(null, iss);
  }

  var branch = this.options.branchPrepend + iss.number;
  var patch = path.join(that.options.tmp, iss.number + '.patch');

  async.series([
    function checkoutBranch(next) {
      // we really want to goto that branch and ignore errors
      var cmd = 'git checkout -b ' + branch + ' ' + that.options.remote + '/' + iss.base.ref +
        ' && git checkout ' + branch;
      exec(cmd, function(err, stdout, stderr) {next();});
    },
    function downloadAndApplyPatch(next) {
      request(iss.patch_url)
        .on('end', function() {

          var cmd = 'git apply --check --stat ' + patch;
          exec(cmd, function execCommand(err, stdout, stderr) {
            if (stderr) {
              // could not merge
              iss.willitmerge = {
                status: 'failed',
                msg: stderr,
                impact: 0
              };
              that.log.write('.'.red);
            } else {
              // successfully merged
              iss.willitmerge = {
                status: 'success',
                msg: stdout,
                impact: that.parseImpact(stdout)
              };
              that.log.write('.'.green);
            }
            next();
          });

        })
        .on('error', function(err) {next(err);})
        .pipe(fs.createWriteStream(patch))
      ;
    }
  ], function doneTestingIssue(err, result) {
    if (err) {done(err);}
    done(null, iss);
  });
};

// parse out the insertions + deletions
willitmerge.parseImpact = function(data) {
  var impact = /([0-9]+) insertions\(\+\), ([0-9]+) deletions\(\-\)/i.exec(data);
  if (impact) {
    return Number(impact[1]) + Number(impact[2]);
  }
  return 0;
};

// display report on issues
willitmerge.reportIssues = function(issues) {
  var that = this;
  issues = _.sortBy(issues, function(iss) {
    return iss.willitmerge.impact;
  });
  issues.forEach(function(iss) {
    if (iss.willitmerge.status === 'skipped') {
      that.log
        .writeln('Issue #' + iss.number + ', ' + iss.html_url + ', has been ' + 'SKIPPED'.cyan)
        .writeln()
      ;
    } else {
      that.log.write('Issue #' + iss.number + ', ' + iss.html_url + ', will it merge? ');
      if (iss.willitmerge.status === 'success') {
        that.log
          .success('YES!')
          .writeln(iss.head.label + ' -> ' + iss.base.label)
          .writeln(iss.willitmerge.msg)
        ;
      } else {
        that.log
          .fail('NO!')
          .writeln(iss.head.label + ' -> ' + iss.base.label)
          .error(iss.willitmerge.msg)
          .writeln()
        ;
      }
    }
  });
};

// when its over
// never emit an error here
willitmerge.onEnd = function(issues) {
  var that = this;

  if (issues.length < 1) {
    process.exit(0);
  }

  this.reportIssues(issues);

  async.series([
    function backToOrigBranch(next) {
      exec('git checkout ' + origBranch, function(err, stdout, stderr) {
        next();
      });
    },
    function cleanUpBranches(next) {
      exec('git branch', function(err, stdout, stderr) {
        if (err || stderr) {next(new Error(err || stderr));}
        _.invoke(stdout.split('\n'), 'trim').forEach(function(branch) {
          if (branch.indexOf(that.options.branchPrepend) !== -1) {

            // delete branch
            exec('git branch -D ' + branch, function(err, stdout, stderr) {
              if (err || stderr) {next(new Error(err || stderr));}
              next();
            });

          }
        });
      });
    }
  ], function onEndIsDone(err, result) {
    if (err) {throw err;}

    // delete tmp folder
    if (path.dirname(that.options.tmp) === process.cwd()) {
      that.file.rmdir(that.options.tmp);
    }

    process.exit(0);
  });
};

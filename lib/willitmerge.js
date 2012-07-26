/*
 * willitmerge
 * https://github.com/shama/willitmerge
 *
 * Copyright (c) 2012 Kyle Robinson Young
 * Licensed under the MIT license.
 */
'use strict';

var EventEmitter = require('events').EventEmitter;
var exec = require('child_process').exec;

var _ = require('lodash');
var async = require('async');
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
  remote: '',
  prepend: 'willitmerge-',
  page: 0,
  perpage: 30,
  rebase: false,
  verbose: false
};

// add additional libs
willitmerge.log = require('./log');

// run the command
willitmerge.run = function(opts) {
  var that = this;
  
  this.options = _.defaults(opts || {}, this.options);
  isAuthed = !_.isEmpty(this.options.auth);

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
        return false;
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
    return false;
  }

  async.series([
    function validateGitStatus(next) {
      execSeries([
        'git status',
        'git fetch ' + that.options.remote
      ], function(err, result) {
        var status = result[0].stdout;

        // avoid killing uncommitted changes, just in case
        if (/changed but not updated|changes to be committed/i.test(status)) {
          throw new Error('Please commit or stash your changes before running willitmerge.');
          return false;
        }

        // get original branch
        var found = /# on branch (.*)/i.exec(status);
        if (!found) {
          throw new Error('Could not determine the current branch. Is this a git repo?');
          return false;
        }
        origBranch = found[1];

        next();
      });
    },
    function willIssuesMerge(next) {
      that.log
        .writeln('Found ' + issues.length + ' open pull requests on ' + where + '.')
        .write('Checking')
      ;
      async.forEachSeries(issues, function(iss, n) {
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
    } else {
      that.log.writeln('DONE'.cyan).writeln();
    }
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

  var branch = this.options.prepend + iss.number;

  var cmds = [
    'git checkout -b ' + branch + ' ' + that.options.remote + '/' + iss.base.ref,
    'git remote add ' + branch + ' ' + iss.head.repo.git_url,
    'git pull ' + branch + ' ' + iss.head.ref,
    'git reset --merge HEAD',
    'git checkout ' + origBranch,
    'git branch -D ' + branch,
    'git remote rm ' + branch,
  ];
  if (that.options.rebase) {
    cmds.splice(2, 2,
      'git pull --rebase ' + branch + ' ' + iss.head.ref,
      'git rebase --abort'
    );
  }

  execSeries(cmds, function(err, results) {
    var stdout = results[2].stdout;
    if (stdout.indexOf('CONFLICT') !== -1) {
      // could not merge
      iss.willitmerge = {
        status: 'failed',
        msg: stdout,
        impact: 0
      };
      that.log.write('.'.red);
    } else {
      // successfully merged
      iss.willitmerge = {
        status: 'success',
        msg: stdout,
        impact: parseImpact(stdout)
      };
      that.log.write('.'.green);
    }
    done(null, iss);
  });
};

// display report on issues
willitmerge.reportIssues = function(issues) {
  var that = this;
  issues = _.sortBy(issues, function(iss) {
    return iss.willitmerge.impact;
  });
  issues.forEach(function(iss) {
    if (iss.willitmerge.status === 'skipped') {
      that.log.writeln('Issue #' + iss.number + ', ' + iss.html_url + ', has been... ' + 'SKIPPED'.cyan);
      if (that.options.verbose) {
        that.log.writeln();
      }
    } else {
      that.log.write('Issue #' + iss.number + ', ' + iss.html_url + ', will it merge? ');
      if (iss.willitmerge.status === 'success') {
        that.log.success('YES!');
        if (that.options.verbose) {
          that.log
            .writeln(iss.head.label + ' -> ' + iss.base.label)
            .writeln(iss.willitmerge.msg)
          ;
        }
      } else {
        that.log.fail('NO!');
        if (that.options.verbose) {
          that.log
            .writeln(iss.head.label + ' -> ' + iss.base.label)
            .error(iss.willitmerge.msg)
            .writeln()
          ;
        }
      }
    }
  });
};

// when its over
willitmerge.onEnd = function(issues) {
  if (issues && issues.length > 0) {
    this.reportIssues(issues);
  }
};

// exec commands in a series and retun the results
function execSeries(cmds, done) {
  var out = [];
  async.forEachSeries(cmds, function(cmd, next) {
    exec(cmd, function(err, stdout, stderr) {
      out.push({
        stdout: stdout,
        stderr: stderr,
        err: err
      });
      next();
    });
  }, function() {
    done(null, out);
  });
}

// parse the insertions + deletions
function parseImpact(data) {
  var impact = /([0-9]+) insertions\(\+\), ([0-9]+) deletions\(\-\)/i.exec(data);
  if (impact) {
    return Number(impact[1]) + Number(impact[2]);
  }
  return 0;
}

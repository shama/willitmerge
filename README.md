# willitmerge

A command line tool to check if pull requests are mergeable.

```
$ willitmerge
Found 8 open pull requests on github.com/cakephp/docs.
Checking........DONE

Issue #376, https://github.com/cakephp/docs/pull/376, will it merge? NO!
Issue #272, https://github.com/cakephp/docs/pull/272, will it merge? NO!
Issue #212, https://github.com/cakephp/docs/pull/212, will it merge? NO!
Issue #209, https://github.com/cakephp/docs/pull/209, will it merge? NO!
Issue #207, https://github.com/cakephp/docs/pull/207, will it merge? YES!
Issue #223, https://github.com/cakephp/docs/pull/223, will it merge? YES!

$ willitmerge --rebase
Found 7 open pull requests on github.com/cowboy/grunt.
Checking.......DONE

Issue #413, https://github.com/cowboy/grunt/pull/413, will it rebase? YES!
Issue #405, https://github.com/cowboy/grunt/pull/405, will it rebase? YES!
Issue #404, https://github.com/cowboy/grunt/pull/404, will it rebase? YES!
Issue #399, https://github.com/cowboy/grunt/pull/399, will it rebase? YES!
Issue #395, https://github.com/cowboy/grunt/pull/395, will it rebase? YES!
Issue #363, https://github.com/cowboy/grunt/pull/363, will it rebase? YES!
Issue #350, https://github.com/cowboy/grunt/pull/350, will it rebase? YES!
```

## Install

Install with `npm install -g willitmerge`

## Usage

Navigate to the project folder you would like to check then run: `willitmerge`.
This will then look for the remote: upstream or origin in that order. Then
proceeds to check if each open pull request can be merged. Please note, this
will not actually do any merging... only checks.

### Options

```
$ willitmerge --help

  Usage: willitmerge [options]

  Options:

    -h, --help             output usage information
    -r, --remote <remote>  name of remote source eg origin, upstream
    --ignore <ignore>      list of issue #s to ignore eg 120,234,300
    --perpage <perpage>    number of issues to check at a time, max is 100
    --page <page>          page when using perpage pagination
    --rebase               rebase instead of merge
    -v, --verbose          display output of merge attempts
    -V, --version          output the version number

```

## API

To use willitmerge in your project:

``` javascript
var wim = require('willitmerge');

// This event is fired after issues have been received from github
wim.once('issues', function(issues) {
  // To test all the issues if they will merge then fire the `end` event
  wim.testIssues(issues);

  // or if you would like to write your own mechanism and test
  // each issue individually use:
  wim.testIssue(issue, function(err, iss) { });
});

// This event is fired after issues have been tested
wim.once('end', function(issues) {
  // `willitmerge` will be appended to each issue with the info about the test

  // Call to display the issues report, clean up and end the program
  wim.onEnd(issues);
});

// run the program
wim.run({
  perpage: 40 // set options here
});
```

## Contributing

This project uses [Grunt](http://gruntjs.com) for development. Please install
and run `grunt` before submitting a pull request. Thanks!

## Release History

* 0.2.1 Check for invalid github urls
* 0.2.0 Refactor to use git pull and --rebase instead of applying patches
* 0.1.2 Add perpage, page options.
* 0.1.1 Order PRs by least amount changed
* 0.1.0 Built willitmerge tool from grunt-willitmerge

## License

Copyright (c) 2012 Kyle Robinson Young

Licensed under the MIT license.

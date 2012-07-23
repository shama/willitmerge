# willitmerge

A command line tool to check if pull requests are mergeable.

![willitmerge sample](http://dontkry.com/img/willitmerge.png)

## Install

Install with `npm install -g willitmerge`

## Usage

Navigate to the project folder you would like to check then run: `willitmerge`.

This will then look for the remote: upstream or origin in that order. Then
proceeds to check if each open pull request can be merged.

Please note, this will not actually do any merging... only checks.

### Options

#### -r, --remote

Override the default remote source lookup eg: `willitmerge --remote myremote`.

#### --ignore

List of github issue numbers to ignore eg: `willitmerge --ignore 123,240,300`.

#### --perpage & --page

For paginating through issues. Default is 30 per page and the max is 100 (set
by github). eg `willitmerge --perpage 100 --page 2`.

## Contributing

This project uses [Grunt](http://gruntjs.com) for development. Please install
and run `grunt` before submitting a pull request. Thanks!

## Release History

* 0.1.2 Add perpage, page options.
* 0.1.1 Order PRs by least amount changed
* 0.1.0 Built willitmerge tool from grunt-willitmerge

## License

Copyright (c) 2012 Kyle Robinson Young

Licensed under the MIT license.

## Install

Install [NodeJs](https://nodejs.org/)

Install [Gulp](http://gulpjs.com/)

    npm install -g gulp

Install depedencies

    npm install

## Development

Edit source in `/src`, NEVER in `/dist`.

### Build and watch

    gulp

### Build

    gulp build

### Watch

    gulp watch

### Release

Bump version, create tag, push on Github, post a ZIP file and scripts on Github
pages branch, publish on NPM.

    gulp release --[major,minor,patch,prerelease]

### Add/modify icons of the toolbar

Add or replace a SVG file in the `/src/svg`folder, then:

    gulp icons
    gulp build

/* global require, process */
/* jshint laxbreak:true */

(function () {
    'use strict';

    var pkg     = require('./package.json'),
        del     = require('del'),
        yargs   = require('yargs'),
        fs      = require('fs'),
        exec    = require('child_process').exec,
        spawn   = require('child_process').spawn,
        gulp    = require('gulp'),
        plugins = require('gulp-load-plugins')(),
        gutil   = require('gulp-util'),
        sync    = require('gulp-sync')(gulp).sync;

    var argv = yargs
        .default('major',      false)
        .default('minor',      false)
        .default('patch',      true)
        .default('prerelease', false)
        .default('dev',        false)
        .boolean([ 'major', 'minor', 'patch', 'prerelease', 'dev' ])
        .argv;

    var settings = {
        name: 'markitup',
        banner: {
            content: [
                '/*!-----------------------------------------------------------------------------',
                ' * MarkItUp! — Boost your textareas',
                ' * v<%= pkg.version %> - built <%= datetime %>',
                ' * Licensed under the MIT License.',
                ' * http://<%= pkg.name %>.jaysalvat.com/',
                ' * ----------------------------------------------------------------------------',
                ' * Copyright (C) 2007-<%= year %> Jay Salvat',
                ' * http://jaysalvat.com/',
                ' * --------------------------------------------------------------------------*/',
                ''
            ].join('\n'),
            vars: {
                pkg: pkg,
                datetime: gutil.date('yyyy-mm-dd'),
                year: gutil.date('yyyy')
            }
        }
    };

    var getPackageJson = function () {
        return JSON.parse(fs.readFileSync('./package.json'));
    };

    gulp.task('clean', function (cb) {
        return del([ './dist' ], cb);
    });

    gulp.task('bump', function () {
        var version = 'patch';

        if (argv.major) {
            version = 'major';
        } else if (argv.minor) {
            version = 'minor';
        } else if (argv.prerelease) {
            version = 'prerelease';
        }

        return gulp.src([ './package.json', './bower.json', ])
            .pipe(plugins.bump({
                type: version
            }))
            .pipe(gulp.dest('./'));
    });

    gulp.task('copyright-year', function () {
        return gulp.src([ './LICENSE.md', './README.md' ])
            .pipe(plugins.replace(/(Copyright )(\d{4}-)?(\d{4})/g, '$1$2' + gutil.date('yyyy')))
            .pipe(gulp.dest('.'));
    });

    gulp.task('lint', function() {
        return gulp.src('./src/**.js')
            .pipe(plugins.jshint())
            .pipe(plugins.jshint.reporter('default'));
    });

    gulp.task('sass', function () {
        return gulp.src("./src/markitup.sass")
            .pipe(plugins.if(argv.dev, plugins.sourcemaps.init()))
            .pipe(plugins.sass({
                outputStyle: 'expanded',
                indentWidth: 4
            }).on('error', plugins.sass.logError))
            .pipe(plugins.autoprefixer())
            .pipe(plugins.if(argv.dev, plugins.sourcemaps.write('maps')))
            .pipe(gulp.dest("./dist/"));
    });

    gulp.task('js', function () {
        var icons = fs.readFileSync('./src/markitup.icons.js', 'UTF-8');
        icons = icons.replace(/\n/g, '\n    ');

        return gulp.src([ './src/markitup.js', './src/markitup.jquery.js' ])
            .pipe(plugins.replace('{ /* insert SVG icons here */ }', icons))
            .pipe(gulp.dest('./dist'));
    });

    gulp.task('icons', function() {
        return gulp.src('./src/icons/*.svg')
            .pipe(plugins.rename({ extname: '' }))
            .pipe(plugins.svgJsonSpritesheet('markitup.icons.js'))
            .pipe(plugins.intercept(function(file) {
                var json = JSON.parse(file.contents);

                Object.keys(json).forEach(function (key) {
                    json[key] = json[key].data;
                });

                file.contents = new Buffer(JSON.stringify(json, null, 4));

                return file;
            }))
            .pipe(gulp.dest('./src'));
    });

    gulp.task('minify-js', function () {
        return gulp.src('./dist/**/!(*.min.js).js')
            .pipe(plugins.sourcemaps.init({ loadMaps: argv.dev }))
            .pipe(plugins.uglify({
                compress: {
                    warnings: false
                },
                mangle: true,
                outSourceMap: true,
                preserveComments: 'license'
            }).on('error', gutil.log))
            .pipe(plugins.rename({ suffix: '.min' }))
            .pipe(plugins.sourcemaps.write('maps'))
            .pipe(gulp.dest('./dist/'));
    });

    gulp.task('minify-css', function () {
        return gulp.src('./dist/**/!(*.min.css).css')
            .pipe(plugins.sourcemaps.init({ loadMaps: argv.dev }))
            .pipe(plugins.cleanCss())
            .pipe(plugins.rename({ suffix: '.min' }))
            .pipe(plugins.sourcemaps.write('maps'))
            .pipe(gulp.dest('./dist/'));
    });

    gulp.task('header', function () {
        settings.banner.vars.pkg = getPackageJson();

        return gulp.src('./dist/*.js')
            .pipe(plugins.header(settings.banner.content, settings.banner.vars ))
            .pipe(gulp.dest('./dist/'));
    });

    gulp.task('changelog', function (cb) {
        var filename  = 'CHANGELOG.md',
            editor    = process.env.EDITOR || 'vim',
            version   = getPackageJson().version,
            date      = gutil.date('yyyy-mm-dd'),
            changelog = fs.readFileSync(filename).toString(),
            lastDate  = (/\d{4}-\d{2}-\d{2}/.exec(changelog) || [])[0] || new Date().toISOString().split('T')[0];

        exec('git log --since="' + lastDate + ' 00:00:00" --oneline --pretty=format:"%s"', function (err, stdout) {
            if (err) {
                return cb(err);
            }

            if (!stdout) {
                return cb();
            }

            var updates = [
                '### MarkItUp! ' + version + ' ' + date,
                '',
                '* ' + stdout.replace(/\n/g, '\n* ')
            ].join('\n');

            changelog = changelog.replace(/(## CHANGE LOG)/, '$1\n\n' + updates);

            fs.writeFileSync(filename, changelog);

            var vim = spawn(editor, [ filename, '-n', '+7' ], {
                stdio: 'inherit'
            });

            vim.on('close', function () {
                return cb();
            });
        });
    });

    gulp.task('fail-if-dirty', function (cb) {
        return exec('git diff-index HEAD --', function (err, output) { // err, output, code
            if (err) {
                return cb(err);
            }
            if (output) {
                return cb('Repository is dirty');
            }
            return cb();
        });
    });

    gulp.task('fail-if-not-master', function (cb) {
        exec('git symbolic-ref -q HEAD', function (err, output) { // err, output, code
            if (err) {
                return cb(err);
            }
            if (!/refs\/heads\/master/.test(output)) {
                return cb('Branch is not Master');
            }
            return cb();
        });
    });

    gulp.task('git-tag', function (cb) {
        var message = 'v' + getPackageJson().version;

        return exec('git tag ' + message, cb);
    });

    gulp.task('git-add', function (cb) {
        return exec('git add -A', cb);
    });

    gulp.task('git-commit', function (cb) {
        var message = 'Build v' + getPackageJson().version;

        return exec('git commit -m "' + message + '"', cb);
    });

    gulp.task('git-pull', function (cb) {
        return exec('git pull origin master', function (err, output) {
            if (err) {
                return cb(err + ' ' + output);
            }
            return cb();
        });
    });

    gulp.task('git-push', function (cb) {
        return exec('git push origin master --tags', function (err, output) {
            if (err) {
                return cb(err + ' ' + output);
            }
            return cb();
        });
    });

    gulp.task("npm-publish", function (cb) {
        exec('npm publish', function (err, output) {
                if (err) {
                    return cb(err + ' ' + output);
                }
                return cb();
            }
        );
    });

    /** Publish on Github **/

    gulp.task('tmp-clean', function (cb) {
        return del([ './tmp' ], cb);
    });

    gulp.task('tmp-create', function (cb) {
        return exec('mkdir -p ./tmp', cb);
    });

    gulp.task('tmp-copy', [ 'tmp-create' ], function () {
        return gulp.src('./dist/**/*')
            .pipe(gulp.dest('./tmp'));
    });

    gulp.task('zip', [ 'tmp-create' ], function () {
        var filename = settings.name + '.zip';

        return gulp.src('./dist/**/*')
            .pipe(plugins.zip(filename))
            .pipe(gulp.dest('./tmp'));
    });

    gulp.task('meta', function (cb) {
        var  metadata = {
                date: gutil.date('yyyy-mm-dd HH:MM'),
                version: 'v' + getPackageJson().version
            },
            json = JSON.stringify(metadata, null, 4);

        fs.writeFileSync('tmp/metadata.json', json);
        fs.writeFileSync('tmp/metadata.js', '__metadata(' + json + ');');

        return cb();
    });

    gulp.task('gh-pages', function (cb) {
        var version = getPackageJson().version;

        exec([  'git checkout gh-pages',
                'rm -rf releases/' + version,
                'mkdir -p releases/' + version,
                'cp -r tmp/* releases/' + version,
                'git add -A releases/' + version,
                'rm -rf releases/latest',
                'mkdir -p releases/latest',
                'cp -r tmp/* releases/latest',
                'git add -A releases/latest',
                'git commit -m "Publish release v' + version + '."',
                'git push origin gh-pages',
                'git checkout -'
            ].join(' && '),
            function (err, output) {
                if (err) {
                    return cb(err + ' ' + output);
                }
                return cb();
            }
        );
    });

    gulp.task('publish', sync([
      [ 'fail-if-not-master', 'fail-if-dirty' ],
        'tmp-create',
        'tmp-copy',
        'meta',
        'zip',
        'gh-pages',
        'tmp-clean'
    ],
    'publising'));

    /** Misc taks **/

    gulp.task('default', [ 'watch' ]);

    gulp.task('watch', function() {
        argv.dev = true;
        gulp.watch("./src/**/*", [ 'build' ]);
    });

    gulp.task('build', sync([
        'clean',            // Remove /dist folder
        'sass',             // Transpile SASS
        'js',               // Transpile ES6
        'header',           // Add Comment Headers
        'minify-css',       // Minify CSS
        'minify-js',        // Minify JS
    ],
    'building'));

    gulp.task('release', sync([
      [ 'fail-if-not-master', 'fail-if-dirty' ], // Dirty or not master?
        'git-pull',         // Pull repository
        'lint',             // Lint JS
        'bump',             // Bump version
        'build',            // Second complete build with version bumped
        'changelog',        // Get last commit and auto edit the changlog in VIM
        'copyright-year',   // Change Copyright years in .md
        'git-add',          // Git add changes
        'git-commit',       // Git commit new build
        'git-tag',          // Create Git tag
        'git-push',         // Push to repositoty
        'publish',          // Add a zip file in gh-pages branch on Github
        'npm-publish'       // Publish on NPM
    ],
    'releasing'));
})();

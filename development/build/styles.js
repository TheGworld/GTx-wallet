const pify = require('pify');
const gulp = require('gulp');
const sass = require('gulp-sass');
const autoprefixer = require('gulp-autoprefixer');
const gulpStylelint = require('gulp-stylelint');
const watch = require('gulp-watch');
const sourcemaps = require('gulp-sourcemaps');
const rtlcss = require('gulp-rtlcss');
const rename = require('gulp-rename');
const pump = pify(require('pump'));
const { createTask } = require('./task');

// use our own compiler which runs sass in its own process
// in order to not pollute the intrinsics
sass.compiler = require('./sass-compiler.js');

// scss compilation and autoprefixing tasks
module.exports = createStyleTasks;

function createStyleTasks({ livereload }) {
  const prod = createTask(
    'styles:prod',
    createScssBuildTask({
      src: 'ui/css/index.scss',
      dest: 'ui/css/output',
      devMode: false,
    }),
  );

  const dev = createTask(
    'styles:dev',
    createScssBuildTask({
      src: 'ui/css/index.scss',
      dest: 'ui/css/output',
      devMode: true,
      pattern: 'ui/**/*.scss',
    }),
  );

  const lint = createTask('lint-scss', function () {
    return gulp.src('ui/css/itcss/**/*.scss').pipe(
      gulpStylelint({
        reporters: [{ formatter: 'string', console: true }],
        fix: true,
      }),
    );
  });

  return { prod, dev, lint };

  function createScssBuildTask({ src, dest, devMode, pattern }) {
    return async function () {
      if (devMode) {
        watch(pattern, async (event) => {
          await buildScss();
          livereload.changed(event.path);
        });
      }
      await buildScss(devMode);
    };

    async function buildScss() {
      await pump(
        ...[
          // pre-process
          gulp.src(src),
          devMode && sourcemaps.init(),
          sass().on('error', sass.logError),
          devMode && sourcemaps.write(),
          autoprefixer(),
          // standard
          gulp.dest(dest),
          // right-to-left
          rtlcss(),
          rename({ suffix: '-rtl' }),
          devMode && sourcemaps.write(),
          gulp.dest(dest),
        ].filter(Boolean),
      );
    }
  }
}

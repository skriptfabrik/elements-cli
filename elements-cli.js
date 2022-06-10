#!/usr/bin/env node

const chalk = require('chalk');
const chokidar = require('chokidar');
const { compile } = require('handlebars');
const corsAnywhere = require('cors-anywhere');
const express = require('express');
const fs = require('fs');
const gracefulShutdown = require('http-graceful-shutdown');
const handlebars = require('express-handlebars');
const minimist = require('minimist');
const path = require('path');
const pkg = require('./package.json');
const send = require('send');
const { Server }= require('ws');
const { URL } = require('url');

// Argument defaults

const argd = {
  'base-path': process.env.BASE_PATH || '/',
  hostname: process.env.HOSTNAME || 'localhost',
  layout: process.env.LAYOUT || 'sidebar',
  port: parseInt(process.env.PORT || '8000'),
  router: process.env.ROUTER || 'history',
  style: process.env.STYLE || 'display: block; height: 100vh',
  title: process.env.TITLE || 'My API Docs',
  'working-dir': process.cwd(),
};

// Parse arguments

const argv = minimist(process.argv.slice(2), {
  boolean: ['c', 'f', 'h', 'n', 'p', 'v', 'w'],
  alias: {
    c: 'with-cors-proxy',
    f: 'filter-internal',
    h: 'help',
    n: 'no-try-it',
    p: 'poll',
    v: 'version',
    w: 'watch',
  },
  default: argd,
});

// Print version number

if (argv.version) {
  console.log(pkg.version);
  process.exit(0);
}

// Display help message

if (argv.help || argv._.length < 2 || !['export', 'preview'].includes(argv._[0])) {
    if (argv._[0] === 'export') {
      console.error(
        `Elements CLI\n\n${chalk.yellow('Usage:')}\n%s\n\n${chalk.yellow('Arguments:')}\n%s\n\n${chalk.yellow('Options:')}\n%s\n\n${chalk.yellow('Examples:')}\n%s`,
        `  ${path.basename(process.argv[1])} export [options] <openapi_json>`,
        `  ${chalk.green('openapi_json')}  The path or URL of the OpenAPI JSON file`,
        [
          `  ${chalk.green('    --base-path=BASE_PATH')}    Use the given base path ${chalk.yellow('[default: "' + argd['base-path'] + '"]')}`,
          `  ${chalk.green('    --cors-proxy=CORS_PROXY')}  Provide CORS proxy`,
          `  ${chalk.green('-f, --filter-internal')}        Filter out any content which has been marked as internal with x-internal`,
          `  ${chalk.green('-h, --help')}                   Display this help message`,
          `  ${chalk.green('    --layout=LAYOUT')}          Layout for Elements: sidebar, stacked ${chalk.yellow('[default: "' + argd.layout + '"]')}`,
          `  ${chalk.green('    --logo=LOGO')}              URL of an image that will show as a small square logo next to the title`,
          `  ${chalk.green('-n  --no-try-it')}              Hide the "Try It" panel (the interactive API console)`,
          `  ${chalk.green('    --router=ROUTER')}          Determines how navigation should work: history, hash, memory, static ${chalk.yellow('[default: "' + argd.router + '"]')}`,
          `  ${chalk.green('    --style=STYLE')}            Additional style for Elements ${chalk.yellow('[default: "' + argd.style + '"]')}`,
          `  ${chalk.green('    --title=TITLE')}            API docs title ${chalk.yellow('[default: "' + argd.title + '"]')}`,
          `  ${chalk.green('-v, --version')}                Print version number`,
        ].join('\n'),
        [
          `  Export rendered API docs based on local ${chalk.magenta('openapi.json')} path as ${chalk.magenta('index.html')}:`,
          ``,
          `    ${chalk.green(path.basename(process.argv[1]) + ' export openapi.json > index.html')}`,
          ``,
          `  Export rendered Swagger Petstore docs based on remote ${chalk.magenta('https://petstore.swagger.io/v2/swagger.json')} URL as ${chalk.magenta('index.html')}:`,
          ``,
          `    ${chalk.green(path.basename(process.argv[1]) + ' export https://petstore.swagger.io/v2/swagger.json > index.html')}`,
        ].join('\n'),
      );
    } else if(argv._[0] === 'preview') {
      console.error(
        `Elements CLI\n\n${chalk.yellow('Usage:')}\n%s\n\n${chalk.yellow('Arguments:')}\n%s\n\n${chalk.yellow('Options:')}\n%s\n\n${chalk.yellow('Examples:')}\n%s`,
        `  ${path.basename(process.argv[1])} preview [options] <openapi_json>`,
        `  ${chalk.green('openapi_json')}  The path or URL of the OpenAPI JSON file`,
        [
          `  ${chalk.green('    --base-path=BASE_PATH')}  Use the given base path ${chalk.yellow('[default: "' + argd['base-path'] + '"]')}`,
          `  ${chalk.green('-c  --with-cors-proxy')}      Enable CORS proxy capabilities`,
          `  ${chalk.green('-f, --filter-internal')}      Filter out any content which has been marked as internal with x-internal`,
          `  ${chalk.green('-h, --help')}                 Display this help message`,
          `  ${chalk.green('    --hostname=HOSTNAME')}    Server hostname ${chalk.yellow('[default: "' + argd.hostname + '"]')}`,
          `  ${chalk.green('    --layout=LAYOUT')}        Layout for Elements: sidebar, stacked ${chalk.yellow('[default: "' + argd.layout + '"]')}`,
          `  ${chalk.green('    --logo=LOGO')}            URL of an image that will show as a small square logo next to the title`,
          `  ${chalk.green('-n  --no-try-it')}            Hide the "Try It" panel (the interactive API console)`,
          `  ${chalk.green('-p, --poll')}                 Use polling instead of file system events`,
          `  ${chalk.green('    --port=PORT')}            Server port ${chalk.yellow('[default: ' + argd.port + ']')}`,
          `  ${chalk.green('    --router=ROUTER')}        Determines how navigation should work: history, hash, memory, static ${chalk.yellow('[default: "' + argd.router + '"]')}`,
          `  ${chalk.green('    --style=STYLE')}          Additional style for Elements ${chalk.yellow('[default: "' + argd.style + '"]')}`,
          `  ${chalk.green('    --title=TITLE')}          API docs title ${chalk.yellow('[default: "' + argd.title + '"]')}`,
          `  ${chalk.green('-v, --version')}              Print version number`,
          `  ${chalk.green('-w  --watch')}                Watch for changes and reload (only for local files)`,
          `  ${chalk.green('    --working-dir=PWD')}      Use the given directory as working directory`,
        ].join('\n'),
        [
          `  Preview rendered API docs based on local ${chalk.magenta('openapi.json')} path:`,
          ``,
          `    ${chalk.green(path.basename(process.argv[1]) + ' preview openapi.json')}`,
          ``,
          `  Preview rendered Swagger Petstore docs based on remote ${chalk.magenta('https://petstore.swagger.io/v2/swagger.json')} URL:`,
          ``,
          `    ${chalk.green(path.basename(process.argv[1]) + ' preview https://petstore.swagger.io/v2/swagger.json')}`,
          '',
          `  Preview local API docs, enable CORS proxy capabilities and watch/reload on data changes:`,
          ``,
          `    ${chalk.green(path.basename(process.argv[1]) + ' preview -cw openapi.json')}`,
        ].join('\n'),
      );
    } else {
      console.error(
        `Elements CLI\n\n${chalk.yellow('Usage:')}\n%s\n\n${chalk.yellow('Options:')}\n%s\n\n${chalk.yellow('Commands:')}\n%s`,
        `  ${path.basename(process.argv[1])} command [options] [arguments]`,
        [
          `  ${chalk.green('-h, --help')}     Display this help message`,
          `  ${chalk.green('-v, --version')}  Print version number`,
        ].join('\n'),
        [
          `  ${chalk.green('export')}   Export rendered API docs`,
          `  ${chalk.green('preview')}  Preview rendered API docs`,
        ].join('\n'),
      );
    }

    process.exit(argv.help ? 0 : 1);
}

// Watching remote files is not supported

if (/^http(s)?:\/\//i.test(argv._[1])) {
  argv.watch = false;
}

/**
 * Replace double forward slashes, removes trailing slashes and optionally appends suffix
 * 
 * @param {string} str    The input string
 * @param {string} suffix The optional suffix
 * 
 * @returns {string}
 */
function sanitize(str, suffix = '') {
  return str.replace(/\/+/g, '/').replace(/\/$/, '') + suffix;
}

/**
 * Upgrade HTTP server with web socket server capabilities
 * 
 * @param {http.Server} server The HTTP server instance
 * 
 * @returns {ws.Server}
 */
function upgrade(server) {
  const wss = new Server({ server });

  return wss.on('connection', (socket) => {
    socket.on('message', (message) => {
      const request = JSON.parse(message);

      if (request.command === 'hello') {
        const data = JSON.stringify({
            command: 'hello',
            protocols: [
              'http://livereload.com/protocols/official-7',
              'http://livereload.com/protocols/official-8',
              'http://livereload.com/protocols/official-9',
              'http://livereload.com/protocols/2.x-origin-version-negotiation',
              'http://livereload.com/protocols/2.x-remote-control',
            ],
            serverName: 'elements-server',
          });

          socket.send(data);
      }
    });
  });
}

/**
 * Create file system watcher and broatcast all file changes to every client
 * 
 * @param {sting}     filePath The file path to watch
 * @param {ws.Server} server   The web socket server instance
 * 
 * @returns {chokidar.FSWatcher}
 */
function watch(filePath, server) {
  const watcher = chokidar.watch(filePath, {
    ignoreInitial: true,
    usePolling: argv.poll,
  });

  return watcher.on('all', (filePath) => {
    const data = JSON.stringify({
      command: 'reload',
      path: filePath,
    });

    server.clients.forEach((socket) => socket.send(data));
  });
}

// Define base href

const baseHref = sanitize(`/${argv['base-path']}`, '/');

// Export rendered API docs

if (argv._[0] === 'export') {
  const input = fs.readFileSync(path.resolve(__dirname, 'views', 'index.handlebars')).toString('utf8');
  const template = compile(input);
  const version = pkg.dependencies['@stoplight/elements'];

  let tryItCorsProxy;

  if (argv['cors-proxy'] && !argv['no-try-it']) {
    tryItCorsProxy = argv['cors-proxy'];
  }

  console.log(template({
    baseHref,
    elements: {
      apiDescriptionUrl: argv._[1],
      basePath: baseHref,
      hideInternal: argv['filter-internal'] ? 'true' : undefined,
      hideTryIt: argv['no-try-it'] ? 'true' : undefined,
      tryItCorsProxy,
      layout: argv.layout,
      logo: argv.logo,
      router: argv.router,
      style: argv.style,
    },
    'elements-css': `https://unpkg.com/@stoplight/elements@${version}/styles.min.css`,
    'elements-js': `https://unpkg.com/@stoplight/elements@${version}/web-components.min.js`,
    layout: false,
    livereload: false,
    title: argv.title,
  }));

  process.exit(0);
}

// Create express app

const app = express();

// Enable Handlebars view engine

app.engine('handlebars', handlebars.engine());
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// Serve assets from node_modules

const assets = {
  'livereload.js': 'node_modules/livereload-js/dist/livereload.min.js',
  'styles.min.css': 'node_modules/@stoplight/elements/styles.min.css',
  'web-components.min.js': 'node_modules/@stoplight/elements/web-components.min.js',
};

app.get(
  Object.keys(assets).map((asset) =>
    sanitize(`/${argv['base-path']}/${asset}`)
  ),
  (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    send(req, path.join(__dirname, assets[path.basename(url.pathname)])).pipe(
      res
    );
  }
);

// Serve static files from working directory

app.use(sanitize(`/${argv['base-path']}`), express.static(argv['working-dir']));

// Handle CORS proxy requests

if (argv['with-cors-proxy'] && !argv['no-try-it']) {
  const proxy = corsAnywhere.createServer({
    originWhitelist: [], // Allow all origins
    requireHeaders: [], // Do not require any headers
    removeHeaders: [] // Do not remove any headers
  });
  
  app.all(sanitize(`/${argv['base-path']}/_/*`), (req, res) => {
    req.url = `/${req.params['0']}`;
  
    proxy.emit('request', req, res);
  });
}

// Render and serve index template

app.get(
  [sanitize(`/${argv['base-path']}`, '*'), sanitize(`/${argv['base-path']}`)],
  (req, res) => {
    let tryItCorsProxy;

    if (argv['with-cors-proxy'] && !argv['no-try-it']) {
      tryItCorsProxy = `http://${req.headers.host}${baseHref}_/`;
    }

    res.render('index', {
      baseHref,
      elements: {
        apiDescriptionUrl: argv._[1],
        basePath: baseHref,
        hideInternal: argv['filter-internal'] ? 'true' : undefined,
        hideTryIt: argv['no-try-it'] ? 'true' : undefined,
        tryItCorsProxy,
        layout: argv.layout,
        logo: argv.logo,
        router: argv.router,
        style: argv.style,
      },
      'elements-css': 'styles.min.css',
      'elements-js': 'web-components.min.js',
      layout: false,
      'livereload-js': argv.watch ? 'livereload.js' : undefined,
      title: argv.title,
    });
  }
);

// Listen for HTTP connections

const server = app.listen(argv.port, argv.hostname, () =>
  console.error(
    `Elements server listening on http://${argv.hostname}:${argv.port}${baseHref}`
  )
);

// Watch files in working directory and launch web socket server

if (argv.watch) {
  watch(
    argv['working-dir'],
    upgrade(server).on('error', (err) => console.error(err))
  )
    .once('ready', () => console.error(`Watching ${path.resolve(argv['working-dir'])}`))
    .on('error', (err) => console.error(err));
}

// Enable the graceful shutdown

gracefulShutdown(server);

#!/usr/bin/env node

import chalk from 'chalk';
import chokidar from 'chokidar';
import corsAnywhere from 'cors-anywhere';
import express from 'express';
import { engine } from 'express-handlebars';
import { readFile } from 'fs/promises';
import handlebars from 'handlebars';
import gracefulShutdown from 'http-graceful-shutdown';
import minimist from 'minimist';
import { createRequire } from 'module';
import path from 'path';
import send from 'send';
import { WebSocketServer } from 'ws';
import { fileURLToPath, URL } from 'url';

// Compat

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Package info

const pkg = JSON.parse(await readFile(path.join(__dirname, 'package.json')));

// Argument defaults

const argd = {
    'base-path': process.env.ELEMENTS_BASE_PATH || process.env.BASE_PATH || '/',
    'credentials-policy': process.env.ELEMENTS_CREDENTIALS_POLICY || process.env.CREDENTIALS_POLICY || 'omit',
    hostname: process.env.ELEMENTS_HOSTNAME || 'localhost',
    layout: process.env.ELEMENTS_LAYOUT || process.env.LAYOUT || 'sidebar',
    logo: process.env.ELEMENTS_LOGO || process.env.LOGO,
    port: parseInt(process.env.ELEMENTS_PORT || '8000'),
    router: process.env.ELEMENTS_ROUTER || process.env.ROUTER || 'history',
    style: process.env.ELEMENTS_STYLE || process.env.STYLE || 'flex: 1 0 0; overflow: hidden;',
    title: process.env.ELEMENTS_TITLE || process.env.TITLE || 'My API Docs',
    variable: (process.env.ELEMENTS_VARIABLE || process.env.VARIABLE || '').split('\n').map(variable => variable.trim()),
    'virtual-host': process.env.ELEMENTS_VIRTUAL_HOST || 'localhost',
    'virtual-port': process.env.ELEMENTS_VIRTUAL_PORT || '8000',
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
                `  ${chalk.green('    --base-path=BASE_PATH')}                    Use the given base path ${chalk.yellow('[default: "' + argd['base-path'] + '"]')}`,
                `  ${chalk.green('    --credentials-policy=CREDENTIALS_POLICY')}  Credentials policy for "Try It" feature: omit, include, same-origin ${chalk.yellow('[default: "' + argd['credentials-policy'] + '"]')}`,
                `  ${chalk.green('    --cors-proxy=CORS_PROXY')}                  Provide CORS proxy`,
                `  ${chalk.green('-f, --filter-internal')}                        Filter out any content which has been marked as internal with x-internal`,
                `  ${chalk.green('-h, --help')}                                   Display this help message`,
                `  ${chalk.green('    --layout=LAYOUT')}                          Layout for Elements: sidebar, stacked ${chalk.yellow('[default: "' + argd.layout + '"]')}`,
                `  ${chalk.green('    --logo=LOGO')}                              URL of an image that will show as a small square logo next to the title`,
                `  ${chalk.green('-n  --no-try-it')}                              Hide the "Try It" panel (the interactive API console)`,
                `  ${chalk.green('    --router=ROUTER')}                          Determines how navigation should work: history, hash, memory, static ${chalk.yellow('[default: "' + argd.router + '"]')}`,
                `  ${chalk.green('    --style=STYLE')}                            Additional style for Elements ${chalk.yellow('[default: "' + argd.style + '"]')}`,
                `  ${chalk.green('    --title=TITLE')}                            API docs title ${chalk.yellow('[default: "' + argd.title + '"]')}`,
                `  ${chalk.green('    --variable=VARIABLE')}                      Variable to be replaced in the OpenAPI document`,
                `  ${chalk.green('-v, --version')}                                Print version number`,
            ].join('\n'),
            [
                `  Export rendered API docs based on local ${chalk.magenta('openapi.json')} path as ${chalk.magenta('index.html')}:`,
                ``,
                `    ${chalk.green(path.basename(process.argv[1]) + ' export openapi.json > index.html')}`,
                ``,
                `  Export rendered Swagger Petstore docs based on remote ${chalk.magenta('https://petstore.swagger.io/v2/swagger.json')} URL as ${chalk.magenta('index.html')}:`,
                ``,
                `    ${chalk.green(path.basename(process.argv[1]) + ' export --title="Swagger Petstore" https://petstore.swagger.io/v2/swagger.json > index.html')}`,
            ].join('\n'),
        );
    } else if (argv._[0] === 'preview') {
        console.error(
            `Elements CLI\n\n${chalk.yellow('Usage:')}\n%s\n\n${chalk.yellow('Arguments:')}\n%s\n\n${chalk.yellow('Options:')}\n%s\n\n${chalk.yellow('Examples:')}\n%s`,
            `  ${path.basename(process.argv[1])} preview [options] <openapi_json>`,
            `  ${chalk.green('openapi_json')}  The path or URL of the OpenAPI JSON file`,
            [
                `  ${chalk.green('    --base-path=BASE_PATH')}                    Use the given base path ${chalk.yellow('[default: "' + argd['base-path'] + '"]')}`,
                `  ${chalk.green('    --credentials-policy=CREDENTIALS_POLICY')}  Credentials policy for "Try It" feature: omit, include, same-origin ${chalk.yellow('[default: "' + argd['credentials-policy'] + '"]')}`,
                `  ${chalk.green('-c  --with-cors-proxy')}                        Enable CORS proxy capabilities`,
                `  ${chalk.green('-f, --filter-internal')}                        Filter out any content which has been marked as internal with x-internal`,
                `  ${chalk.green('-h, --help')}                                   Display this help message`,
                `  ${chalk.green('    --hostname=HOSTNAME')}                      Server hostname ${chalk.yellow('[default: "' + argd.hostname + '"]')}`,
                `  ${chalk.green('    --layout=LAYOUT')}                          Layout for Elements: sidebar, stacked ${chalk.yellow('[default: "' + argd.layout + '"]')}`,
                `  ${chalk.green('    --logo=LOGO')}                              URL of an image that will show as a small square logo next to the title`,
                `  ${chalk.green('-n  --no-try-it')}                              Hide the "Try It" panel (the interactive API console)`,
                `  ${chalk.green('-p, --poll')}                                   Use polling instead of file system events`,
                `  ${chalk.green('    --port=PORT')}                              Server port ${chalk.yellow('[default: ' + argd.port + ']')}`,
                `  ${chalk.green('    --router=ROUTER')}                          Determines how navigation should work: history, hash, memory, static ${chalk.yellow('[default: "' + argd.router + '"]')}`,
                `  ${chalk.green('    --style=STYLE')}                            Additional style for Elements ${chalk.yellow('[default: "' + argd.style + '"]')}`,
                `  ${chalk.green('    --title=TITLE')}                            API docs title ${chalk.yellow('[default: "' + argd.title + '"]')}`,
                `  ${chalk.green('    --variable=VARIABLE')}                      Variable to be replaced in the OpenAPI document`,
                `  ${chalk.green('-v, --version')}                                Print version number`,
                `  ${chalk.green('-w  --watch')}                                  Watch for changes and reload (only for local files)`,
                `  ${chalk.green('    --virtual-host=VIRTUAL_HOST')}              Reported hostname ${chalk.yellow('[default: ' + argd['virtual-host'] + ']')}`,
                `  ${chalk.green('    --virtual-port=VIRTUAL_PORT')}              Reported port ${chalk.yellow('[default: ' + argd['virtual-port'] + ']')}`,
                `  ${chalk.green('    --working-dir=PWD')}                        Use the given directory as working directory`,
            ].join('\n'),
            [
                `  Preview rendered API docs based on local ${chalk.magenta('openapi.json')} path:`,
                ``,
                `    ${chalk.green(path.basename(process.argv[1]) + ' preview openapi.json')}`,
                ``,
                `  Preview rendered Swagger Petstore docs based on remote ${chalk.magenta('https://petstore.swagger.io/v2/swagger.json')} URL:`,
                ``,
                `    ${chalk.green(path.basename(process.argv[1]) + ' preview --title="Swagger Petstore" https://petstore.swagger.io/v2/swagger.json')}`,
                '',
                `  Preview local API docs, enable CORS proxy and watch/reload on data changes:`,
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
 * @returns {ws.WebSocketServer}
 */
function upgrade(server) {
    const wss = new WebSocketServer({ server });

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
 * @param {string}             filePath The file path to watch
 * @param {ws.WebSocketServer} server   The web socket server instance
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

// Define delimiters and variables

const delimiters = { open: '{{', close: '}}' },
    variables = [argv.variable]
        .flat()
        .filter((variable) => !!variable)
        .reduce((variables, variable) => {
            const [name, value] = variable.split('=');
            variables[name] = value;
            return variables;
        }, {});

// Export rendered API docs

if (argv._[0] === 'export') {
    const input = await readFile(path.resolve(__dirname, 'views', 'index.handlebars'));
    const template = handlebars.compile(input.toString('utf8'));
    const version = pkg.dependencies['@stoplight/elements'];

    let tryItCorsProxy;

    if (argv['cors-proxy'] && !argv['no-try-it']) {
        tryItCorsProxy = argv['cors-proxy'];
    }

    console.log(
        template({
            baseHref,
            delimiters,
            elements: {
                apiDescriptionUrl: argv._[1],
                basePath: baseHref,
                hideInternal: argv['filter-internal'] ? 'true' : undefined,
                hideTryIt: argv['no-try-it'] ? 'true' : undefined,
                tryItCorsProxy,
                tryItCredentialsPolicy: argv['credentials-policy'],
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
            variables,
        })
    );

    process.exit(0);
}

// Create express app

const app = express();

// Enable Handlebars view engine

app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// Serve assets from node_modules

const assets = {
    'livereload.js': require.resolve('livereload-js/dist/livereload.min.js'),
    'styles.min.css': require.resolve('@stoplight/elements/styles.min.css'),
    'web-components.min.js': require.resolve('@stoplight/elements/web-components.min.js'),
};

app.get(
    Object.keys(assets).map((asset) =>
        sanitize(`/${argv['base-path']}/${asset}`)
    ),
    (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);

        send(req, assets[path.basename(url.pathname)]).pipe(res);
    }
);

// Serve static files from working directory

app.use(
    sanitize(`/${argv['base-path']}`),
    express.static(argv['working-dir'], { index: false })
);

// Handle CORS proxy requests

if (argv['with-cors-proxy'] && !argv['no-try-it']) {
    const proxy = corsAnywhere.createServer({
        originWhitelist: [], // Allow all origins
        requireHeaders: [], // Do not require any headers
        removeHeaders: [], // Do not remove any headers
    });

    app.all(sanitize(`/${argv["base-path"]}/_/*basePath`), (req, res) => {
        const pos = req.originalUrl.indexOf("?");
        const queryString = pos === -1 ? "" : req.originalUrl.substring(pos);

        req.url = `/${req.params["0"]}${queryString}`;

        proxy.emit("request", req, res);
    });
}

// Render and serve index template

app.get(
    [sanitize(`/${argv['base-path']}`, '*basePath'), sanitize(`/${argv['base-path']}`)],
    (req, res) => {
        let tryItCorsProxy;

        if (argv['with-cors-proxy'] && !argv['no-try-it']) {
            tryItCorsProxy = `http://${req.headers.host}${baseHref}_/`;
        }

        res.render('index', {
            baseHref,
            delimiters,
            elements: {
                apiDescriptionUrl: argv._[1],
                basePath: baseHref,
                hideInternal: argv['filter-internal'] ? 'true' : undefined,
                hideTryIt: argv['no-try-it'] ? 'true' : undefined,
                tryItCorsProxy,
                tryItCredentialsPolicy: argv['credentials-policy'],
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
            variables,
        });
    }
);

// Listen for HTTP connections

const server = app.listen(argv.port, argv.hostname, () => {
    console.error(`Elements server listening on ${argv.hostname}:${argv.port}`);
    console.error(`Visit http://${argv['virtual-host']}:${argv['virtual-port']}${baseHref}`);
});

// Watch files in working directory and launch web socket server

const watcher = argv.watch
    ? watch(
          argv['working-dir'],
          upgrade(server).on('error', (err) => console.error(err))
      )
          .once('ready', () =>
              console.error(`Watching ${path.resolve(argv['working-dir'])}`)
          )
          .on('error', (err) => console.error(err))
    : undefined;

// Enable the graceful shutdown

gracefulShutdown(server, {
    onShutdown: () =>
        new Promise((resolve) => {
            if (watcher) {
                watcher.close();
            }
            resolve();
        }),
});

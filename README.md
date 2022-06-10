[![NPM Version](https://img.shields.io/npm/v/@skriptfabrik/elements-cli)](https://www.npmjs.com/package/@skriptfabrik/elements-cli)
[![NPM Downloads](https://img.shields.io/npm/dt/@skriptfabrik/elements-cli)](https://www.npmjs.com/package/@skriptfabrik/elements-cli)
[![Continuous Integration](https://img.shields.io/github/workflow/status/skriptfabrik/elements-cli/Continuous%20Integration)](https://github.com/skriptfabrik/elements-cli/actions/workflows/ci.yml)

# Elements CLI

> The missing CLI to preview or export beautiful, interactive API docs, based on OpenAPI and Markdown with [Stoplight Elements](https://github.com/stoplightio/elements)

## Installation

Install using [npm](https://docs.npmjs.com/about-npm/) as global package:

```bash
npm install -g @skriptfabrik/elements-cli
```

## Usage

```bash
elements --help
```

```text
Elements CLI

Usage:
  elements command [options] [arguments]

Options:
  -h, --help     Display this help message
  -v, --version  Print version number

Commands:
  export   Export rendered API docs
  preview  Preview rendered API docs
```

### Export

```bash
elements export --help
```

```text
Elements CLI

Usage:
  elements export [options] <openapi_json>

Arguments:
  openapi_json  The path or URL of the OpenAPI JSON file

Options:
      --base-path=BASE_PATH    Use the given base path [default: "/"]
      --cors-proxy=CORS_PROXY  Provide CORS proxy
  -f, --filter-internal        Filter out any content which has been marked as internal with x-internal
  -h, --help                   Display this help message
      --layout=LAYOUT          Layout for Elements: sidebar, stacked [default: "sidebar"]
      --logo=LOGO              URL of an image that will show as a small square logo next to the title
  -n  --no-try-it              Hide the "Try It" panel (the interactive API console)
      --router=ROUTER          Determines how navigation should work: history, hash, memory, static [default: "history"]
      --style=STYLE            Additional style for Elements [default: "display: block; height: 100vh"]
      --title=TITLE            API docs title [default: "My API Docs"]
  -v, --version                Print version number

Examples:
  Export rendered API docs based on local openapi.json path as index.html:

    elements export openapi.json > index.html

  Export rendered Swagger Petstore docs based on remote https://petstore.swagger.io/v2/swagger.json URL as index.html:

    elements export --title="Swagger Petstore" https://petstore.swagger.io/v2/swagger.json > index.html
```

### Preview

```bash
elements preview --help
```

```text
Elements CLI

Usage:
  elements preview [options] <openapi_json>

Arguments:
  openapi_json  The path or URL of the OpenAPI JSON file

Options:
      --base-path=BASE_PATH  Use the given base path [default: "/"]
  -c  --with-cors-proxy      Enable CORS proxy capabilities
  -f, --filter-internal      Filter out any content which has been marked as internal with x-internal
  -h, --help                 Display this help message
      --hostname=HOSTNAME    Server hostname [default: "localhost"]
      --layout=LAYOUT        Layout for Elements: sidebar, stacked [default: "sidebar"]
      --logo=LOGO            URL of an image that will show as a small square logo next to the title
  -n  --no-try-it            Hide the "Try It" panel (the interactive API console)
  -p, --poll                 Use polling instead of file system events
      --port=PORT            Server port [default: 8000]
      --router=ROUTER        Determines how navigation should work: history, hash, memory, static [default: "history"]
      --style=STYLE          Additional style for Elements [default: "display: block; height: 100vh"]
      --title=TITLE          API docs title [default: "My API Docs"]
  -v, --version              Print version number
  -w  --watch                Watch for changes and reload (only for local files)
      --working-dir=PWD      Use the given directory as working directory

Examples:
  Preview rendered API docs based on local openapi.json path:

    elements preview openapi.json

  Preview rendered Swagger Petstore docs based on remote https://petstore.swagger.io/v2/swagger.json URL:

    elements preview --title="Swagger Petstore" https://petstore.swagger.io/v2/swagger.json

  Preview local API docs, enable CORS proxy and watch/reload on data changes:

    elements preview -cw openapi.json
```

## Docker

### Export

Export rendered Swagger Petstore docs as `index.html`:

```bash
docker run --rm skriptfabrik/elements-cli export --title="Swagger Petstore" https://petstore.swagger.io/v2/swagger.json > index.html
```

### Preview

Use the following command to preview rendered API docs at `http://localhost:8080/` based on mounted `openapi.json` path:

```bash
docker run --rm -p 8000:8000 -v `pwd`:/data:ro skriptfabrik/elements-cli preview openapi.json
```

Preview rendered Swagger Petstore docs at `http://localhost:8080/` based on remote URL:

```bash
docker run --rm -p 8000:8000 skriptfabrik/elements-cli preview --title="Swagger Petstore" https://petstore.swagger.io/v2/swagger.json
```

Preview mounted API docs at `http://localhost:8080/`, enable CORS proxy capabilities and watch/reload on data changes:

```bash
docker run --rm -p 8000:8000 -v `pwd`:/data:ro skriptfabrik/elements-cli preview -cw openapi.json
```

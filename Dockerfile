FROM node:25.0.0-alpine

LABEL maintainer="Daniel Schröder <daniel.schroeder@skriptfabrik.com>"

ARG ELEMENTS_CLI_VERSION=latest

ENV ELEMENTS_HOSTNAME=0.0.0.0
ENV NODE_ENV=production

COPY . /opt/elements-cli-${ELEMENTS_CLI_VERSION}

RUN \
    --mount=type=cache,target=/root/.npm \
    set -eux; \
    npm --prefix /opt/elements-cli-${ELEMENTS_CLI_VERSION} install; \
    ln -s /opt/elements-cli-${ELEMENTS_CLI_VERSION}/elements-cli.mjs /usr/local/bin/elements

WORKDIR /data

ENTRYPOINT [ "elements" ]

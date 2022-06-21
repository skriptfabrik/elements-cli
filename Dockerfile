FROM node:18.2.0-alpine

LABEL maintainer="Daniel Schröder <daniel.schroeder@skriptfabrik.com>"

ARG ELEMENTS_CLI_VERSION=latest

ENV LISTEN_ADDRESS=0.0.0.0
ENV HOSTNAME=localhost
ENV NODE_ENV=production

COPY . /opt/elements-cli-${ELEMENTS_CLI_VERSION}

RUN set -eux; \
    npm --prefix /opt/elements-cli-${ELEMENTS_CLI_VERSION} install; \
    rm -Rf ~/.npm; \
    ln -s /opt/elements-cli-${ELEMENTS_CLI_VERSION}/elements-cli.js /usr/local/bin/elements

WORKDIR /data

ENTRYPOINT [ "elements" ]

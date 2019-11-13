FROM node:lts

WORKDIR /opt

COPY . .
RUN mkdir config && cp config.json config/config.json
ARG OFFLINE_CACHE="/opt/yarn-offline-cache"

RUN yarn config set yarn-offline-mirror ${OFFLINE_CACHE} && \
    yarn config set yarn-offline-mirror-pruning true

RUN yarn install --pure-lockfile&&\
    yarn build

EXPOSE 9505
# CMD [ "tail", "-f", "/dev/null" ]
# CMD ["/bin/bash", "tail -f /dev/null"]
CMD [ "/usr/local/bin/node", "/opt/dist/bin/main.js", "--config", "/opt/config/config.json" ]
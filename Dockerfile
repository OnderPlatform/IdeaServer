FROM node:lts

WORKDIR /opt

COPY . .

ARG OFFLINE_CACHE="/opt/yarn-offline-cache"

RUN yarn config set yarn-offline-mirror ${OFFLINE_CACHE} && \
    yarn config set yarn-offline-mirror-pruning true

RUN yarn install --pure-lockfile &&\
    yarn build

# if set custom conifg use entrypoint
# ENTRYPOINT ["yarn", "build"]

CMD [ "/usr/local/bin/node", "/opt/dist/bin/main.js"]

ARG builder

FROM ${builder} as builder
FROM node:lts

ARG yarnrc="/usr/local/share/.yarnrc"

COPY --from=builder ${yarnrc} ${yarnrc}
COPY --from=builder /opt /opt

WORKDIR /opt/packages/contracts

EXPOSE 9005

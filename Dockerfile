FROM node:20.5.1-alpine
RUN apk add --no-cache git

COPY . /app

WORKDIR /app

RUN npm i
RUN npm install -g typescript
RUN tsc

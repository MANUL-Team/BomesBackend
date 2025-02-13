FROM node:current-alpine

COPY . /API

WORKDIR /API

RUN npm i

EXPOSE 8000

CMD ["npm", "start"]

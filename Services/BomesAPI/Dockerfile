COPY –from=node:23-alpine3.20

COPY . /API

WORKDIR /API

RUN npm i

EXPOSE 8000

CMD ["npm", "start"]

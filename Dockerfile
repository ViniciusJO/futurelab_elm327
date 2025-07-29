FROM node:24

WORKDIR /usr/src/app/server
COPY . ..

RUN cd ../client && npm install
RUN npm install

RUN npm run build-client
RUN npm run build

EXPOSE 3500

CMD [ "npm", "run", "start" ]


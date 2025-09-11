FROM node

RUN mkdir -p sabnode

COPY package*.json /sabnode/

RUN cd /sabnode && npm install --include=optional

COPY . /sabnode

CMD ["node", "/sabnode/app.js"]
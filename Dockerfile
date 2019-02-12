FROM node:11-alpine

RUN apk update && apk add tzdata
ENV TZ=Australia/Melbourne                                                                                        
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN mkdir -p /usr/src/app/run
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app/

RUN npm install

EXPOSE 8080 8443

# Bundle app source
COPY public /usr/src/app/public
RUN mkdir -p /usr/src/app/public/run/images
COPY server.js wtf.js history.html.start jquery.js /usr/src/app/

CMD [ "npm", "start" ]

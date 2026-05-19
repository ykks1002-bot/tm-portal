FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm config set strict-ssl false && npm install

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

CMD ["npm", "start"]

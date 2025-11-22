FROM node:18-alpine

WORKDIR /app

# Copy package files and install
COPY package.json package-lock.json* /app/
RUN npm install --silent

# Copy rest of the app
COPY . /app

EXPOSE 3000

CMD ["npm", "run", "dev"]

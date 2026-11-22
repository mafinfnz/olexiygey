FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json server.js admin.html ./
COPY extension ./extension
USER node
EXPOSE 8787
CMD ["npm", "start"]

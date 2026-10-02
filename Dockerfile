FROM node:22-alpine
WORKDIR /app
COPY package.json server.js room.js ./
COPY public ./public
ENV DATA_DIR=/data PORT=18305 NODE_ENV=production
VOLUME /data
EXPOSE 18305
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:18305/ >/dev/null || exit 1
CMD ["node","server.js"]

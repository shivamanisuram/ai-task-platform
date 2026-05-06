FROM node:22-alpine AS builder
WORKDIR /app
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
RUN chown -R appuser:appgroup /var/cache/nginx /var/run /usr/share/nginx/html /etc/nginx/conf.d
USER appuser
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

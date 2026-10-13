FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine AS final
# The image fills in API_URL when it starts. It is where nginx sends every /api request.
ENV API_URL=http://api:8080
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/product-catalog/browser /usr/share/nginx/html
EXPOSE 8080

FROM node:22-bookworm-slim AS build
WORKDIR /app/frontend

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash protobuf-compiler libprotobuf-dev \
  && rm -rf /var/lib/apt/lists/*

COPY frontend/package*.json ./
RUN npm install

COPY grpc-web-generate.sh /app/grpc-web-generate.sh
COPY proto /app/proto
COPY frontend/ ./

ARG VITE_API_MODE=hybrid
ARG VITE_GRPC_BASE_URL=/grpc
ENV VITE_GRPC_BASE_URL=${VITE_GRPC_BASE_URL}
ENV VITE_API_MODE=${VITE_API_MODE}

RUN npm run build

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

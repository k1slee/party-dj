FROM node:18-alpine as build

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm install

# Копируем исходники
COPY . .

# Собираем проект
RUN npm run build

# ==================== PRODUCTION STAGE ====================
FROM nginx:alpine

# Копируем собранный проект
COPY --from=build /app/dist /usr/share/nginx/html

# Копируем конфиг nginx (опционально)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
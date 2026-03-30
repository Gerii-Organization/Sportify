# Folosim Node.js ca bază
FROM node:18-alpine

# Setează folderul de lucru
WORKDIR /app

# Copiază fișierele de dependențe
COPY package*.json ./

# Instalează dependențele (bibliotecile)
RUN npm install

# Copiază restul codului
COPY . .

# Expune portul pentru Metro Bundler
EXPOSE 8081

# Comanda de start
CMD ["npm", "start"]
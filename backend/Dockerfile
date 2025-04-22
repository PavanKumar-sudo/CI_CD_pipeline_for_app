FROM node:18

WORKDIR /app

# Copy package files and install dependencies
COPY ./backend/package*.json ./
RUN npm install

# ✅ Copy backend files
COPY ./backend ./

# ✅ Copy frontend views into expected /app/views
# ✅ Copy static assets
COPY ./backend/public ./public

# ✅ Copy frontend views
COPY ./frontend/views ./views

EXPOSE 3001
CMD ["node", "server.js"]

FROM node:18-alpine

WORKDIR /app

# Install curl for health check
RUN apk add --no-cache curl

# Copy package files
COPY apps/rental-api/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY apps/rental-api/src ./src
COPY apps/rental-api/dist ./dist
COPY apps/rental-api/tsconfig.json ./

# Build if dist doesn't exist
RUN if [ ! -d "dist" ]; then npm run build; fi

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/rentals/config?userId=test&videoId=test || exit 1

# Start the application
CMD ["npm", "start"]

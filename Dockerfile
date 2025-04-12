FROM golang:1.20-alpine AS builder

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o mediastream

# Use a small alpine image for the final container
FROM alpine:latest

WORKDIR /app

# Install dependencies for video processing
RUN apk add --no-cache ca-certificates tzdata

# Copy the binary from the builder stage
COPY --from=builder /app/mediastream .

# Create directories for media
RUN mkdir -p /app/media/movies /app/media/tvshows /app/media/music

# Copy static files
COPY --from=builder /app/public ./public

# Expose port 3000
EXPOSE 3000

# Command to run the application
CMD ["./mediastream"]
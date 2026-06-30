FROM rust:1-bookworm AS builder
WORKDIR /app
COPY . .
RUN cargo build --release -p personal-ssh-server

FROM debian:bookworm-slim
RUN useradd --system --uid 10001 app
COPY --from=builder /app/target/release/personal-ssh-server /usr/local/bin/personal-ssh-server
USER app
EXPOSE 8080
CMD ["personal-ssh-server"]

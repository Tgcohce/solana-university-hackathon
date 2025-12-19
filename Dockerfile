FROM rust:1.75-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    pkg-config \
    libssl-dev \
    libudev-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Solana
RUN sh -c "$(curl -sSfL https://release.solana.com/v1.18.26/install)"
ENV PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

# Install Anchor
RUN cargo install --git https://github.com/coral-xyz/anchor avm --locked
RUN avm install 0.30.1
RUN avm use 0.30.1

WORKDIR /workspace

# Default command
CMD ["anchor", "build"]


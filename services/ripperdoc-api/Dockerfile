FROM elixir:1.16-slim

WORKDIR /app

# Install hex and rebar
RUN mix local.hex --force && mix local.rebar --force

# Copy mix files
COPY mix.exs ./

# Get dependencies
RUN mix deps.get

# Copy application code
COPY lib ./lib

# Compile
ENV MIX_ENV=prod
RUN mix compile

EXPOSE 8001

CMD ["mix", "run", "--no-halt"]

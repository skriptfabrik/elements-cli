#!/bin/sh

set -e

# Change ownership of the volume mounts to the current user
sudo chown $(id -u):$(id -g) \
    ~/.cache ~/.cache/mise \
    ~/.claude \
    ~/.config ~/.config/gh \
    ~/.local ~/.local/share ~/.local/share/mise

# Activate mise in bash
cat << 'EOF' >> ~/.bashrc

# Activate mise
eval "$(mise activate bash)"
EOF

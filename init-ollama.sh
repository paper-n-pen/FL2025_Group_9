#!/bin/sh

# Start Ollama server in the background
/bin/ollama serve &

# Capture the PID of the background process
pid=$!

# Wait for the Ollama server to be responsive.
# This is more reliable than a fixed sleep.
echo "Waiting for Ollama server to start..."
while ! /bin/ollama list > /dev/null 2>&1; do
    sleep 1
done
echo "Ollama server started."

# Check if the model already exists
MODEL_NAME="llama3"
if /bin/ollama list | grep -q "$MODEL_NAME"; then
    echo "$MODEL_NAME model already exists. Skipping pull."
else
    echo "$MODEL_NAME model not found. Pulling..."
    /bin/ollama pull "$MODEL_NAME"
    echo "Model pull complete."
fi

# Wait for the background ollama serve process to finish.
# This keeps the container running.
wait $pid

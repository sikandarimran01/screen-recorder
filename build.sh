#!/usr/bin/env bash
# install system dependencies
sudo apt-get update
sudo apt-get install -y ffmpeg

# install python dependencies
pip install -r requirements.txt
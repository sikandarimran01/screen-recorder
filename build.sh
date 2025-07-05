#!/usr/bin/env bash
# install system dependencies
apt-get update
apt-get install -y ffmpeg

# install python dependencies
pip install -r requirements.txt
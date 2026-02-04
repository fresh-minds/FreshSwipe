#!/bin/bash
# Using environment variables from local shell or .env
# Usage: export ADMIN_PASSWORD=... && export AZURE_AD_CLIENT_SECRET=... && ./launcher.sh
bash -x container/deploy_single_container.sh > deploy_output.log 2>&1

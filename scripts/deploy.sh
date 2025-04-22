#!/bin/bash

set -e

RELEASE_NAME=$1
IMAGE_TAG=$2

helm upgrade --install $RELEASE_NAME ./helm-chart \
  --namespace monitoring \
  --create-namespace \
  --set backend.image.tag=$IMAGE_TAG \
  --set backend.sessionSecret="${SESSION_SECRET}" \
  --set smtpAuth.username="${SMTP_USERNAME}" \
  --set smtpAuth.password="${SMTP_PASSWORD}" \
  --set global.domain="go-web-app.local" \
  --wait

#!/bin/bash

set -e

RELEASE_NAME=$1
IMAGE_TAG=$2
DOMAIN=$3

if [ -z "$IMAGE_TAG" ]; then
  echo "ERROR: IMAGE_TAG is empty. Aborting Helm deploy."
  exit 1
fi

if [ -z "$DOMAIN" ]; then
  echo "ERROR: DOMAIN is empty. Aborting Helm deploy."
  exit 1
fi

helm upgrade --install $RELEASE_NAME ./helm-chart \
  --namespace monitoring \
  --create-namespace \
  --set backend.image.tag="$IMAGE_TAG" \
  --set backend.sessionSecret="${SESSION_SECRET}" \
  --set smtpAuth.username="${SMTP_USERNAME}" \
  --set smtpAuth.password="${SMTP_PASSWORD}" \
  --set global.domain="${DOMAIN}" \
  --wait

#!/bin/bash
# Deploy MicroTutor to Google Kubernetes Engine (GKE)
# Usage: ./deploy-to-gke.sh

set -e

# Configuration
PROJECT_ID="my-project-4307-480006"
CLUSTER_NAME="microtutorcluster"
REGION="us-central1"
GCR_REGISTRY="gcr.io/${PROJECT_ID}"
TIMESTAMP=$(date +%s)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== MicroTutor GKE Deployment ===${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI not found. Please install Google Cloud SDK first.${NC}"
    exit 1
fi

# Check authentication
echo -e "${YELLOW}Checking authentication...${NC}"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${RED}Error: Not authenticated. Please run:${NC}"
    echo -e "${YELLOW}gcloud auth login${NC}"
    exit 1
fi

# Set project
echo -e "${YELLOW}Setting project to ${PROJECT_ID}...${NC}"
gcloud config set project ${PROJECT_ID}

# Enable required APIs
echo -e "${YELLOW}Enabling required APIs...${NC}"
gcloud services enable containerregistry.googleapis.com
gcloud services enable container.googleapis.com

# Configure Docker to use gcloud as credential helper
echo -e "${YELLOW}Configuring Docker authentication...${NC}"
gcloud auth configure-docker --quiet

# Connect to cluster
echo -e "${YELLOW}Connecting to GKE cluster...${NC}"
gcloud container clusters get-credentials ${CLUSTER_NAME} --region ${REGION} --project ${PROJECT_ID}

# Build and push backend image (for linux/amd64 platform)
echo -e "${YELLOW}Building backend Docker image for linux/amd64...${NC}"
cd "$(dirname "$0")/backend"
BACKEND_IMAGE="${GCR_REGISTRY}/microtutor-backend:v${TIMESTAMP}"
docker build --platform linux/amd64 -t ${BACKEND_IMAGE} .
echo -e "${YELLOW}Pushing backend image to GCR...${NC}"
docker push ${BACKEND_IMAGE}
echo -e "${GREEN}✅ Backend image pushed: ${BACKEND_IMAGE}${NC}"

# Build and push frontend image (for linux/amd64 platform)
echo -e "${YELLOW}Building frontend Docker image for linux/amd64...${NC}"
cd "../my-react-app"
FRONTEND_IMAGE="${GCR_REGISTRY}/microtutor-frontend:v${TIMESTAMP}"
docker build --platform linux/amd64 -t ${FRONTEND_IMAGE} .
echo -e "${YELLOW}Pushing frontend image to GCR...${NC}"
docker push ${FRONTEND_IMAGE}
echo -e "${GREEN}✅ Frontend image pushed: ${FRONTEND_IMAGE}${NC}"

# Update Kubernetes manifests
echo -e "${YELLOW}Updating Kubernetes manifests with GCR images...${NC}"
cd "../k8/kinds"

# Update backend deployment
sed -i.bak "s|image: microtutor-backend:.*|image: ${BACKEND_IMAGE}|" backend-deployment.yaml
sed -i.bak "s|imagePullPolicy: Never|imagePullPolicy: Always|" backend-deployment.yaml
rm -f backend-deployment.yaml.bak

# Update frontend deployment
sed -i.bak "s|image: microtutor-frontend:.*|image: ${FRONTEND_IMAGE}|" frontend-deployment.yaml
sed -i.bak "s|imagePullPolicy: Never|imagePullPolicy: Always|" frontend-deployment.yaml
rm -f frontend-deployment.yaml.bak

# Apply Kubernetes manifests
echo -e "${YELLOW}Deploying to GKE cluster...${NC}"
kubectl apply -k .

# Wait for deployments to be ready
echo -e "${YELLOW}Waiting for deployments to be ready...${NC}"
kubectl wait --for=condition=available --timeout=300s deployment/backend -n microtutor || true
kubectl wait --for=condition=available --timeout=300s deployment/frontend -n microtutor || true

# Show status
echo -e "${GREEN}=== Deployment Status ===${NC}"
kubectl get pods -n microtutor
kubectl get services -n microtutor

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${YELLOW}Backend image: ${BACKEND_IMAGE}${NC}"
echo -e "${YELLOW}Frontend image: ${FRONTEND_IMAGE}${NC}"


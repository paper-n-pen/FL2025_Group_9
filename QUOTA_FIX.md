# GKE Quota Issue - Resolution Steps

## Problem
Your GKE Autopilot cluster is showing: **"GCE quota exceeded"** error when trying to schedule pods.

## Solution Options

### Option 1: Request Quota Increase (Recommended)
1. Go to [Google Cloud Console - Quotas](https://console.cloud.google.com/iam-admin/quotas?project=my-project-4307-480006)
2. Filter by:
   - **Service**: Compute Engine API
   - **Location**: us-central1
   - **Quota**: Look for:
     - `CPUS` (might need more than 12)
     - `INSTANCES` (should be fine with 24)
     - `N2_CPUS` or `E2_CPUS` (for Autopilot node types)
3. Select the quota and click **"EDIT QUOTAS"**
4. Request an increase (e.g., 24-48 CPUs for development)

### Option 2: Check Current Usage
Run this command to see detailed quota usage:
```bash
gcloud compute project-info describe --project=my-project-4307-480006 \
  --format="table(quotas.metric,quotas.limit,quotas.usage)" | grep -i "cpu\|instance"
```

### Option 3: Use Standard GKE Instead of Autopilot
Autopilot has higher minimum resource requirements. You could:
1. Delete the Autopilot cluster
2. Create a Standard GKE cluster with smaller node sizes
3. Redeploy using the same script

### Option 4: Wait and Retry
Sometimes GKE Autopilot takes a few minutes to provision nodes. Wait 5-10 minutes and check again:
```bash
kubectl get pods -n microtutor
```

## Current Status
- ✅ Images built and pushed to GCR
- ✅ Kubernetes manifests deployed
- ⏳ Pods waiting for node provisioning (quota issue)

## Next Steps
1. Request quota increase for CPUs in us-central1
2. Wait for approval (usually instant for free tier, or 1-2 business days)
3. Pods should automatically start once quota is available


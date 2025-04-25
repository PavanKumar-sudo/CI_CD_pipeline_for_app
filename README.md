# Full-Stack Web Application with CI/CD, Monitoring, and GitOps on AWS EKS

This project showcases a complete full-stack web application deployment pipeline, integrating modern DevOps practices and cloud-native tools. The frontend consists of static HTML views (Login, Signup, Dashboard), while the backend is built using Node.js and Express. MySQL serves as the relational database layer, and the entire application is containerized using Docker. The backend exposes APIs for authentication and routing, while frontend forms interact with the backend over clearly defined REST endpoints. All source code is organized into cleanly separated modules with automated unit testing using Jest and Supertest.

To ensure scalability and observability, a Helm chart was designed to deploy the application onto Kubernetes. This chart provisions Deployments, Services, Secrets, Ingress, and complete monitoring infrastructure using the `kube-prometheus-stack` Helm subchart. The system exposes custom Prometheus metrics from the Node.js backend, such as `http_requests_total`, and integrates Grafana dashboards to monitor CPU usage, memory, slow queries, and high request traffic. Alertmanager is configured with Gmail SMTP to send out critical alerts based on Prometheus rules for both the backend and MySQL, ensuring system reliability and prompt issue response.

A robust CI/CD pipeline is implemented using GitHub Actions to automate testing, container image building, vulnerability scanning with Trivy, and deployment via Helm and send the notification to the discord message. The pipeline dynamically tags Docker images, updates Helm chart values, and triggers deployments using ArgoCD for GitOps-based synchronization. ArgoCD monitors the Git repository for configuration changes and automatically reconciles application state on an AWS EKS cluster. With layered automation, monitoring, and GitOps, this project exemplifies an end-to-end, production-grade deployment strategy using open-source DevOps tooling.

## 📋 Prerequisites

To run and deploy this project, you must have the following tools installed and configured on your system:

1. **AWS CLI**
   - Used to authenticate and interact with AWS services (EKS, IAM, S3, etc.)
   - 🔗 [Download & Installation Guide](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)

2. **Kubectl**
   - Kubernetes command-line tool for managing clusters and resources.
   - 🔗 [Install Kubectl](https://kubernetes.io/docs/tasks/tools/)

3. **eksctl**
   - A CLI tool to create and manage EKS clusters with ease.
   - 🔗 [Install eksctl](https://eksctl.io/introduction/#installation)

4. **Helm**
   - Kubernetes package manager used for deploying the application and monitoring stack.
   - 🔗 [Install Helm](https://helm.sh/docs/intro/install/)

5. **Docker**
   - Used for building and running application containers.
   - 🔗 [Install Docker](https://docs.docker.com/get-docker/)

6. **GitHub CLI (Optional)**
   - For interacting with GitHub repositories and automating pull/push from CLI.
   - 🔗 [Install GitHub CLI](https://cli.github.com/)

7. **AWS Access Credentials**
   - Ensure your `~/.aws/credentials` file is properly configured with:
     ```ini
     [default]
     aws_access_key_id = YOUR_ACCESS_KEY
     aws_secret_access_key = YOUR_SECRET_KEY
     region = us-east-1
     ```
   - 🔗 [How to configure AWS credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)
8. **ArgoCD CLI**
   - Required for managing ArgoCD applications directly from your terminal.
   - 🔗 [Install ArgoCD CLI](https://argo-cd.readthedocs.io/en/stable/cli_installation/)
     
## 🛠️ How to Reproduce This Project (EKS Deployment Step-by-Step)
### 1 clone the project and build the docker and push to repositry
```bash
git clone <git-clone-link>
docker build -t $DOCKER_IMAGE:latest -f backend/Dockerfile .
docker push $DOCKER_IMAGE
```
After doing this docker is pushed to repositry
### 2 Create the EKS Cluster

```bash
eksctl create cluster   --name <cluster-name>   --region $regionname   --node-type t3.medium   --nodes 2   --nodes-min 1   --nodes-max 4   --managed   --vpc-nat-mode Disable
```
once you run this you will  vpc with public and private node and eks and 3 instance ec2 will be created.
![image](https://github.com/user-attachments/assets/5aac3b08-a8fc-49e8-b906-ea37b4fba99c)
![image](https://github.com/user-attachments/assets/9d03778f-729b-4303-afc2-da7af731c80a)
![image](https://github.com/user-attachments/assets/cb9ddd8b-7979-4d13-ad65-2f5429358e4c)

### 3 Configure kubectl for EKS

```bash
aws eks update-kubeconfig --region us-east-1 --name cd-cluster
kubectl get nodes
```
if you run this commands it will configure to the aws cli and provide the node.
![image](https://github.com/user-attachments/assets/337de8de-2246-4462-bc80-f9e79ed4ef98)

### 4 Enable IAM OIDC

```bash
export cluster_name=cd-cluster
oidc_id=$(aws eks describe-cluster --name $cluster_name --query "cluster.identity.oidc.issuer" --output text | cut -d '/' -f 5)
eksctl utils associate-iam-oidc-provider --cluster $cluster_name --approve
aws iam list-open-id-connect-providers | grep $oidc_id
```
we are doing the oidc controller to give full security to the aws eks
![image](https://github.com/user-attachments/assets/3775d6a9-76ab-48a5-95e5-fddee91baf16)

### 5 Create IAM Policy and Role

```bash
curl -O https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.11.0/docs/install/iam_policy.json
aws iam create-policy --policy-name AWSLoadBalancerControllerIAMPolicy --policy-document file://iam_policy.json

export AWS_ACCOUNT_ID=<your_aws_account_id>

eksctl create iamserviceaccount   --cluster=$cluster_name   --namespace=kube-system   --name=aws-load-balancer-controller   --role-name AmazonEKSLoadBalancerControllerRole   --attach-policy-arn=arn:aws:iam::$AWS_ACCOUNT_ID:policy/AWSLoadBalancerControllerIAMPolicy   --approve
```
we create the Iam ploicy and role to my eks cluster.
### 6 Install ALB Ingress Controller

```bash
helm repo add eks https://aws.github.io/eks-charts
helm repo update

export VPC_ID=$(aws eks describe-cluster --name cd-cluster   --query "cluster.resourcesVpcConfig.vpcId" --output text)

helm install aws-load-balancer-controller eks/aws-load-balancer-controller   -n kube-system   --set clusterName=cd-cluster   --set serviceAccount.create=false   --set serviceAccount.name=aws-load-balancer-controller   --set region=us-east-1   --set vpcId=$VPC_ID
```

```bash
kubectl rollout status deployment/aws-load-balancer-controller -n kube-system
kubectl get pods -n kube-system | grep aws-load
```
After running this commands you will get this like output that means your load-balancer is working
![image](https://github.com/user-attachments/assets/bf94d663-73d7-4c59-9bb8-6f7edfe6d9b1)

### 7 Deploy Application via Helm

```bash
kubectl create namespace monitoring
export SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

helm upgrade --install loginapp ./helm-chart   --namespace monitoring   --create-namespace   --set backend.sessionSecret="$SESSION_SECRET"   --set smtpAuth.username="<your-email-id>"   --set smtpAuth.password="<password>"   --set global.domain="go-web-app.local"   --wait
```
Make sure to your email id and password to get it go to your google account settings search for app passsword if there is no app password you need to enable two factor authentication.
### 8 Verify Deployment

```bash
helm list -n monitoring
kubectl get pods -n monitoring
kubectl get svc -n monitoring
kubectl get ingress -n monitoring -o wide
```
After running this commands make sure your this all are getting
![image](https://github.com/user-attachments/assets/2be7ce05-c1d6-409d-aeba-fd9a26ad7fc4)
![image](https://github.com/user-attachments/assets/84c2e39e-fa10-433e-b8c1-b07548b67c27)

### 9 Configure Local Hosts File

```bash
# Find Ingress IP
kubectl get ingress -n monitoring -o wide
nslookup <ingress-controller-service>
```
you will see 4 ingress after running the ingress command you need to check the thier ip address by using nslookup to attach in your windows or other machine where you working 
```bash
# Add to /etc/hosts (Linux/macOS) or C:\Windows\System32\drivers\etc\hosts (Windows) through open the notepad in admin account
<external-ip>        go-web-app.local
<external-ip>        grafana.go-web-app.local
<external-ip>        prometheus.go-web-app.local
<external-ip>        alertmanager.go-web-app.local
```
after adding please open the command prompt in admin and run the below to reslove the dns issue
# Flush DNS
```bash
ipconfig /flushdns  # Windows
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder  # macOS
```
After that access the website by using the below links 
```bash
APP: http://go-web-app.local (backend)

Prometheus: http://prometheus.go-web-app.local

Grafana: http://grafana.go-web-app.local

alertmanager: http://alertmanager.go-web-app.local
```
![image](https://github.com/user-attachments/assets/188e3a89-7ab7-4e92-a135-5b340f37fe54)

### 10 Test Monitoring and Alerts

```bash
kubectl logs -l app.kubernetes.io/name=alertmanager -n monitoring

# Prometheus Query Example
rate(process_cpu_seconds_total{container="backend"}[2m])
```
After checking the above commands it shows the alert manager is send the alert to the email or not
![image](https://github.com/user-attachments/assets/8aed407b-03d8-4ec7-96bd-3d84ea50620d)
![image](https://github.com/user-attachments/assets/40db833e-0d67-4ea0-b694-a8bc5529174f)
![image](https://github.com/user-attachments/assets/8b040324-81a3-49d3-8638-9c2b3f7b9744)

Until here the manual steps are completed you need to do this manual steps for first time in order to run the ci/cd pipeline
### 11 CI/CD Validation
## CI pipeline
To run the ci pipeline we used 2 requirement 
1. you need to just change the frontend or backend the trigger GitHub Actions CI will build Docker, scan with Trivy, upgrade Helm, and send Discord alert
2. if anyone change the hel-chart files the trigger GitHub Actions CI will directly deploy the helm with the pervious docker image tag version and send discord alert
now before running the code you neeed to add the all secret like username,password for email,SESSION_SECRET and discord link to get the discor link just create a account in discord and  create a discord server and go to server settings and under app there is intergration and click on webhook then select the link and paste in the github secret.
you need to add this like:
![image](https://github.com/user-attachments/assets/8865c9fc-be6b-4b7c-960f-10ca88623a9f)
once you added run the code by changing the values in frontend and go to action you can check the trigger will flow and you will see below output then your ci part is completed
![image](https://github.com/user-attachments/assets/5a6a17a0-4a1d-40e8-ba38-6d632d6ce1b3)
![image](https://github.com/user-attachments/assets/87affb57-1370-47c9-a275-f54fef8368ef)
![image](https://github.com/user-attachments/assets/ffd1864d-1916-4c22-93f7-b3903d4f4a22)
you can see your changes atlast in your app.
![image](https://github.com/user-attachments/assets/fa272e45-5e4c-4828-b60c-4f96b4a5ac81)
At last it will create the values-ci.yml file which it is used in argocd.
## Cd ArgoCD
# Step 1: Install ArgoCD on EKS
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```
This will install the argocd in your cluster
# Step 2: Expose ArgoCD with LoadBalancer
```bash
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "LoadBalancer"}}'
kubectl get svc argocd-server -n argocd
```
This will give the <external-ip> if copy and paste in the google you will get argocd app
# Step3: password for Argocd
```bash
kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | base64 -d
```
if you run this you will get password and username is admin and with this you can able to login.
# Step4: Access argocd from cli

in order to access the argocd using cli you need to install it please check prerequiste section to see how to download after than just ran below command
```bash
argocd login <ARGOCD-EXTERNAL-IP> --username admin --password <PASSWORD> --insecure
```
# Step5: creation the App and deploying the app in eks
```bash
argocd repo add <repo-url>
```
this command will add your repo to argocd registration then
Open ArgoCD UI:
1. http://<ARGOCD-EXTERNAL-IP>
2. Log in with your admin credentials
3. Click + NEW APP → Switch to YAML mode
4. In the Yaml mode just copy all the things inside my argocd.yml file and click save and create it will provide below output or you can run this below command
```bash
kubectl apply -f argocd.yaml -n argocd
```
![image](https://github.com/user-attachments/assets/70699f3e-162c-44cf-b97d-a772e1213fd8)
here if you check the values-ci.yml file the image and this image is same
![image](https://github.com/user-attachments/assets/7adbe017-9695-45de-8883-da39729206ae)
```bash
kubectl get pods -n monitoring -l app=backend
kubectl exec -it <backend-pod> -n monitoring -- /bin/sh
yes > /dev/null
```
This will also shows the image tag
### 12 Check MySQL Login Records

In order to check the MYSQL login records which we created using our app please go below steps
```bash
kubectl get pods -n monitoring | grep mysql
kubectl exec -it <mysql-pod> -n monitoring -- bash
mysql -u root -p  # password: Masters@2026
USE loginapp;
SHOW TABLES;
SELECT * FROM users;
```

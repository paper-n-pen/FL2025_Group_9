# FL2025: Group &lt;Group Number&gt; &lt;MicroTutor&gt;

Name your repository using the following format:  
**FL2025_Group_&lt;9&gt;**  

## Team Members

- **Sangwon Bae**: <b.sangwon@wustl.edu>; paper-n-pen
- **Yikang Wang**: <w.yikang@wustl.edu>; wangyk55
- **Mehak Sharma**: <mehak@wustl.edu>; mehaksharma30

## TA

Yiren Kang

## Objectives

A real-time tutoring platform that connects students with tutors for instant help in specific subjects. Students can post queries, tutors can accept them, and they can collaborate using an interactive whiteboard and chat system.

### Features

#### For Students

- **User Registration & Authentication**: Secure login/signup system
- **Query Posting**: Post questions with subject and subtopic selection
- **Real-time Notifications**: Get notified when tutors accept your queries
- **Tutor Selection**: View tutor profiles and rates before accepting
- **Interactive Whiteboard**: Collaborate with tutors using a shared whiteboard
- **Chat System**: Real-time messaging during sessions

#### For Tutors

- **Profile Setup**: Create detailed profiles with bio, education, and specialties
- **Query Management**: View and accept student queries matching your specialties
- **Rate Setting**: Set your rate per 10-minute session
- **Real-time Dashboard**: See new queries and manage accepted ones
- **Interactive Teaching**: Use whiteboard and chat to help students

#### Technical Features

- **Real-time Communication**: Socket.IO for instant notifications and chat
- **Interactive Whiteboard**: Canvas-based drawing with pen, eraser, and download features
- **Session Management**: Track active tutoring sessions
- **Responsive Design**: Professional UI that works on all devices
- **Authentication**: JWT-based secure authentication
- **AI Chatbot**: Site-wide AI assistant powered by Ollama (LLaMA models)

## How to Run

We recommend using Docker for an easy setup. Follow these steps:

1. **Clone the Repository**

   ```bash
   git clone <repository_url>
   cd <repository_directory>
   ```

2. **Build and Run with Docker**

   Make sure you have Docker installed. Then run:

   ```bash
   docker-compose up --build -d
   ```

3. **Access the Application**

   Open your browser and navigate to `http://localhost:80` to access the application.

## Kind Cluster Deployment

If you wish to run the entire system in a local Kind (Kubernetes in Docker) cluster, follow these steps:

1. **Prepare Kind and kubectl**

   Install Kind and kubectl, then create a cluster:

   ```bash
   kind create cluster --name microtutor
   ```

2. **Build Container Images**

   Build the backend and frontend images in your local Docker:

   ```bash
   docker build -t microtutor-backend:latest ./backend
   docker build -t microtutor-frontend:latest ./my-react-app
   ```

3. **Load Images into Kind**

   ```bash
   kind load docker-image microtutor-backend:latest --name microtutor
   kind load docker-image microtutor-frontend:latest --name microtutor
   ```

4. **Deploy to Kubernetes**

   The K8s manifests are located in `k8s/kind`. Apply them using Kustomize:

   ```bash
   kubectl apply -k k8s/kind
   ```

5. **Wait for Pods to be Ready and Verify**

   ```bash
   kubectl -n microtutor get pods
   ```

   Wait until all pods are Running, then execute:

   ```bash
   kubectl logs -n microtutor -f <ollama-pod-name>
   ```

   Confirm that the model pull is complete (look for the "Model pull complete." log).

6. **Access the Frontend**

   - Using port forwarding:

     ```bash
     kubectl -n microtutor port-forward service/frontend 8080:80
     ```

   Open your browser and navigate to `http://localhost:8080`.

# FL2025: Group &lt;Group Number&gt; &lt;Project Name&gt;

Name your repository using the following format:  
**SP2025_Group_&lt;Group Number&gt;**  
(Example: FL2025_Group_9)

## Team Members
- **&lt;Sangwon Bae&gt;**: &lt;b.sangwon@wustl.edu&gt; ; &lt;paper-n-pen&gt;
- **&lt;Yikang Wang&gt;**: &lt;w.yikang@wustl.edu&gt; ; &lt;wangyk55&gt;
- **&lt;Member Name&gt;**: &lt;Email Address&gt; ; &lt;Github ID&gt;

## TA
&lt;Yiren Kang&gt;

## Objectives
&lt;A real-time tutoring platform that connects students with tutors for instant help in specific subjects. Students can post queries, tutors can accept them, and they can collaborate using an interactive whiteboard and chat system. &gt;

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
&lt;We recommend using Docker for an easy setup. Follow these steps:&gt;
1. **Clone the Repository**  
   ```bash
   git clone &lt;repository_url&gt;
   cd &lt;repository_directory&gt;
   ```
2. **Build and Run with Docker**  
   Make sure you have Docker installed. Then run:
   ```bash
   docker-compose up --build -d
   ```
3. **Access the Application**  
   Open your browser and navigate to `http://localhost:80` to access the application.
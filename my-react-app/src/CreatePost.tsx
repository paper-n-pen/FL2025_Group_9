// my-react-app/src/CreatePost.tsx

// import { useState } from 'react';
// import axios from 'axios';

// function CreatePost() {
//   const [title, setTitle] = useState('');
//   const [content, setContent] = useState('');
//   const [message, setMessage] = useState('');

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     const token = localStorage.getItem('token');
//     if (!token) {
//       setMessage('You must be logged in to post.');
//       return;
//     }

//     try {
//       const res = await axios.post(
//         'http://localhost:3000/api/posts',
//         { title, content },
//         { headers: { Authorization: `Bearer ${token}` } }
//       );
//       setMessage('✅ Post created successfully!');
//       setTitle('');
//       setContent('');
//     } catch (err: any) {
//       console.error(err);
//       setMessage('❌ Failed to create post.');
//     }
//   };

//   return (
//     <form onSubmit={handleSubmit} style={{ maxWidth: 500, margin: '2rem auto' }}>
//       <h2>Create a Post</h2>
//       <input
//         type="text"
//         placeholder="Post title"
//         value={title}
//         onChange={e => setTitle(e.target.value)}
//         required
//         style={{ display: 'block', width: '100%', marginBottom: '1rem' }}
//       />
//       <textarea
//         placeholder="Write your post content..."
//         value={content}
//         onChange={e => setContent(e.target.value)}
//         required
//         style={{ display: 'block', width: '100%', height: '150px', marginBottom: '1rem' }}
//       />
//       <button type="submit">Publish</button>
//       {message && <p>{message}</p>}
//     </form>
//   );
// }

// export default CreatePost;

// src/pages/CreatePost.tsx
import React, { useState } from "react";
import axios from "axios";
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Avatar,
  Divider,
} from "@mui/material";
import EditNoteIcon from "@mui/icons-material/EditNote";
import { apiPath } from "./config";

export default function CreatePost() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "" }>({
    text: "",
    type: "",
  });

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(event.target.value);
  };

  const handleContentChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setContent(event.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      setMessage({ text: "You must be logged in to post.", type: "error" });
      return;
    }

    try {
      await axios.post(
        apiPath("/posts"),
        { title, content },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ text: "✅ Post created successfully!", type: "success" });
      setTitle("");
      setContent("");
    } catch (err) {
      console.error(err);
      setMessage({ text: "❌ Failed to create post.", type: "error" });
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom right, #f5f7ff, #e8f0ff)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        py: 8,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={6}
          sx={{
            p: 5,
            borderRadius: 4,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Header */}
          <Avatar sx={{ bgcolor: "primary.main", width: 60, height: 60, mb: 2 }}>
            <EditNoteIcon fontSize="large" />
          </Avatar>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Create a New Post
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center" mb={3}>
            Share your thoughts, resources, or ideas with the community
          </Typography>
          <Divider sx={{ mb: 3, width: "100%" }} />

          {/* Form */}
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 3 }}
          >
            <TextField
              label="Post Title"
              variant="outlined"
              value={title}
              onChange={handleTitleChange}
              required
              fullWidth
            />
            <TextField
              label="Post Content"
              variant="outlined"
              multiline
              minRows={6}
              value={content}
              onChange={handleContentChange}
              required
              fullWidth
            />

            <Button
              variant="contained"
              color="primary"
              size="large"
              type="submit"
              sx={{
                py: 1.2,
                fontWeight: "bold",
                borderRadius: 2,
              }}
            >
              Publish
            </Button>

            {message.text && (
              <Alert
                severity={message.type === "success" ? "success" : "error"}
                sx={{ mt: 2 }}
              >
                {message.text}
              </Alert>
            )}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

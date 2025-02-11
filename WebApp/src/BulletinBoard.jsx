import React, { useState, useEffect } from "react";
import axios from "axios";

const BulletinBoard = () => {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState({ title: "", content: "", category: "General" });
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState({});
  const userData = JSON.parse(localStorage.getItem("user")) || {};

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await axios.get("http://localhost:8081/get-posts");
      setPosts(res.data);
    } catch (error) {
      console.error("Error fetching posts:", error);
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.title || !newPost.content) return alert("Title and content are required.");

    try {
      await axios.post("http://localhost:8081/create-post", {
        user_id: userData.userId,
        user_role: userData.role,
        ...newPost
      });

      alert("Post submitted for moderation.");
      setNewPost({ title: "", content: "", category: "General" });
      fetchPosts();
    } catch (error) {
      console.error("Error creating post:", error);
    }
  };

  const handleViewComments = async (postId) => {
    setSelectedPost(postId);
    try {
      const res = await axios.get(`http://localhost:8081/get-comments/${postId}`);
      setComments((prev) => ({ ...prev, [postId]: res.data }));
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  return (
    <div>
      <h1>Bulletin Board</h1>

      <div>
        <h2>Create a Post</h2>
        <input type="text" placeholder="Title" value={newPost.title} onChange={(e) => setNewPost({ ...newPost, title: e.target.value })} />
        <textarea placeholder="Content" value={newPost.content} onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}></textarea>
        <select value={newPost.category} onChange={(e) => setNewPost({ ...newPost, category: e.target.value })}>
          <option value="Job Listing">Job Listing</option>
          <option value="Community Event">Community Event</option>
          <option value="Property Update">Property Update</option>
        </select>
        <button onClick={handleCreatePost}>Post</button>
      </div>

      {posts.map((post) => (
        <div key={post.post_id}>
          <h3>{post.title}</h3>
          <p>{post.content}</p>
          <button onClick={() => handleViewComments(post.post_id)}>View Comments</button>
          {selectedPost === post.post_id && comments[post.post_id]?.map((comment) => <p key={comment.comment_id}>{comment.content}</p>)}
        </div>
      ))}
    </div>
  );
};

export default BulletinBoard;

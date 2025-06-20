# Taskify

# 📧 Gmail Task Extractor with Google OAuth, Azure Inference & MongoDB

This Node.js Express application uses Gmail API, Google Tasks API, and Azure AI Inference to automatically detect actionable tasks in your emails and add them to your Google Tasks list.

---

## 🚀 Features

- ✅ Google OAuth2 Login
- ✅ Gmail Webhook Notifications (Push-based)
- ✅ Auto-detection of task-oriented emails using Azure AI
- ✅ Adds tasks to Google Tasks
- ✅ MongoDB for user persistence
- ✅ Secure credentials using dotenv

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Authentication:** Google OAuth 2.0
- **Database:** MongoDB + Mongoose
- **AI Integration:** Azure Inference API (e.g., LLaMA model)
- **Email Parsing:** Gmail API
- **Task Management:** Google Tasks API

---

## 📁 Project Structure

📦project-root
┣ 📄 schema.js
┣ 📄 .env
┣ 📄 .gitignore
┗ 📄 README.md

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000

# MongoDB
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/Emails?retryWrites=true&w=majority

# Azure Inference
AZURE_API_KEY=your_azure_api_key
AZURE_ENDPOINT=https://models.github.ai/inference
AZURE_MODEL=meta/Llama-4-Scout-17B-16E-Instruct

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback

✅ Setup Instructions
1. Clone the Repository

git clone https://github.com/your-username/gmail-task-ai.git
cd gmail-task-ai

2. Install Dependencies

npm install

3. Configure Google APIs
Go to Google Cloud Console

Create a new project and enable these APIs:

Gmail API

Google Tasks API

Go to "APIs & Services" → "OAuth consent screen"

Add required scopes:

https://www.googleapis.com/auth/gmail.readonly

https://www.googleapis.com/auth/gmail.modify

https://www.googleapis.com/auth/tasks

Set Authorized Redirect URI to:

http://localhost:3000/oauth2callback

4. Set Up MongoDB

Use MongoDB Atlas or a local instance

Add your connection string to .env under MONGO_URI

5. Create .env File

Follow the .env template in the previous section.

6. Start the Server

node server.js

📜 License
MIT License © 2025 shashisuhas

```

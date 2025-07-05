📜 SignetFlow Backend
The backend API for SignetFlow – a secure document e-signature system where users can upload PDFs, preview them, place signatures with custom fonts and precise coordinates, track signature status, and more.

Built with Node.js, Express, MongoDB, Multer, Nodemailer.

🚀 Features
User registration & login with JWT authentication
Secure PDF upload (Multer)
Serve uploaded PDFs
Signature placement with (x, y) coordinates and font style
Audit Trail: logs signer, timestamp, IP
Signature status (Pending, Signed, Rejected)
Email signed PDFs directly (Nodemailer)
Supports role-based sharing workflows

📂 Project Structure

/
├── server.js            # Entry point (Express setup)

├── .env                 # Environment variables

├── /routes              # Route definitions

│   ├── authRoutes.js    # Auth (register/login)

│   ├── ...              # Other route files

├── /controllers         # Logic for handling requests

├── /models              # Mongoose models

├── /middleware          # Custom middleware (auth, error, etc.)

├── /utils               # Utility functions (email, PDF, etc.)

├── /uploads             # Uploaded PDF storage

└── package.json         # Dependencies and scripts


⚙️ Installation

Clone the repo:

git clone https://github.com/JayThakor15/SignetFlow_Backend.git

cd signetflow-backend


Install dependencies:

npm install


🗝️ Environment Variables

Create a .env file in the root:

env

PORT=5000

MONGO_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret

EMAIL_USER=your_email@gmail.com

EMAIL_PASS=your_email_app_password

Add Client URL in utils > api.js 

CLIENT_URL=http://localhost:5173


✅ EMAIL_USER and EMAIL_PASS should use a Gmail App Password (not your real password).

🏃‍♂️ Running Locally

Server runs at: http://localhost:5000

API base path: /api


📦 API Routes

Auth

POST /api/auth/register

POST /api/auth/login


Documents

POST /api/docs/upload

GET /api/docs

DELETE /api/docs/:id


Signatures

POST /api/signature/place

POST /api/signature/accept/:id

POST /api/signature/reject/:id

POST /api/signature/finalize

GET /api/audit/:fileId

Share
POST /api/share/send

✉️ Email Sending
Uses Nodemailer with Gmail SMTP.

Enable 2-Step Verification on your Gmail
Create an App Password and use it in .env
🌐 Deployment
✅ Recommended free services:

Render for backend

Netlify for frontend

MongoDB Atlas for database

Update your CORS and .env as needed.


❤️ Contributions
Feel free to fork, star, or submit pull requests.

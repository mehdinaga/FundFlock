FundFlock

A mobile expense-sharing and payment management app built with React Native (Expo) and Node.js.

Tech Stack:

Frontend: React Native, Expo SDK 54, Expo Router, Axios, AsyncStorage

Backend: Node.js, Express, MongoDB (Mongoose), JWT, Stripe, Firebase, Nodemailer

FundFlock/
├── backend/
│   ├── config/          # DB, Firebase, Stripe configuration
│   ├── controllers/     # Route handlers (auth, etc.)
│   ├── middlewares/      # Auth, validation, error handling
│   ├── models/           # Mongoose models (User, Group, Expense, etc.)
│   ├── routes/           # Express route definitions
│   ├── utils/            # Helpers (email, token, balance calc)
│   ├── server.js         # Entry point
│   ├── .env.example      # Environment variables template
│   └── package.json
├── frontend/
    ├── app/              # Expo Router screens
    ├── src/
    │   ├── api/          # Axios client & API functions
    │   ├── components/   # Reusable UI components
    │   ├── context/      # React Context (AuthContext)
    │   ├── navigation/   # Navigation setup
    │   ├── screens/      # Screen components
    │   └── utils/        # Helpers (formatters, validators)
    └── package.json

Prerequisites:

Node.js >= 18.0.0

npm (comes with Node.js)

MongoDB account (MongoDB Atlas or local instance)

Expo Go app installed on your phone (from App Store / Play Store)

Setup:
1. Clone the repository:

git clone https://github.com/mehdinaga/FundFlock.git

cd FundFlock

3. Backend setup/run:

cd backend

npm install

npm run dev


5. Frontend setup/run:

cd Frontend

npm install

7. Configure the API URL:

Open frontend/src/api/client.js and update API_BASE_URL to your backend address:

const API_BASE_URL = 'http://<YOUR_IP_ADDRESS>:3000/api/v1';

4. Frontend run:

npm start

Scan the QR code with the Camera app (iOS) or Expo Go app (Android).

Make sure that the phone is on the same WiFi network as the laptop/pc you're running the project from 


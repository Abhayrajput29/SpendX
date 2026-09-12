# Finance AI Expense Tracker

Finance AI Expense Tracker is a full-stack personal-finance dashboard for recording expenses, understanding spending patterns, planning budgets, and finding recurring subscriptions. It includes an AI advisor, receipt OCR, automatic transaction categorization, forecasting, and a local fallback mode for development.

## What It Includes

- Dashboard with monthly spending totals, category breakdowns, budget progress, and recent activity
- Transaction management with search, filtering, editing, deletion, and automatic merchant/category detection
- Monthly budgets by spending category
- Spending forecast based on transaction history
- Subscription detection and recurring-payment tracking
- Receipt scanner using Tesseract OCR for JPG, JPEG, and PNG images
- Gemini-powered categorization, receipt parsing, forecasts, and financial-advisor responses
- MongoDB persistence with a local JSON fallback when MongoDB is unavailable
- Seed data for a new MongoDB database so the dashboard is immediately usable

## Technology

- Frontend: React, Vite, React Router, Chart.js, Lucide React
- Backend: Node.js, Express, Mongoose, Multer, Tesseract.js
- Database: MongoDB, with local JSON fallback
- AI: Google Gemini API, optional

## Requirements

Install these before starting:

- Node.js 20 or newer, with npm
- Git
- MongoDB 7 or newer, either running locally or a MongoDB Atlas connection string
- A Gemini API key if you want AI features. The application still runs with local fallback logic without one.

Check Node and npm:

```bash
node --version
npm --version
```

## Fork and Clone

1. Fork this repository on GitHub using the **Fork** button.
2. Clone your fork and enter the project directory:

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
```

Replace the URL and directory name with your fork's values.

## Install Dependencies

From the project root, install the root, server, and client dependencies:

```bash
npm run install:all
```

This runs `npm install` in the root, `server`, and `client` directories. If you prefer to install them separately:

```bash
npm install
cd server && npm install --legacy-peer-deps
cd ../client && npm install --legacy-peer-deps
cd ..
```

## Configure Environment Variables

Create a file named `server/.env`. Do not commit this file or share its contents.

```env
# Required: password used by the app sign-in screen
APP_PASSWORD=choose-a-password-at-least-8-characters-long

# Required in production: long random value used to sign session tokens
AUTH_SECRET=replace-with-a-long-random-secret

# Optional: defaults to the local database below
MONGODB_URI=mongodb://127.0.0.1:27017/expense_tracker

# Optional: enables Gemini-powered features
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: defaults to 5001
PORT=5001
```

You can start from the included template:

```bash
cp server/.env.example server/.env
```

Change `APP_PASSWORD` and `AUTH_SECRET` before starting. The application is single-owner by design: the password protects one private workspace. Do not use a shared password for multiple people or expose this prototype directly to the public internet without adding a real multi-user identity system.

### Getting a Gemini API key

Create a key in Google AI Studio and place it only in `server/.env`. If `GEMINI_API_KEY` is missing, the app uses local rule-based fallbacks where available, but interactive AI responses and some enhanced parsing features will be unavailable.

### Using MongoDB

For a local MongoDB installation, start MongoDB before starting the application. The default connection is:

```text
mongodb://127.0.0.1:27017/expense_tracker
```

For MongoDB Atlas, replace `MONGODB_URI` with your Atlas connection string. Make sure your IP address is allowed in Atlas network access and that the database user has permission to read and write.

If MongoDB cannot be reached, the server logs the connection error and uses the local JSON database service instead. This is convenient for a quick demo, but MongoDB is recommended for persistent multi-user or production use.

## Run the Application

From the project root:

```bash
npm run dev
```

This starts both processes:

- Frontend: http://localhost:5173
- Backend: http://localhost:5001
- Backend health check: http://localhost:5001/health

Open the frontend URL in your browser. The Vite development server proxies `/api` requests to the backend, so the browser does not need a separate API URL configuration.

The first screen asks for the `APP_PASSWORD` configured in `server/.env`. API requests use a signed bearer token, and uploaded receipts are served only through authenticated API requests.

You can also run each process separately in two terminals:

```bash
# Terminal 1
npm run server

# Terminal 2
npm run client
```

Stop either process with `Ctrl+C`.

## First Run Behavior

When MongoDB is connected and has no transactions, the server seeds approximately twelve months of sample transactions and budgets. This gives the dashboard data to display immediately.

When MongoDB is unavailable, the server uses its local JSON data service. Local database data and uploaded receipts are intentionally ignored by Git, so each developer has an independent local data set.

## Using the App

1. Open the Dashboard to review monthly totals and category spending.
2. Use Transactions to add, search, filter, edit, or delete expenses.
3. Set category limits in Budgets and compare actual spending with planned spending.
4. Open Forecast to review projected spending and apply recommendations where available.
5. Use Subscriptions to detect repeated payments and manage recurring expenses.
6. Use OCR Scanner to upload a receipt and review the extracted transaction before saving it.
7. Use AI Advisor for monthly analysis and interactive questions when `GEMINI_API_KEY` is configured.

Receipt uploads must be JPG, JPEG, or PNG files no larger than 5 MB.

## Available Scripts

Run these commands from the project root:

| Command | Purpose |
| --- | --- |
| `npm run install:all` | Install root, server, and client dependencies |
| `npm run dev` | Start frontend and backend together |
| `npm run server` | Start only the backend in watch mode |
| `npm run client` | Start only the Vite frontend |
| `npm run start` | Alias for `npm run dev` |

Run these commands from `client`:

| Command | Purpose |
| --- | --- |
| `npm run build` | Create a production frontend build in `client/dist` |
| `npm run lint` | Run Oxlint |
| `npm run preview` | Preview the production frontend build |

Run backend tests from `server` with `npm test`.

## Project Structure

```text
.
├── client/
│   ├── src/
│   │   ├── views/          # Dashboard, transactions, budgets, OCR, AI, and other screens
│   │   ├── App.jsx         # Frontend routes and application shell
│   │   └── main.jsx        # React entry point
│   └── vite.config.js      # Development server and API proxy
├── server/
│   ├── models/             # Mongoose data models
│   ├── routes/             # Express API routes
│   ├── services/           # AI, OCR, forecast, subscription, seed, and JSON services
│   ├── uploads/            # Runtime receipt uploads, created automatically
│   ├── server.js           # Express and database entry point
│   └── eng.traineddata     # English Tesseract OCR data
├── package.json             # Root scripts for both applications
└── .gitignore
```

## Troubleshooting

### The frontend loads but data is missing

Confirm that the backend is running and visit http://localhost:5001/health. If the backend is not running, start it with `npm run server`.

### MongoDB connection errors

Start local MongoDB, or check `MONGODB_URI`, the Atlas IP allowlist, and database credentials. The application can run in JSON fallback mode, but data will be local to that checkout.

### AI features are unavailable

Check that `server/.env` contains a valid `GEMINI_API_KEY`, then restart the backend. Environment changes are read when the server starts.

### Port 5001 or 5173 is already in use

Stop the process using the port. The backend port can be changed with `PORT` in `server/.env`, but the Vite proxy target in `client/vite.config.js` must be changed to the same port.

### OCR scanning fails

Use a clear JPG, JPEG, or PNG receipt under 5 MB. Ensure the backend is running and that `server/eng.traineddata` is present.

## Deployment to Vercel

This repository includes [`vercel.json`](./vercel.json) and a serverless API adapter ([`api/index.js`](./api/index.js)) for full-stack deployment on [Vercel](https://vercel.com).

### 1. Push to GitHub
Ensure all changes are pushed to your `main` branch.

### 2. Import into Vercel
1. Log in to [vercel.com](https://vercel.com) and click **Add New...** → **Project**.
2. Select your repository (`SpendX`).
3. Leave **Root Directory** as `./`.

### 3. Set Environment Variables
In Project Settings → Environment Variables, add:

- `MONGODB_URI`: Your MongoDB Atlas URI (`mongodb+srv://...`)
- `GEMINI_API_KEY`: Google Gemini API key
- `GEMINI_MODEL`: `gemini-1.5-flash`
- `AUTH_SECRET`: Random 32+ character JWT secret string
- `APP_PASSWORD`: Admin password for authentication
- `NODE_ENV`: `production`

> **Note**: In MongoDB Atlas Network Access, ensure IP `0.0.0.0/0` (Allow Access from Anywhere) is enabled so Vercel's dynamic serverless functions can connect.

### 4. Deploy
Click **Deploy**. Vercel will build the frontend and serve both the static Vite app and the `/api` serverless backend on the same domain.

## Security Notes

- Never commit `server/.env`, API keys, passwords, or database credentials.
- If a key is accidentally pushed, revoke it immediately and create a replacement. Removing it in a later commit is not enough.
- This project is intended as a prototype. Add authentication, authorization, rate limiting, input hardening, and production secrets management before deploying it publicly.

## Contributing

1. Create a feature branch.
2. Make and test your changes.
3. Run `cd client && npm run lint && npm run build`.
4. Open a pull request describing the change and any setup requirements.

## License

No license has been specified yet. Add a license before distributing this project for reuse.
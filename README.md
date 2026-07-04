# Medi-Connect (Healthcare Appointment & Follow-up Manager)

Medi-Connect is a full-stack, AI-powered healthcare booking, management, and patient coordination portal. Built on **React (Vite)**, **Express**, and **PostgreSQL (via Drizzle ORM)**, the platform streamlines interactions between patients, doctors, and administrators through role-based access, automated system integration, and advanced intelligence.

---

## 🌟 Core Features

### 📅 1. Interactive Practice & Patient Calendar
*   **Aesthetic Visual Agenda**: View consultations on a high-contrast monthly grid.
*   **Color-Coded Consultation States**: Dynamic indicators represent appointment status:
    *   🟢 **Active/Scheduled**: Upcoming appointments with full patient/doctor context.
    *   🔵 **Completed**: Historic consultations including clinical notes.
    *   🔴 **Cancelled**: Cancelled timeslots.
*   **Interactive Sidebar**: Click any calendar day to list scheduled slots, review chief complaints, or issue/view cancellations in real-time.

### 📧 2. Automated Email Notifications (SMTP)
*   **Booking Confirmations**: Immediately after booking, a confirmation email is triggered to the patient's registered mail using a lazy-loaded secure SMTP service.
*   **Clinical Activity Tracking**: Tracks outbound emails using a dedicated persistent backend database table (`email_logs`) enabling full administration auditing.

### 🤖 3. Clinical Intelligence (Gemini AI SDK)
*   **Symptom Diagnostic Triage**: Evaluates patient-submitted chief complaints upon slot booking to provide pre-visit triage indicators (High, Medium, or Low urgency).
*   **Smart Clinical Summaries**: Enables doctors to synthesize comprehensive session briefs and prescribe electronic medications rapidly.

### 🌐 4. Google Calendar Integration
*   **Real-time Synchronization**: Two-way sync with Google Calendar via secure OAuth 2.0.
*   **Automatic Invites**: Generates custom event IDs and populates calendar blocks with consultation links.

### 👥 5. Role-Based Portals
*   **Patient Dashboard**: Request consultation holds, review prescription histories, and track upcoming appointments.
*   **Doctor Dashboard**: Manage electronic rosters, review triage parameters, write notes, and approve holds.
*   **Admin Dashboard**: Manage doctor allocations, track clinic stats, and inspect email delivery logs.

---

## 🛠️ Technology Stack

*   **Frontend**: React (Vite), Tailwind CSS (Aesthetic Charcoal & Mint Slate Palette), Lucide React (Icons), Framer Motion (Transitions).
*   **Backend**: Node.js, Express.js.
*   **Database**: PostgreSQL, Drizzle ORM (Type-safe schemas & migrations).
*   **Mailing**: Nodemailer (SMTP Gateway).
*   **Third-Party APIs**: Google Generative AI (`@google/genai`), Google Calendar API (OAuth 2.0).

---

## 📂 Project Structure

```bash
├── src/
│   ├── api/                 # Express REST endpoint modules (auth, appointments, etc.)
│   ├── components/          # React components (Patient/Doctor/Admin Portals, Calendar)
│   ├── db/                  # Drizzle ORM configuration, database pool, and schema definitions
│   ├── middleware/          # Server authentication and session guard rails
│   ├── services/            # Core integration systems (Nodemailer, Gemini SDK, Calendar Sync)
│   ├── types.ts             # Shared type definitions
│   ├── main.tsx             # Frontend entry point
│   └── index.css            # Global styling with custom Tailwind pairings
├── server.ts                # Production and development full-stack entry server
├── metadata.json            # Application platform configuration
└── .env.example             # Safe template for workspace credentials
```

---

## ⚙️ Environment Configuration

To configure and run the application locally, create a `.env` file in the root directory using the fields outlined in `.env.example`:

```env
# Database Credentials
SQL_HOST="your_db_host"
SQL_USER="your_db_username"
SQL_PASSWORD="your_db_password"
SQL_DB_NAME="your_database_name"
SQL_PORT=5432

# Google OAuth 2.0 Credentials (for Google Calendar Sync)
GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/auth/google/callback"

# SMTP Mail Server Configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your_configured_smtp_user@gmail.com"
SMTP_PASSWORD="your_smtp_app_password"
SMTP_FROM="your_configured_smtp_user@gmail.com"

# Gemini AI API Key
GEMINI_API_KEY="your_gemini_api_key"

# Application Security
JWT_SECRET="your_custom_jwt_signing_token"
```

---

## 🚀 Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Your Database
Run migrations to generate tables such as `users`, `appointments`, and `email_logs`:
```bash
npm run db:push
```

### 3. Launch Development Server
```bash
npm run dev
```
The server will boot on `http://localhost:3000` executing both backend API controllers and mounting the Vite client middleware.

### 4. Build for Production
```bash
npm run build
npm start
```

---

## 🔒 Security Best Practices
*   **Secrets Isolation**: Never push `.env` configurations or real API credentials to public repositories. Set all environment configurations using GitHub Actions Secrets or platform variables.
*   **Lazy Transporter Loading**: The backend is configured to construct client sessions (SMTP/Google Client) lazily to prevent crashing on server boot if any key is momentarily unset.


DEPLOYED LINK :  https://healthcare-appointment-follow-up-manager-544607927104.asia-southeast1.run.app

# Teens Software Solutions - Admin Portal

HR Management SaaS for managing employee data, documents, and more.

## Tech Stack
- **Framework:** Next.js 16 (App Router)
- **Database/Auth:** Supabase
- **Storage/Media:** Cloudinary
- **Styling:** Tailwind CSS v4
- **Language:** TypeScript

## Prerequisites
- Node.js 18+
- Supabase Project (Database, Auth, Storage)
- Cloudinary Account (for Document Storage)

## Setup Instructions

1. **Clone the repo**
   ```bash
   git clone <repository-url>
   cd admin-teens
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create Environment Variables**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```

4. **Initialize Database Schema**
   - Go to your Supabase Dashboard > SQL Editor
   - Copy and paste the contents of `schema.sql` (create this file with tables needed)
   - Click 'Run' to execute the migration

5. **Start the Development Server**
   ```bash
   npm run dev
   ```

6. **Seed Initial Data**
   Run the following command or visit the URL using an API client to generate the default admin accounts and sample employees:
   ```bash
   curl -X POST http://localhost:3000/api/seed
   ```

7. **Login Credentials (After Seeding)**
   - CEO: `ceo@teenssoftware.com` / `Admin@123`
   - HR: `hr@teenssoftware.com` / `Admin@123`

## Features
- **Role-Based Access Control:** Differentiated access levels for CEO and HR.
- **Employee Management:** Complete CRUD operations for employee records.
- **Document Management:** Securely upload and manage employee documents using Cloudinary.
- **Dashboard Analytics:** High-level metrics and overviews.
- **Search & Filtering:** Easily locate employees based on various criteria.

## Folder Structure
- `/app`: Next.js 16 App Router pages, layouts, and API routes.
- `/components`: Reusable UI components.
- `/lib`: Utilities, shared types, and configuration files (like Supabase clients).
- `/public`: Static assets like the organization logo.

## Database Schema Overview
- `profiles`: Extended user data (role, full_name).
- `departments`: Organization departments.
- `employees`: Core employee information, relationships to departments.
- `employee_documents`: References to securely stored documents.

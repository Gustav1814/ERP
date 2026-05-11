<div align="center">

# HB Group Enterprise Resource Planning

**A modern, full-stack ERP system for managing companies, orders, inventory, and operations.**

Built with **Laravel 10** + **React 19** + **Tailwind CSS 4** + **Recharts**

[![PHP](https://img.shields.io/badge/PHP-8.1+-8892BF?style=for-the-badge&logo=php&logoColor=white)](https://php.net)
[![Laravel](https://img.shields.io/badge/Laravel-10-FF2D20?style=for-the-badge&logo=laravel&logoColor=white)](https://laravel.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

<br />

<img src="https://raw.githubusercontent.com/Gustav1814/ERP/main/.github/screenshot-dark.png" alt="Dashboard Dark Mode" width="100%" />

</div>

---

## Overview

HB Group ERP is a comprehensive enterprise resource planning platform designed for managing the full lifecycle of company relationships, order processing, inventory tracking, and operational workflows. It features a polished React SPA frontend with dark/light theme support, real-time dashboards, and a robust Laravel REST API backend.

---

## Features

### Dashboard & Analytics
- **Real-time KPI tiles** — Companies, Orders, Completed, New (24h)
- **Order Pipeline chart** — Weekly intake flow with Received / Validated / Committed stages
- **Industry Types donut** — Visual breakdown of company distribution by industry
- **Mini sparkline trends** — Inline trend indicators on each KPI card

### Company Management
- **Full CRUD** for companies with contact details, addresses, and user associations
- **Inline editing** of company name, contact info, billing/pickup addresses
- **Nested order view** — Expand any company to see all associated orders
- **Industry type tagging** and customer type classification
- **Project manager assignment**

### Order Management
- **Order creation modal** — Create orders linked to existing or new companies
- **Order detail panel** — Rich inventory detail view with device entries and summary rows
- **Pickup scheduling** — Pickup date, address selection, BOL tracking
- **Service catalog integration** — Tag orders with service types from configurable catalog
- **Certificate uploads** — Presigned S3 uploads for order certificates
- **Status pipeline** — `new` → `scheduled` → `in_progress` → `completed` → `cancelled`
- **Idempotency protection** — Duplicate order detection via `X-Idempotency-Key` headers

### CRM Integration
- **Bidirectional sync** with HB Leads CRM via signed handoff tokens
- **Import commit workflow** — Review and commit CRM-pushed data into ERP
- **Field mapping configuration** — Customizable CRM-to-ERP field mappings
- **Push status monitoring** — Track sync status of CRM pushes

### User Management & Security
- **Role-based access control** — Powered by `spatie/laravel-permission`
- **Granular permissions** — `companies.view`, `orders.edit`, `settings.manage`, etc.
- **User CRUD** with role assignment and forced password change on first login
- **Sanctum token authentication** with secure session management
- **Activity logging** — Track all user actions with timestamps and IP addresses

### Settings & Configuration
- **Service catalog** — Manage available service types
- **Inventory types** — Configure device types with dimensions and weight profiles
- **Pickup-by options** — Manage pickup carrier options
- **Industry types** — Manage industry classification options
- **Account managers** — Manage account manager assignments
- **Theme customization** — Dark/Light mode with multiple accent color presets

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Laravel 10, PHP 8.1+, Sanctum Auth, Spatie Permissions |
| **Frontend** | React 19, TypeScript 5.8, Vite 6 |
| **Styling** | Tailwind CSS 4, CSS custom properties theming |
| **Charts** | Recharts 3 |
| **Icons** | Lucide React |
| **Animations** | Framer Motion |
| **Database** | MySQL / MariaDB |
| **File Storage** | AWS S3 (via Flysystem) |

---

## Project Structure

```
ERP/
├── app/
│   ├── Http/
│   │   ├── Controllers/Api/       # REST API controllers
│   │   │   ├── Crm/               # CRM integration endpoints
│   │   │   └── Admin/             # Admin management endpoints
│   │   ├── Middleware/            # Auth, CORS, permission guards
│   │   └── Requests/             # Form request validation
│   ├── Models/Crm/               # Eloquent models
│   └── Services/Crm/             # Business logic services
├── database/
│   ├── migrations/               # 26 migration files
│   └── seeders/                  # Database seeders
├── frontend/
│   └── src/
│       ├── components/           # Reusable UI components
│       │   ├── order/            # Order detail panel
│       │   ├── Sidebar.tsx       # Navigation sidebar
│       │   ├── TopBar.tsx        # Header bar
│       │   └── ui.tsx            # Design system primitives
│       ├── context/              # React context providers
│       ├── data/                 # Static data & type definitions
│       ├── lib/                  # Utility functions & API helpers
│       ├── pages/                # Page-level components
│       │   ├── CompaniesPage.tsx
│       │   ├── OrdersPage.tsx
│       │   ├── UserManagementPage.tsx
│       │   ├── ActivityLogsPage.tsx
│       │   ├── SettingsPage.tsx
│       │   └── ...
│       ├── App.jsx               # Root app with routing & layout
│       ├── theme.js              # Theme engine (dark/light/accents)
│       └── index.css             # Global styles & Tailwind
├── routes/
│   ├── api.php                   # API route definitions
│   └── web.php                   # SPA catch-all route
└── public/build/                 # Production frontend build
```

---

## Getting Started

### Prerequisites

- **PHP** >= 8.1
- **Composer** >= 2.x
- **Node.js** >= 18.x
- **npm** >= 9.x
- **MySQL** or **MariaDB**

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Gustav1814/ERP.git
cd ERP

# 2. Install PHP dependencies
composer install

# 3. Install frontend dependencies
cd frontend && npm install && cd ..

# 4. Environment setup
cp .env.example .env
php artisan key:generate

# 5. Configure your database in .env
#    DB_DATABASE=erp
#    DB_USERNAME=root
#    DB_PASSWORD=

# 6. Run migrations
php artisan migrate

# 7. Seed permissions and default admin (if seeder exists)
php artisan db:seed

# 8. Build frontend
npm run build

# 9. Start the server
php artisan serve --port=3000
```

Visit **http://localhost:3000** in your browser.

### Development Mode

```bash
# Terminal 1 — Laravel API
php artisan serve --port=3000

# Terminal 2 — Vite dev server (HMR)
cd frontend && npm run dev
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/login` | Login with email/password |
| `POST` | `/api/logout` | Invalidate session |
| `GET` | `/api/me` | Get authenticated user info |

### Companies
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/crm/companies` | List all companies with orders |
| `GET` | `/api/v1/crm/companies/search` | Search companies by name |
| `PATCH` | `/api/v1/crm/companies/{id}` | Update company details |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/crm/orders` | Create new order |
| `GET` | `/api/v1/crm/orders/{id}` | Get order details |
| `PATCH` | `/api/v1/crm/orders/{id}` | Update order |
| `POST` | `/api/v1/crm/orders/{id}/certificates` | Upload certificates |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/crm/settings/services` | List service catalog |
| `GET` | `/api/v1/crm/settings/inventory-types` | List inventory types |
| `GET` | `/api/v1/crm/settings/industry-types` | List industry types |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/users` | List all users |
| `POST` | `/api/admin/users` | Create user |
| `GET` | `/api/admin/activity-logs` | View activity logs |

---

## Screenshots

| Dark Mode | Light Mode |
|:---------:|:----------:|
| Dashboard with real-time KPIs, pipeline chart, and industry breakdown | Clean light theme with the same feature set |

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_DATABASE` | Database name | `erp` |
| `DB_USERNAME` | Database user | `root` |
| `DB_PASSWORD` | Database password | — |
| `AWS_ACCESS_KEY_ID` | S3 access key (certificates) | — |
| `AWS_SECRET_ACCESS_KEY` | S3 secret key | — |
| `AWS_DEFAULT_REGION` | S3 region | `us-east-1` |
| `AWS_BUCKET` | S3 bucket name | — |
| `VITE_ERP_CRM_OPTIONAL` | Enable standalone mode (no CRM) | `true` |

---

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).

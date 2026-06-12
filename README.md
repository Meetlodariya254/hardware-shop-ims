# Hardware Shop Inventory Management System

A comprehensive, desktop-based Inventory Management System built specifically for hardware shops. This application is powered by Electron, featuring a React frontend and a Node.js/Express backend with a local SQLite database, providing a fast, offline-first, and seamless user experience.

## Features

- **Desktop Experience:** Packaged as a standalone Windows executable (.exe) using Electron.
- **Inventory Tracking:** Full CRUD operations to manage hardware products, stock levels, and pricing.
- **Authentication:** Secure local login system with hashed passwords.
- **Reporting & Exports:** Generate professional PDF invoices and export data to Excel files.
- **Auto-Updates:** Integrated background updates to seamlessly receive the latest features and bug fixes.
- **Local Database:** Powered by SQLite, ensuring all data remains safely stored on the user's local machine without needing an active internet connection.

## Technology Stack

- **Frontend:** React, Vite
- **Backend:** Node.js, Express.js
- **Database:** SQLite (better-sqlite3)
- **Desktop Framework:** Electron, Electron Builder, Electron Updater
- **Utilities:** PDFKit (PDF generation), ExcelJS (Excel exports), Nodemailer (Email notifications)

## Prerequisites

To run or build this project locally, you will need:
- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- npm (comes with Node.js)

## Getting Started

Follow these steps to set up the project on your local machine for development.

### 1. Installation

Clone the repository (if applicable) and navigate into the project directory:
```bash
cd inventory-system
```

Install all dependencies for the root, frontend, and backend:
```bash
npm install
npm install --prefix frontend
npm install --prefix backend
```

### 2. Running in Development Mode

To start the application in development mode (which simultaneously starts the React frontend, the Express backend, and the Electron window), simply run:

```bash
npm run dev
```
*Note: This utilizes `concurrently` to run all necessary servers at once. The Electron window will open automatically once the React server is ready.*

## Building the Application for Production

When you are ready to compile the application into a standalone Windows installer (`.exe`), run the following command:

```bash
npm run pack:win
```

This command will:
1. Build the React frontend for production.
2. Package the frontend, backend, and Electron wrapper together using `electron-builder`.
3. Output the final installer to the `dist-app/` directory.

You can then share the `.exe` file generated in the `dist-app/` folder with clients to install the application on their PCs.

## Application Structure

- `/frontend` - Contains the React application (UI/UX).
- `/backend` - Contains the Express server, SQLite database configuration, and API routes.
- `main.js` - The entry point for the Electron desktop application window.
- `package.json` - Root configuration containing the build scripts and dependencies.

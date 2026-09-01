# Executive Hostel Management System

A comprehensive hostel management system for Soroti University, built with React, Node.js, Express, and PostgreSQL.

## 📋 System Overview

The Executive Hostel Management System is a full-stack web application for:
- **Student Applications**: Apply for accommodation online
- **Room Management**: Track room availability and assignments
- **Payment Processing**: Record and verify payment evidence
- **Admin Dashboard**: Manage students, rooms, payments, and reports
- **Notifications**: Send announcements and alerts to students
- **Audit Logging**: Track all system activities

### Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Frontend | React + TypeScript | 18.3 |
| Frontend Build | Vite | 5.4 |
| Backend | Node.js + Express | 20+ |
| Database | PostgreSQL | 13+ |
| ORM | Prisma | 5.20 |
| File Storage | Backblaze B2 (S3-compatible) | - |
| Deployment | Vercel (Frontend), Render (Backend) | - |

---

## 🚀 Quick Start

### Local Development

1. **Install dependencies**
   ```bash
   # Backend
   cd executive-hostel-api
   npm install
   
   # Frontend
   cd ../executive-hostel-web
   npm install
   ```

2. **Set up environment**
   ```bash
   # Backend
   cd executive-hostel-api
   cp .env.example .env
   # Edit .env with your database URL and secrets
   ```

3. **Start development servers**
   ```bash
   # Backend (terminal 1)
   cd executive-hostel-api
   npm run dev
   # Runs on http://localhost:4000
   
   # Frontend (terminal 2)
   cd executive-hostel-web
   npm run dev
   # Runs on http://localhost:5173
   ```

4. **Initialize database**
   ```bash
   # In executive-hostel-api directory
   npm run prisma:migrate
   npm run seed
   ```

See individual README files:
- [Backend Setup](executive-hostel-api/README.md)
- [Frontend Setup](executive-hostel-web/README.md)

---

## 📚 Deployment Guides

### Having Deployment Issues?

🔴 **[See DEPLOYMENT_ISSUES_AND_FIXES.md](DEPLOYMENT_ISSUES_AND_FIXES.md)** for:
- Root cause analysis of current issues
- Complete resolution steps
- Troubleshooting checklist
- Common problems and solutions

### Step-by-Step Deployment

1. **Follow the Deployment Checklist**: [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)
   - Prerequisites
   - Service setup (database, S3, email)
   - Complete end-to-end deployment
   - Testing procedures

2. **Backend (Render)**: [RENDER_DEPLOYMENT_GUIDE.md](RENDER_DEPLOYMENT_GUIDE.md)
   - Detailed Render configuration
   - Environment variables required
   - Database setup
   - Troubleshooting specific to backend

3. **Frontend (Vercel)**: [VERCEL_DEPLOYMENT_GUIDE.md](VERCEL_DEPLOYMENT_GUIDE.md)
   - Vercel configuration
   - Environment variable setup
   - Testing deployment
   - Common frontend issues

---

## 🔧 Project Structure

```
executive-hostel/
├── executive-hostel-api/          # Backend API
│   ├── src/
│   │   ├── lib/                   # Configuration & utilities
│   │   ├── routes/                # API endpoints
│   │   ├── services/              # Business logic
│   │   ├── middleware/            # Auth, logging, etc.
│   │   └── index.ts               # Express server
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema
│   │   └── seed.ts                # Sample data
│   ├── docker-compose.yml         # Local Postgres
│   ├── Dockerfile                 # Production image
│   └── README.md                  # Backend docs
│
├── executive-hostel-web/          # Frontend React app
│   ├── src/
│   │   ├── components/            # React components
│   │   ├── pages/                 # Page components
│   │   ├── context/               # Auth context
│   │   ├── lib/                   # API client, utilities
│   │   └── App.tsx                # Main component
│   ├── vite.config.ts             # Vite configuration
│   ├── vercel.json                # Vercel configuration
│   └── README.md                  # Frontend docs
│
└── docs/
    └── executive-hostel-design-docs.md  # Full system design
```

---

## 🌐 Deployed Instances

After deployment, your application will be available at:

- **Frontend (Student & Admin Portal)**: `https://your-vercel-app.vercel.app`
- **Backend API**: `https://your-render-api.onrender.com`
- **API Health Check**: `https://your-render-api.onrender.com/health`

---

## 📖 API Documentation

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/auth/register` | Student self-registration |
| POST | `/api/v1/auth/login` | Student/Staff login |
| GET | `/api/v1/rooms/available` | Public: View available rooms |
| POST | `/api/v1/applications` | Student: Submit application |
| GET | `/api/v1/admin/students` | Admin: List all students |
| POST | `/api/v1/payments/verify` | Admin: Verify payment evidence |

**Full API Documentation:** See [executive-hostel-design-docs.md](docs/executive-hostel-design-docs.md)

---

## 🔐 Security Features

- **JWT Authentication**: Secure token-based auth with refresh tokens
- **Password Hashing**: Argon2id password hashing
- **CORS Protection**: Whitelist allowed origins
- **Rate Limiting**: 300 requests per 15 minutes
- **Helmet Security Headers**: HTTP security hardening
- **Audit Logging**: Track all user actions
- **Authorization Middleware**: Role-based access control (RBAC)
- **Private S3 Bucket**: Payment evidence stored securely

---

## 🗄️ Database Schema

The system includes a complete Prisma schema covering:

- **Users**: Students, administrators, landlady, staff
- **Rooms**: 72 rooms with types, sections, and occupancy
- **Fees**: Versioned accommodation fees
- **Payments**: Payment tracking with evidence verification
- **Applications**: Student accommodation applications
- **Assignments**: Room allocation history
- **Announcements**: Admin-to-student notifications
- **Audit Logs**: Complete activity audit trail

---

## 🧪 Testing

### Run Tests

```bash
cd executive-hostel-api
npm run test
```

Tests cover:
- Payment balance calculations
- Phone number normalization
- Authentication flows
- Authorization checks

### Test Credentials (After Seed)

```
Email: test@example.com
Password: correcthorsebattery
Role: student
```

---

## 🔄 Environment Variables

### Backend (.env)

```
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=<random_hex>
JWT_REFRESH_SECRET=<random_hex>
CORS_ORIGINS=https://your-frontend.vercel.app
S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com
S3_REGION=us-west-004
S3_BUCKET=your-bucket
S3_ACCESS_KEY_ID=<key>
S3_SECRET_ACCESS_KEY=<secret>
RESEND_API_KEY=<optional>
EMAIL_FROM=Executive Hostel <noreply@yourdomain.com>
APP_URL=https://your-frontend.vercel.app
```

### Frontend (Vercel)

```
VITE_API_BASE_URL=https://your-render-api.onrender.com
```

See [RENDER_DEPLOYMENT_GUIDE.md](RENDER_DEPLOYMENT_GUIDE.md) for complete variable descriptions.

---

## 📱 Features by Role

### Student Features
- ✅ View available rooms
- ✅ Apply for accommodation
- ✅ Submit payment evidence
- ✅ View personal profile
- ✅ Receive notifications
- ✅ View accommodation guidelines
- ✅ Check payment balance

### Administrator Features
- ✅ Manage students and staff
- ✅ View all rooms and assignments
- ✅ Verify payment evidence
- ✅ Generate reports
- ✅ Send announcements
- ✅ Configure system settings
- ✅ View audit logs

### Landlady Features
- ✅ All admin features
- ✅ Manage fees
- ✅ Assign/reassign rooms
- ✅ Record check-in/check-out

---

## 🐛 Troubleshooting

### Deployment Issues
👉 **[See DEPLOYMENT_ISSUES_AND_FIXES.md](DEPLOYMENT_ISSUES_AND_FIXES.md)**

### Common Problems

| Problem | Solution |
|---------|----------|
| "Something went wrong" on frontend | Check `VITE_API_BASE_URL` environment variable |
| CORS errors | Update `CORS_ORIGINS` on backend to include frontend URL |
| Database connection fails | Verify `DATABASE_URL` is correct and accessible |
| File uploads fail | Check S3 credentials and bucket permissions |
| Emails not sending | Set `RESEND_API_KEY` and verify domain |

---

## 📞 Support

1. **Check the guides**: Start with [DEPLOYMENT_ISSUES_AND_FIXES.md](DEPLOYMENT_ISSUES_AND_FIXES.md)
2. **Review server logs**: Check Render/Vercel deployment logs
3. **Verify environment**: Double-check all environment variables
4. **Test endpoints**: Use `curl` to test API directly
5. **Browser DevTools**: Check Network tab for API errors

---

## 📝 Development Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feature/new-feature
   ```

2. **Make changes**
   - Update code
   - Test locally
   - Add tests if needed

3. **Commit and push**
   ```bash
   git add .
   git commit -m "Add new feature"
   git push origin feature/new-feature
   ```

4. **Create pull request**
   - On GitHub, open a PR
   - Vercel/Render will build preview automatically

5. **Merge to main**
   - After review, merge PR
   - Production deployment auto-triggers

---

## 🚢 Production Checklist

Before going live:

- [ ] Database backups enabled
- [ ] All environment variables set (no placeholders)
- [ ] S3 bucket is PRIVATE (not public)
- [ ] Email service configured and tested
- [ ] CORS_ORIGINS includes production URL only
- [ ] SSL/HTTPS enabled (automatic on Vercel/Render)
- [ ] Rate limiting configured appropriately
- [ ] Audit logging working
- [ ] Admin account created
- [ ] System tested end-to-end

---

## 📄 Documentation

- **System Design**: [docs/executive-hostel-design-docs.md](docs/executive-hostel-design-docs.md)
- **Backend**: [executive-hostel-api/README.md](executive-hostel-api/README.md)
- **Frontend**: [executive-hostel-web/README.md](executive-hostel-web/README.md)
- **Deployment**: [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)
- **Troubleshooting**: [DEPLOYMENT_ISSUES_AND_FIXES.md](DEPLOYMENT_ISSUES_AND_FIXES.md)

---

## 🎓 Learning Resources

### Local Development
1. Start with `npm run dev` in both backend and frontend
2. Check logs for errors
3. Use browser DevTools to inspect network requests
4. Prisma Studio: `npm run prisma:studio` (view/edit database)

### Contributing
1. Read system design docs
2. Follow existing code patterns
3. Add tests for new features
4. Keep commits focused and descriptive

---

## 📜 License

[Add your license here]

---

## 👥 Team

**Created for:** Soroti University, Executive Hostel  
**Framework:** Full-stack JavaScript/TypeScript  
**Status:** Phase 1-4 Complete (Auth, Profiles, Rooms, Allocation)

---

## 🔄 Version History

- **v0.1.0** (Current) - Auth, profiles, room management, payment tracking
- Phase 2 - Staff management, advanced permissions
- Phase 3 - Payment verification, SMS integration
- Phase 4 - Reports and analytics
- Phase 5+ - Advanced features (scheduled cleanup, etc.)

---

## 🆘 Quick Help

### Frontend not connecting to backend?
→ Check `VITE_API_BASE_URL` on Vercel and `/health` endpoint

### CORS errors?
→ Update `CORS_ORIGINS` on Render to your Vercel URL

### Database errors?
→ Verify `DATABASE_URL` and test with `psql`

### Files not uploading?
→ Check S3 credentials and bucket is PRIVATE

👉 **Full troubleshooting:** [DEPLOYMENT_ISSUES_AND_FIXES.md](DEPLOYMENT_ISSUES_AND_FIXES.md)

---

**Last Updated:** September 2026  
**Questions?** Check the deployment guides or review server logs.

# Text Correction Backend API

AI-powered Chinese text correction backend service built with Node.js, Express, and TypeScript.

## 🚀 Features

- **AI Text Correction**: OpenAI GPT integration for intelligent text correction
- **RESTful API**: Clean REST endpoints for text processing
- **TypeScript**: Full type safety and modern development experience
- **Express.js**: Fast and minimal web framework
- **JWT Authentication**: Secure user authentication
- **Rate Limiting**: Built-in request rate limiting
- **Swagger Documentation**: API documentation with Swagger UI
- **Comprehensive Testing**: Unit, integration, and performance tests
- **Docker Support**: Containerized deployment ready
- **Production Ready**: Configured for Zeabur deployment

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **AI Service**: OpenAI API
- **Authentication**: JWT
- **Testing**: Jest
- **Documentation**: Swagger/OpenAPI
- **Deployment**: Docker, Zeabur

## 📦 Installation

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- OpenAI API key

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/circleghost/text-correction-backend.git
cd text-correction-backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Server Configuration
NODE_ENV=development
PORT=3000

# OpenAI Configuration  
OPENAI_API_KEY=your_openai_api_key_here

# JWT Configuration
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=24h

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Database (Optional)
DATABASE_URL=your_database_url_here
```

## 📝 API Documentation

### Base URL
- Development: `http://localhost:3000/api/v1`
- Production: `https://your-domain.zeabur.app/api/v1`

### Swagger Documentation
Visit `/api-docs` for interactive API documentation.

### Main Endpoints

#### Health Check
- **GET** `/health` - Service health status

#### Text Correction
- **POST** `/correction/check` - Check and correct text
- **POST** `/correction/batch` - Batch text correction

#### Export Features
- **POST** `/export/docx` - Export to Word document
- **POST** `/export/pdf` - Export to PDF
- **POST** `/export/txt` - Export to plain text

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit        # Unit tests
npm run test:integration # Integration tests
npm run test:performance # Performance tests
```

## 🏗️ Build & Deployment

### Local Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

### Docker Deployment

```bash
# Build Docker image
docker build -t text-correction-backend .

# Run container
docker run -p 3000:3000 --env-file .env text-correction-backend
```

### Zeabur Deployment

1. Connect your GitHub repository to Zeabur
2. Configure environment variables in Zeabur dashboard
3. Deploy automatically from main branch

**Required Environment Variables for Production:**
- `NODE_ENV=production`
- `PORT=3000`
- `OPENAI_API_KEY=your_api_key`
- `JWT_SECRET=secure_random_string`
- `CORS_ORIGIN=https://your-frontend-domain.zeabur.app`

## 📁 Project Structure

```
src/
├── controllers/     # Route controllers
├── middleware/      # Express middleware
├── routes/         # API routes
├── services/       # Business logic
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
└── server.ts       # Application entry point

tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
└── performance/    # Performance tests
```

## 🔐 Security Features

- JWT-based authentication
- Rate limiting middleware
- CORS protection
- Request validation
- Error handling middleware
- Security headers with Helmet.js

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🐛 Issues & Support

Report issues at: https://github.com/circleghost/text-correction-backend/issues

## 🔗 Related Projects

- [Text Correction Frontend](https://github.com/circleghost/text-correction-frontend) - React frontend application
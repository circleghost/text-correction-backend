---
name: Auth + Usage Tracking
status: in_progress
created: 2025-09-13T02:37:28Z
progress: 12%
prd: .claude/prds/Auth + Usage Tracking.md
github: https://github.com/circleghost/text-correction-backend/issues/1
---

# Epic: Auth + Usage Tracking

## Overview

Transform the anonymous text correction platform into a user-managed system with Google OAuth authentication and comprehensive usage tracking. This implementation leverages Supabase as the backend-as-a-service platform to provide authentication, database, and real-time capabilities while maintaining the existing Node.js/Express backend and React frontend architecture.

The system implements a free tier with 50 monthly corrections, usage quota management, and prepares the foundation for future commercial features.

## Architecture Decisions

### **Authentication Strategy**
- **Supabase Auth + Google OAuth 2.0**: Leverages Supabase's built-in OAuth providers for seamless Google account integration
- **JWT Token Management**: 15-minute access tokens with 7-day refresh tokens for security balance
- **Session Persistence**: 30-day "remember me" functionality for user convenience

### **Database Architecture**
- **PostgreSQL via Supabase**: Managed database with automatic scaling and backup
- **Row Level Security (RLS)**: Database-level security ensuring users only access their own data
- **Denormalized Usage Tracking**: Optimized for read-heavy usage analytics queries

### **Integration Pattern**
- **Middleware Integration**: Minimal modification to existing APIs using authentication middleware
- **Gradual Migration**: Maintain anonymous access during transition period
- **Existing API Compatibility**: Preserve current text correction functionality

## Technical Approach

### Frontend Components
- **Authentication Flow**: Login/logout components using Supabase Auth UI library
- **Usage Dashboard**: React components showing quota usage, history, and analytics
- **Session Management**: Context provider for user state and quota status
- **Minimal UI Changes**: Integrate auth seamlessly into existing interface

### Backend Services
- **Authentication Middleware**: JWT verification for protected endpoints
- **Usage Tracking Service**: Real-time quota checking and usage logging
- **Supabase Client Integration**: Database operations using Supabase SDK
- **API Rate Limiting**: Quota-based throttling for text correction endpoints

### Infrastructure
- **Supabase Project Setup**: Database, authentication, and Edge Functions configuration
- **Database Schema**: 8 core tables with proper indexing and RLS policies
- **Environment Configuration**: Secure credential management for Supabase integration
- **Monitoring Integration**: Usage metrics and error tracking via existing Sentry setup

## Implementation Strategy

### **Development Phases** (OAuth-First Approach)
1. **Core Authentication Phase (2-3 weeks)**: Supabase setup, Google OAuth, user management
2. **Usage Tracking Phase (2-3 weeks)**: Quota system, usage logging, API integration
3. **Dashboard Phase (2 weeks)**: Usage visualization and basic analytics
4. **Polish & Launch Phase (1 week)**: Testing and production deployment

### **Risk Mitigation**
- **Database Migration Strategy**: Implement RLS policies before user data creation
- **API Backward Compatibility**: Maintain anonymous access endpoints during transition
- **Performance Testing**: Load test quota checking system under concurrent usage
- **Gradual Rollout**: Feature flags for controlled user onboarding

### **Testing Approach**
- **Unit Tests**: Core authentication and usage tracking functions
- **Integration Tests**: Supabase integration and API middleware
- **E2E Tests**: Complete user journeys from signup to usage tracking
- **Load Testing**: Concurrent user scenarios and quota system performance

## Task Breakdown Preview

High-level task categories (simplified to 6 core tasks):

- [ ] **Database & Auth Setup**: Supabase project, Google OAuth, basic schema and RLS
- [ ] **Authentication Core**: Login/logout UI, JWT middleware, session management
- [ ] **Usage Tracking Engine**: Quota management, usage logging, and real-time monitoring
- [ ] **API Integration**: Existing endpoint modification with authentication middleware
- [ ] **Usage Dashboard**: Basic usage visualization (no email notifications)
- [ ] **Testing & Deployment**: Core functionality testing and production deployment

## Dependencies

### **External Service Dependencies**
- **Supabase**: Core authentication, database, and real-time functionality
- **Google OAuth API**: Social login integration
- **OpenAI API**: Cost tracking integration for usage analytics
- **~~Email Service~~**: Deferred - no SMTP service currently available

### **Internal Dependencies**
- **Existing Backend**: Node.js/Express API endpoints require middleware integration
- **React Frontend**: Minimal modifications needed for authentication flow
- **Database Migration**: Existing data considerations (currently anonymous)

### **Prerequisite Work**
- Supabase project creation and configuration
- Google Cloud Console OAuth application setup
- Environment variable configuration for new credentials
- Database backup strategy for production migration

## Success Criteria (Technical)

### **Performance Benchmarks**
- Authentication response time: <200ms (95th percentile)
- Quota check response time: <50ms (99th percentile)
- Dashboard load time: <1 second
- System uptime: 99.5%

### **Quality Gates**
- 90%+ unit test coverage for authentication and usage tracking
- Zero security vulnerabilities in dependency scan
- All RLS policies tested and validated
- Performance benchmarks met under load testing

### **Acceptance Criteria** (Phase 1)
- Users can sign in with Google account seamlessly
- Usage quota accurately tracked and enforced  
- Basic dashboard shows current usage and remaining quota
- Existing text correction functionality preserved
- Monthly quota reset automation working correctly
- **Deferred**: Email notifications (when SMTP service available)

## Estimated Effort

### **Overall Timeline** (Simplified)
- **Total Duration**: 7-8 weeks (2 months)
- **Resource Requirements**: 2 full-stack developers + 1 designer (part-time)
- **Critical Path**: Authentication → Usage tracking → Basic dashboard

### **Key Milestones**
- Week 2-3: Google OAuth authentication functional
- Week 4-5: Usage tracking and quota enforcement active
- Week 6-7: Basic usage dashboard complete
- Week 8: Production-ready with core testing

### **Risk Buffer**
- 2-week buffer included for integration complexity
- Parallel development streams to minimize dependencies
- Incremental deployment strategy to reduce rollback risk

This epic transforms the platform from anonymous usage to a comprehensive user-managed system while maintaining the core text correction functionality and preparing for future commercial features.

## Implementation Strategy Update

**OAuth-First Approach**: This implementation prioritizes Google OAuth authentication and basic usage tracking, deferring all email-related features until SMTP services are available. This allows faster time-to-market for core authentication functionality.

### **Deferred Features** (Future Phase)
- Email notifications for quota warnings
- Welcome/onboarding emails  
- Password reset emails (Google OAuth only for now)
- Usage report emails
- SMTP service integration

### **Phase 1 Scope** (Current Implementation)
- Google OAuth login/logout
- Basic user profile management
- Usage quota tracking and enforcement
- Simple usage dashboard
- Database-only notifications (in-app)

## Tasks Created

- [ ] #2 - Database & Auth Setup (parallel: false)
- [ ] #3 - Authentication Core (parallel: false)
- [ ] #4 - Usage Tracking Engine (parallel: false)
- [ ] #5 - API Integration (parallel: false)
- [ ] #6 - Usage Dashboard (parallel: true)
- [ ] #7 - Testing & Deployment (parallel: false)

Total tasks: 6
Parallel tasks: 1
Sequential tasks: 5
Estimated total effort: 96 hours

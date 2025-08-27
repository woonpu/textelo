# Tactical Messages

## Overview

Tactical Messages is a competitive turn-based messaging game where players engage in strategic communication battles. Players are matched based on ELO rating and take turns crafting messages that are evaluated by AI for strategic value, psychological impact, clarity, and tactical sophistication. The game features real-time matchmaking, AI-powered message evaluation, and a comprehensive rating system with brilliant, great, excellent, good, miss, mistake, and blunder classifications.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom dark gaming theme and CSS variables
- **State Management**: TanStack React Query for server state and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation via @hookform/resolvers

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with structured route handling
- **Real-time Features**: Polling-based updates for match state and messages
- **Session Management**: Express sessions with PostgreSQL store via connect-pg-simple
- **Development**: Hot module replacement with Vite middleware in development

### Authentication System
- **Provider**: Replit Auth with OpenID Connect
- **Strategy**: Passport.js with openid-client strategy
- **Session Storage**: Database-backed sessions with automatic cleanup
- **Security**: HTTP-only cookies with secure flags and CSRF protection

### Database Design
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: Neon PostgreSQL serverless database
- **Schema Management**: Drizzle Kit for migrations and schema pushes
- **Connection**: Connection pooling with @neondatabase/serverless

### Game Engine
- **AI Integration**: OpenAI GPT-5 for message evaluation and rating
- **Matchmaking**: ELO-based matching with expanding search ranges over time
- **Scoring System**: Seven-tier rating system (brilliant to blunder) with explanations
- **Match Logic**: Turn-based gameplay with 5-minute time limits and automatic forfeit

### Data Models
- **Users**: Profile data, ELO ratings, win/loss statistics, peak ELO tracking
- **Matches**: Game state, player references, status tracking, turn management
- **Messages**: Content, AI ratings, explanations, timestamps
- **Queue**: Matchmaking queue with ELO-based ordering
- **Sessions**: Authentication session persistence

## External Dependencies

### Core Services
- **Neon Database**: Serverless PostgreSQL hosting and management
- **OpenAI API**: GPT-5 model for message evaluation and rating
- **Replit Auth**: OAuth authentication and user management

### Development Tools
- **Vite**: Build tool and development server with HMR
- **TypeScript**: Type safety and development experience
- **ESBuild**: Production bundling for server-side code

### UI and Styling
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first styling framework
- **Lucide React**: Icon library for consistent iconography
- **Google Fonts**: Custom font loading (Architects Daughter, DM Sans, Fira Code, Geist Mono)

### Utilities
- **Zod**: Runtime schema validation
- **date-fns**: Date manipulation and formatting
- **clsx & tailwind-merge**: Conditional class name handling
- **nanoid**: Unique ID generation for entities
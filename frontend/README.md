# Tazco Frontend - Financial Dashboard

Modern React application for managing credit cards, transactions, and administrative tasks.

## 📋 Overview

The frontend is built with cutting-edge technologies:
- **Next.js 16** with App Router
- **React 19** for UI components
- **Tailwind CSS 4** for styling
- **Shadcn UI** for accessible components
- **React Hook Form + Zod** for form management
- **TypeScript** for type safety

## 🏗 Architecture

```
frontend/src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Authentication routes
│   │   └── login/          # Login page
│   ├── (user)/             # User-facing routes
│   │   ├── dashboard/      # User dashboard
│   │   ├── cards/          # Card management
│   │   └── transactions/   # Transaction history
│   ├── (admin)/            # Admin routes
│   │   ├── requests/       # Card request approval
│   │   └── score/          # Score management
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   └── globals.css         # Global styles
├── components/
│   ├── ui/                 # Shadcn UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── cards/              # Card-specific components
│   ├── dashboard/          # Dashboard components
│   ├── layout/             # Layout components
│   └── forms/              # Form components
├── contexts/
│   └── auth-context.tsx    # Authentication context
├── lib/
│   ├── api/                # API client
│   │   └── client.ts       # HTTP client
│   └── utils.ts            # Utility functions
└── types/
    └── api.ts              # API type definitions
```

## 🚀 Quick Start

### Prerequisites

- Bun >= 1.0.0
- Node.js >= 20.0.0
- Backend API running (see [../backend/README.md](../backend/README.md))

### Installation

```bash
cd frontend
bun install
```

### Development

```bash
bun run dev
```

The app will be available at http://localhost:3001

### Environment Configuration

Create `.env.local`:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000

# Optional: Environment
NODE_ENV=development
```

## 🎨 UI Components

We use **Shadcn UI** - a collection of beautifully designed, accessible components built with Radix UI and Tailwind CSS.

### Adding New Components

```bash
# Install a component
bunx shadcn@latest add button
bunx shadcn@latest add card
bunx shadcn@latest add dialog
```

### Using Components

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Example() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Card</CardTitle>
      </CardHeader>
      <CardContent>
        <Button>Click me</Button>
      </CardContent>
    </Card>
  );
}
```

### Available Components

- Button, Input, Textarea
- Card, Dialog, Sheet
- Dropdown Menu, Select
- Tabs, Separator
- Avatar, Label, Tooltip
- And more...

See [ui.shadcn.com](https://ui.shadcn.com) for full component library.

## 🎭 Features

### User Features

#### Dashboard
- Credit score overview
- Active cards summary
- Recent transactions
- Available credit

#### Card Management
- View all cards
- Card details
- Request new card
- Transaction history

#### Transactions
- Make purchases
- Make payments
- View transaction history
- Filter by type and date

### Admin Features

#### Card Request Management
- View pending requests
- Approve/reject requests
- Set credit limits
- View request details

#### User Management
- View user scores
- Adjust credit scores
- View user activity

#### System Management
- Data cleanup (dev/test only)

## 🔐 Authentication

### Auth Flow

1. User enters credentials on login page
2. Backend validates and returns JWT token
3. Token stored in context and localStorage
4. Token included in all API requests
5. Auto-redirect to login if token invalid

### Auth Context

```tsx
import { useAuth } from '@/contexts/auth-context';

function Component() {
  const { user, login, logout, isAuthenticated } = useAuth();

  return (
    <div>
      {isAuthenticated ? (
        <p>Welcome, {user?.email}</p>
      ) : (
        <button onClick={() => login(email, password)}>Login</button>
      )}
    </div>
  );
}
```

### Protected Routes

Routes are automatically protected based on route groups:
- `(auth)` - Public (login)
- `(user)` - Requires user authentication
- `(admin)` - Requires admin role

## 📡 API Integration

### API Client

```typescript
// lib/api/client.ts
import { ApiClient } from '@/lib/api/client';

const api = new ApiClient(process.env.NEXT_PUBLIC_API_URL);

// GET request
const dashboard = await api.get('/v1/dashboard');

// POST request
const card = await api.post('/v1/cards/requests', {
  productId: 'default-credit-card'
});
```

### Type Safety

```typescript
// types/api.ts
interface Dashboard {
  user: User;
  cards: Card[];
  creditScore: number;
  totalCredit: number;
  availableCredit: number;
}

// Usage with type safety
const dashboard: Dashboard = await api.get<Dashboard>('/v1/dashboard');
```

## 🎨 Styling

### Tailwind CSS

We use **Tailwind CSS 4** for styling:

```tsx
<div className="flex items-center justify-between p-4 rounded-lg bg-background border">
  <h2 className="text-2xl font-bold">Title</h2>
  <Button className="bg-primary text-primary-foreground">Action</Button>
</div>
```

### Theme System

Dark/light mode support using `next-themes`:

```tsx
import { useTheme } from 'next-themes';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      Toggle Theme
    </button>
  );
}
```

### CSS Variables

Theme colors defined in `globals.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --secondary: 210 40% 96.1%;
  /* ... */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```

## 📝 Forms

### React Hook Form + Zod

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const schema = z.object({
  amount: z.number().min(1).max(10000),
  merchant: z.string().min(1),
  category: z.string().optional()
});

function PurchaseForm() {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: 0,
      merchant: '',
      category: ''
    }
  });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    await api.post('/v1/cards/123/transactions/purchases', data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* form fields */}
    </form>
  );
}
```

## 🧪 Testing

```bash
# Run tests
bun run test

# Watch mode
bun run test:watch

# Coverage
bun run test:coverage
```

## 📝 Code Quality

### Type Checking

```bash
bun run typecheck
```

### Linting

```bash
# Check
bun run lint

# Fix
bun run lint:fix
```

### Formatting

```bash
# Format
bun run format

# Check
bun run format:check
```

## 🏗 Build & Deploy

### Production Build

```bash
bun run build
```

Output: `.next/` directory

### Start Production Server

```bash
bun run start
```

Runs on http://localhost:3001

### Environment Variables for Production

Create `.env.production`:

```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NODE_ENV=production
```

### Deployment Platforms

#### Vercel (Recommended)

```bash
# Install Vercel CLI
bun add -g vercel

# Deploy
vercel
```

#### Docker

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build
COPY . .
RUN bun run build

# Production
FROM oven/bun:1-slim
WORKDIR /app
COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static
COPY --from=base /app/public ./public

EXPOSE 3001
CMD ["bun", "server.js"]
```

## 🔧 Configuration Files

### `next.config.ts`

Next.js configuration:

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // ... other config
};

export default nextConfig;
```

### `tailwind.config.ts`

Tailwind CSS configuration (using v4 CSS-based config in globals.css)

### `components.json`

Shadcn UI configuration

## 🐛 Troubleshooting

### API Connection Issues

```bash
# Check backend is running
curl http://localhost:3000/health/liveness

# Check environment variable
echo $NEXT_PUBLIC_API_URL
```

### Build Errors

```bash
# Clear cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
bun install

# Rebuild
bun run build
```

### Type Errors

```bash
# Check types
bun run typecheck

# Update type definitions
bun add -D @types/node @types/react @types/react-dom
```

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Shadcn UI](https://ui.shadcn.com)
- [React Hook Form](https://react-hook-form.com)
- [Zod](https://zod.dev)

## 🤝 Contributing

See [../CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines.

---

**Questions?** Check the [main documentation](../README.md) or open an issue.

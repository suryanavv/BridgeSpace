# BridgeSpace

BridgeSpace is a modern file and text sharing application that allows users to share content over WiFi networks or in private spaces using secret keys. It provides a seamless way to transfer files and collaborate on text without requiring user accounts or complex setup.

![BridgeSpace Logo](/public/rocket.svg)

## Features

- **Network-Based Sharing**: Automatically detect and share with devices on the same network
- **File Sharing**: Upload and share files with other devices on your network
- **Text Sharing**: Collaborate on text in real-time with automatic saving
- **Private Spaces**: Create or join private spaces using secret keys for secure sharing
- **Real-time Updates**: See changes instantly with real-time synchronization
- **Responsive Design**: Works on desktop and mobile devices
- **Automatic Cleanup**: Old files are automatically removed after 7 days

## Technologies

- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui components
- **Backend**: Supabase (Database, Storage, Edge Functions, Real-time)
- **Routing**: React Router
- **State Management**: React Query
- **Notifications**: Sonner toast notifications

## Installation

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account

### Setup

1. Clone the repository

```bash
git clone https://github.com/suryanavv/BridgeSpace.git
cd BridgeSpace
```

2. Install dependencies

```bash
npm install
# or
yarn install
```

3. Set up environment variables

Create a `.env` file in the root directory with the following variables:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Set up Supabase

Follow the instructions in the [Supabase Setup Guide](./supabase_setup.md) to configure your Supabase project with the required tables, storage buckets, and edge functions.

## Development

Start the development server:

```bash
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:8080`.

## Building for Production

```bash
npm run build
# or
yarn build
```

The built files will be in the `dist` directory.

## Usage

### Sharing Files

1. Connect to the same WiFi network as the recipient
2. Upload files using the File tab
3. Files will be automatically available to other devices on the same network

### Using Private Spaces

1. Click "Create/Join Private Space"
2. Enter a secret key
3. Share this key with others who need access to your shared content
4. Others can join the same private space using the key

### Text Sharing

1. Navigate to the Text tab
2. Start typing in the editor
3. Content is automatically saved and shared with others on your network or in your private space

## Project Structure

```
├── public/                # Static assets
├── src/
│   ├── components/        # UI components
│   │   ├── ui/            # Base UI components (shadcn/ui)
│   │   └── ...            # Application-specific components
│   ├── hooks/             # Custom React hooks
│   ├── integrations/      # External service integrations
│   │   └── supabase/      # Supabase client and types
│   ├── lib/               # Utility libraries
│   ├── pages/             # Page components
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── supabase/              # Supabase configuration
│   ├── functions/         # Edge functions
│   └── migrations/        # Database migrations
└── ...                    # Configuration files
```

## Supabase Setup

BridgeSpace requires a properly configured Supabase project to function. The setup includes:

- Database tables for storing file metadata and shared text
- Storage buckets for file uploads
- Edge functions for IP detection
- Row-Level Security (RLS) policies
- Scheduled jobs for maintenance

Detailed setup instructions are available in the [Supabase Setup Guide](./supabase_setup.md).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [Supabase](https://supabase.io/) for the backend infrastructure
- [shadcn/ui](https://ui.shadcn.com/) for the UI components
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Vite](https://vitejs.dev/) for the build system

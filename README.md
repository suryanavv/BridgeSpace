# BridgeSpace

BridgeSpace is a file and text-sharing and collaboration platform designed to enhance productivity by enabling seamless content sharing between devices. Files and text can be shared effortlessly between devices connected to the same Wi-Fi network.

## 🚀 Technology Stack

- **Frontend:** React  
- **Language:** TypeScript  
- **Build Tool:** Vite  
- **UI Library:** Shadcn UI  
- **State Management:** React Hooks  
- **Form Handling:** React Hook Form  
- **Styling:** Tailwind CSS  

## 📁 Project Structure

```
BridgeSpace-main/           # Project main directory  
├── public/                 # Static assets  
├── src/                    # Source code  
│   ├── components/         # Reusable React components  
│   ├── integrations/       # External service integrations  
│   │   └── supabase/       # Supabase client configuration  
│   ├── hooks/              # Custom React hooks  
│   └── utils/              # Utility functions  
├── supabase/               # Supabase configuration  
├── package.json            # Project dependencies and scripts  
├── tsconfig.json           # TypeScript configuration  
└── vite.config.ts          # Vite configuration  
```

## 🔧 Prerequisites

- Node.js (v18+)  
- Bun or npm package manager  

## 🛠️ Installation

1. **Clone the repository:**  
   ```bash
   git clone https://github.com/suryanavv/BridgeSpace.git
   cd BridgeSpace
   ```  

2. **Install dependencies:**  
   Using Bun:  
   ```bash
   bun install  
   ```  
   Or using npm:  
   ```bash
   npm install  
   ```  

3. **Set up environment variables:**  
   - Copy `.env.example` to `.env`  
   - Fill in the required configuration values  

## 🏃‍♂️ Running the Project

### Development Mode  
Using Bun:  
```bash
bun dev  
```  
Using npm:  
```bash
npm run dev  
```  

### Production Build  
Using Bun:  
```bash
bun build  
```  
Using npm:  
```bash
npm run build  
```  

## 🤝 Contributing

1. Fork the repository  
2. Create your feature branch:  
   ```bash
   git checkout -b feature/AmazingFeature  
   ```  
3. Commit your changes:  
   ```bash
   git commit -m 'Add some AmazingFeature'  
   ```  
4. Push to the branch:  
   ```bash
   git push origin feature/AmazingFeature  
   ```  
5. Open a Pull Request  

---

Thank you for contributing to BridgeSpace! If you have any questions, feel free to open an issue or start a discussion. 🚀

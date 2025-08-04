require('dotenv').config(); 
const express = require('express');
const connectDB = require('./config/db');
const tenantResolver = require('./middleware/tenantResolver');
const cors = require('cors');
const http = require('http')
const { Server } = require('socket.io');
const path = require("path");
const fs = require("fs");
// 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

const tenantRoutes = require('./routes/tenant');
const userRoutes = require('./routes/user');
const siteRoutes = require('./routes/site');
const projectRoutes = require('./routes/project');
const groupRoutes = require('./routes/group');
const conntactRoutes = require('./routes/contact');
const templateRoutes = require('./routes/template');
const messageRoutes = require('./routes/message');
const webhookRoutes = require('./routes/webhook');
const teamMemberRoutes = require('./routes/teamMember'); 
const whatsappRoutes = require('./routes/whatsapp'); 
const conversationRoutes = require('./routes/conversation');
const dashboardRoutes = require('./routes/dashboardRoutes');
const projectDashboardRoutes = require('./routes/projectDashboard');
const flowRoutes = require('./routes/flowRoutes');

connectDB();
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const allowedOrigins = [
  'http://localhost:5173',
  'https://wachatfinal.onrender.com',
  'https://c1d2faae5baf.ngrok-free.app',
  "http://192.168.1.86:5173/",
  "http://172.16.0.2:5173/",
  "https://sabnode.netlify.app",
  "https://grand-chebakia-1cba30.netlify.app",
  "https://wachaat.netlify.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin);
    } else {
      callback(new Error('CORS not allowed for this origin: ' + origin));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS','PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Tenant-Domain'
  ]
}));
app.set('trust proxy', true);
app.use((req, res, next) => {
  const referer = req.headers.referer;
  if(referer && /WAITFOR|SLEEP|DELAY|BENCHMARK|--/i.test(referer)) {
    console.warn('Potential SQL injection attempt in Referer header: ', referer);
    return res.status(400).json({
      status: 400,
      success: false,
      message: "Bad Request"
    });
  }
  next();
});

app.use('/api/webhook', webhookRoutes);
app.use('/api/site', siteRoutes);
app.use('/api', tenantResolver);
app.use('/api/tenants', tenantRoutes);
app.use('/api/users', userRoutes);
app.use('/api/project', projectRoutes);
app.use('/api/whatsapp/', whatsappRoutes); 
app.use('/api/templates', templateRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/projects/:projectId/groups', groupRoutes);
app.use('/api/projects/:projectId/contacts', conntactRoutes);
app.use('/api/projects/:projectId/conversations', conversationRoutes);
app.use('/api/projects/:projectId/flows', flowRoutes);
app.use('/api/projects/', projectDashboardRoutes);
app.use('/api/projects/:projectId/messages', messageRoutes);
app.use('/api/projects/:projectId/team-member', teamMemberRoutes);

const server = http.createServer(app); 
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:3000", "http://localhost:5173"],
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    }
});

app.set('io', io);

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinRoom', (roomName) => {
        socket.join(roomName);
        console.log(`Socket ${socket.id} joined room: ${roomName}`);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const logFile = path.join(__dirname, "server.log");
const logStream = fs.createWriteStream(logFile, { flags: "a" });
const originalConsoleLog = console.log;
console.log = (...args) => {
  const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
  const timestamp = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false
  });
  const timestampedMessage = `[${timestamp}] ${message}\n`;

  logStream.write(timestampedMessage);
  originalConsoleLog(timestampedMessage);
};

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
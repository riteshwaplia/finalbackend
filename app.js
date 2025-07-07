require('dotenv').config(); // For environment variables like MONGO_URI, JWT_SECRET
const express = require('express');
const connectDB = require('./config/db');
const tenantResolver = require('./middleware/tenantResolver'); // Important!
const cors = require('cors');
const http = require('http'); // Import http module
const { Server } = require('socket.io'); // Import Server 


// Import routes
const tenantRoutes = require('./routes/tenant');
const userRoutes = require('./routes/user'); // For tenant-specific user management
const siteRoutes = require('./routes/site'); // For public site config
const projectRoutes = require('./routes/project'); // NEW: Import Project routes
const groupRoutes = require('./routes/group'); // NEW: Import Group routes
const conntactRoutes = require('./routes/contact'); // NEW: Import Group routes
const templateRoutes = require('./routes/template'); // NEW: Import Group routes
const messageRoutes = require('./routes/message'); // NEW: Import Group routes
const webhookRoutes = require('./routes/webhook'); // NEW: Import Group routes
const teamMemberRoutes = require('./routes/teamMember'); // NEW: Import Group routes
const whatsappRoutes = require('./routes/whatsapp'); // NEW: Import Group routes
const conversationRoutes = require('./routes/conversation'); // NEW: Import Group routes

connectDB(); // Connect to MongoDB
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Body parser
const allowedOrigins = [
  'http://localhost:5173',
  'https://wachatfinal.onrender.com',
  'https://bb7a-2401-4900-1c7b-7fa8-1003-9674-6424-5de0.ngrok-free.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin); // ✅ Echo the actual origin back
    } else {
      callback(new Error('CORS not allowed for this origin: ' + origin));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Tenant-Domain' // ✅ Add any custom headers you're using
  ]
}));


app.use('/api/webhook', webhookRoutes); // This is crucial

// Public site configuration route - resolve tenant first
app.use('/api/site', siteRoutes);

// Apply tenant resolution for all other API routes that depend on tenant context
app.use('/api', tenantResolver); // This middleware will run for all subsequent routes

// Authenticated and authorized routes
app.use('/api/tenants', tenantRoutes); // Super admin routes
app.use('/api/users', userRoutes); // Tenant admin/user routes (needs protect middleware in routes/user.js)
app.use('/api/project', projectRoutes); // NEW: Use Project routes
app.use('/api/whatsapp/', whatsappRoutes); 
app.use('/api/templates', templateRoutes);
app.use('/api/projects/:projectId/groups', groupRoutes);
app.use('/api/projects/:projectId/contacts', conntactRoutes);
app.use('/api/projects/:projectId/conversations', conversationRoutes);

// app.use('/api/projects/:projectId/templates', templateRoutes);
app.use('/api/projects/:projectId/messages', messageRoutes);
app.use('/api/projects/:projectId/team-member', teamMemberRoutes);
// api/whatsapp/phone-numbers
// Create HTTP server from your Express app
const server = http.createServer(app); 
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000", // Your frontend URL
        methods: ["GET", "POST"]
    }
});

// Make io instance available throughout your app via req.app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // A user might join a "room" based on their userId or projectId to receive specific updates
    socket.on('joinRoom', (roomName) => {
        socket.join(roomName);
        console.log(`Socket ${socket.id} joined room: ${roomName}`);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 5001;
// Use the HTTP server (with Socket.IO) to listen instead of app.listen()
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));